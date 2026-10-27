import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from 'electron';
import { join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, stat, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { settingsSchema, projectSchema, type Settings, type Project, type Recent, type Result } from '../src/shared/schema';
import { serializeProject, parseProject } from '../src/shared/project';
import { atomicWrite, readValidated } from './storage';
import { Library } from './library';
import { resourceId, MAX_PROJECT_BYTES } from './security';

protocol.registerSchemesAsPrivileged([{ scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
const dev = process.env.LIVE_STUDIO_DEV === 'http://127.0.0.1:5173' ? process.env.LIVE_STUDIO_DEV : undefined;
const directory = __dirname;
let window: BrowserWindow;
let settings: Settings, library: Library, recents: (Recent & { path: string })[] = [];
let currentFile: string | null = null, closing = false;
const warnings: string[] = [];
const dataDirectory = () => app.getPath('userData');
const dataPath = (name: string) => join(dataDirectory(), name);
if (process.env.LIVE_STUDIO_TEST_DATA && process.env.LIVE_STUDIO_TEST === '1') app.setPath('userData', process.env.LIVE_STUDIO_TEST_DATA);

const recentSchema = z.array(z.object({ id: z.string().uuid(), name: z.string(), filename: z.string(), path: z.string() })).max(20);
function trusted(url: string) {
  if (dev) return url.startsWith(dev + '/');
  try { return fileURLToPath(url) === join(directory, '../renderer/index.html'); } catch { return false; }
}
function humanError(error: unknown): string {
  if (error instanceof z.ZodError) return 'Dados incompatíveis: ' + error.issues.map(i => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; ');
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT') return 'Arquivo não encontrado. Ele pode ter sido movido. Abra ou reassocie o arquivo novamente.';
  if (code === 'EACCES' || code === 'EPERM') return 'O Windows negou acesso ao arquivo. Escolha uma pasta com permissão de leitura e gravação.';
  if (code === 'ENOSPC') return 'Não há espaço em disco para salvar. Libere espaço e tente novamente.';
  return error instanceof Error && !code ? error.message.slice(0, 400) : 'Não foi possível acessar os dados. Verifique o arquivo e tente novamente.';
}
function handle<T>(channel: string, callback: (...args: any[]) => Promise<T>) {
  ipcMain.handle(channel, async (event, ...args): Promise<Result<T>> => {
    if (event.sender !== window.webContents || !event.senderFrame || event.senderFrame !== window.webContents.mainFrame || !trusted(event.senderFrame.url)) return { ok: false, error: 'Origem não autorizada.' };
    try { return { ok: true, value: await callback(...args) }; } catch (error) { return { ok: false, error: humanError(error) }; }
  });
}
async function remember(path: string, project: Project) {
  const existing = recents.find(r => r.path === path);
  recents = [{ id: existing?.id ?? crypto.randomUUID(), path, name: project.name, filename: basename(path) }, ...recents.filter(r => r.path !== path)].slice(0, 20);
  await atomicWrite(dataPath('recent.json'), JSON.stringify(recents));
}
function setupIPC(recovery: Project | null) {
  handle('studio:bootstrap', async () => ({ settings, recovery, samples: library.list(), recents: recents.map(({ path: _p, ...r }) => r), warnings, version: app.getVersion() }));
  handle('studio:save', async (input: unknown, saveAs: unknown) => {
    const project = projectSchema.parse(input); z.boolean().parse(saveAs);
    let path = currentFile;
    if (saveAs || !path) {
      const choice = await dialog.showSaveDialog(window, { title: 'Salvar projeto Live Studio', defaultPath: project.name.replace(/[<>:"/\\|?*]/g, '_') + '.live.json', filters: [{ name: 'Projeto Live Studio', extensions: ['live.json'] }] });
      if (choice.canceled || !choice.filePath) return { saved: false };
      path = choice.filePath;
    }
    await atomicWrite(path, serializeProject(project)); currentFile = path;
    await remember(path, project); return { saved: true, filename: basename(path) };
  });
  handle('studio:open', async (id?: unknown) => {
    if (id !== undefined) z.string().uuid().parse(id);
    let path = id ? recents.find(r => r.id === id)?.path : undefined;
    if (id && !path) throw new Error('Projeto recente indisponível. Use Abrir projeto.');
    if (!path) {
      const choice = await dialog.showOpenDialog(window, { title: 'Abrir projeto', filters: [{ name: 'Projeto Live Studio', extensions: ['json'] }], properties: ['openFile'] });
      if (choice.canceled) return null; path = choice.filePaths[0];
    }
    if ((await stat(path)).size > MAX_PROJECT_BYTES) throw new Error('Este projeto ultrapassa o limite de 20 MB.');
    const project = parseProject(await readFile(path, 'utf8')); currentFile = path; await remember(path, project); return project;
  });
  handle('studio:release-project', async () => { currentFile = null; });
  handle('studio:recovery', async (value: unknown) => {
    if (value === null) { await unlink(dataPath('recovery.json')).catch(e => { if (e.code !== 'ENOENT') throw e; }); return; }
    await atomicWrite(dataPath('recovery.json'), serializeProject(projectSchema.parse(value)));
  });
  handle('studio:settings', async (value: unknown) => { settings = settingsSchema.parse(value); await atomicWrite(dataPath('settings.json'), JSON.stringify(settings)); });
  handle('studio:import', async (folder: unknown) => library.import(window, z.boolean().parse(folder)));
  handle('studio:sample', async (value: unknown) => library.update(value as any));
  handle('studio:relink', async (id: unknown) => library.relink(window, z.string().uuid().parse(id)));
  handle('studio:scan', async () => library.scan());
  ipcMain.on('studio:close-ready', event => { if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame) { closing = true; window.close(); } });
}
async function start() {
  settings = await readValidated(dataPath('settings.json'), settingsSchema, settingsSchema.parse({}), warnings);
  recents = await readValidated(dataPath('recent.json'), recentSchema, [], warnings);
  const recovery = await readValidated(dataPath('recovery.json'), projectSchema.nullable(), null, warnings);
  library = new Library(dataPath('library.json')); await library.load(warnings);
  protocol.handle('studio', async request => {
    const id = resourceId(request.url);
    if (!id || request.method !== 'GET') return new Response('Recurso inválido.', { status: 403 });
    try { return await net.fetch(pathToFileURL(await library.resolve(id)).href); }
    catch { return new Response('Sample não encontrado. Reassocie o arquivo na biblioteca.', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === window?.webContents && trusted(details.requestingUrl || contents.getURL()) && ['midi', 'midiSysex', 'speaker-selection'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === window?.webContents && trusted(details.requestingUrl || contents.getURL()) && ['midi', 'midiSysex', 'speaker-selection'].includes(permission));
  const boundsSchema = z.object({ width: z.number().min(900).max(7680), height: z.number().min(620).max(4320), maximized: z.boolean() });
  const bounds = await readValidated(dataPath('window.json'), boundsSchema, { width: 1440, height: 940, maximized: false }, warnings);
  window = new BrowserWindow({ width: bounds.width, height: bounds.height, minWidth: 900, minHeight: 620, title: 'Live Studio', backgroundColor: '#0B1220', show: false, icon: join(directory, '../../assets/icon.ico'), webPreferences: { preload: join(directory, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (['https://strudel.cc/learn/', 'https://github.com/pjz3650/strudel-based-studio', 'https://codeberg.org/uzu/strudel'].includes(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => { if (!closing) dialog.showErrorBox('Live Studio: renderização interrompida', `O processo da interface foi encerrado (${details.reason}). Reabra o aplicativo para recuperar sua sessão.`); });
  setupIPC(recovery);
  const command = (name: string) => () => window.webContents.send('studio:menu', name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Arquivo', submenu: [{ label: 'Novo projeto', accelerator: 'CmdOrCtrl+N', click: command('new') }, { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: command('open') }, { label: 'Salvar', accelerator: 'CmdOrCtrl+S', click: command('save') }, { label: 'Salvar como…', accelerator: 'CmdOrCtrl+Shift+S', click: command('saveAs') }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
    { label: 'Sessão', submenu: [{ label: 'Tocar / atualizar', click: command('play') }, { label: 'Parar', accelerator: 'CmdOrCtrl+.', click: command('stop') }, { label: 'Configurações', accelerator: 'CmdOrCtrl+,', click: command('settings') }] },
    { label: 'Exibir', submenu: [{ role: 'togglefullscreen', label: 'Tela cheia' }, { label: 'Restaurar layout', click: command('layout') }, ...(dev ? [{ role: 'toggleDevTools' as const }] : [])] }
  ]));
  window.on('close', event => {
    const b = window.getNormalBounds();
    void atomicWrite(dataPath('window.json'), JSON.stringify({ width: b.width, height: b.height, maximized: window.isMaximized() }));
    if (!closing) { event.preventDefault(); window.webContents.send('studio:close-request'); }
  });
  window.once('ready-to-show', () => { if (bounds.maximized) window.maximize(); window.show(); });
  if (dev) await window.loadURL(dev); else await window.loadFile(join(directory, '../renderer/index.html'));
}
app.whenReady().then(start).catch(error => { dialog.showErrorBox('Não foi possível iniciar o Live Studio', humanError(error)); app.exit(1); });
app.on('window-all-closed', () => app.quit());
