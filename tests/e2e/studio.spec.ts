import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
let app: ElectronApplication, page: Page;
let launchEnvironment: Record<string, string>;
const root = resolve('.'),
  data = join(root, '.test-data');
test.beforeEach(async ({}, info) => {
  const userData = join(data, String(info.testId).replace(/[^a-z0-9]/gi, '_'));
  await rm(userData, { recursive: true, force: true });
  await mkdir(userData, { recursive: true });
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({
      ...process.env,
      LIVE_STUDIO_DEV: '',
      LIVE_STUDIO_TEST: '1',
      LIVE_STUDIO_TEST_DATA: userData,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  launchEnvironment = env;
  app = await electron.launch({
    ...(process.env.LIVE_STUDIO_EXECUTABLE ? { executablePath: process.env.LIVE_STUDIO_EXECUTABLE } : {}),
    args: process.env.LIVE_STUDIO_EXECUTABLE ? [] : ['.'],
    env,
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error') process.stdout.write(`RENDERER: ${message.text().slice(0, 500)}\n`);
  });
  await expect(page.locator('#logs')).toContainText('Live Studio pronto');
});
test.afterEach(async () => {
  if (app) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
  }
});
async function replaceCode(code: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(code);
}
test('offline: reproduz, atualiza ao vivo, recupera erro e analisa áudio real', async () => {
  await page.context().setOffline(true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const workletWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('could not load AudioWorklet')) workletWarnings.push(message.text());
  });
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await expect.poll(async () => page.locator('#peak-label').textContent()).not.toContain('−∞');
  await expect(page.locator('#logs')).toContainText('Padrão atualizado no scheduler.');
  await mkdir(join(root, 'docs/images'), { recursive: true });
  await page.screenshot({ path: join(root, 'docs/images/live-studio.png') });
  await replaceCode('note("c4 e4 g4").s("triangle").gain(0.3)');
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#error-banner')).toBeHidden();
  await page.locator('[data-visual=scope]').click();
  await expect(page.locator('#visual-description')).toContainText('Sinal real');
  await page.locator('[data-visual=spectrum]').click();
  await expect(page.locator('#visual-description')).toContainText('FFT');
  await page.locator('[data-visual=piano]').click();
  await replaceCode('note("c4").functionThatDoesNotExist()');
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#error-banner')).toBeVisible();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await page.locator('[data-action=restore]').click();
  await expect(page.locator('.cm-content')).toContainText('triangle');
  await page.locator('[data-action=stop]').click();
  await expect(page.locator('#playback-state')).toHaveText('Parado');
  await replaceCode('s("missing_library_sample")');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#logs')).toContainText(/missing_library_sample.*not found/);
  await page.locator('[data-action=stop]').click();
  expect(errors).toEqual([]);
  expect(workletWarnings).toEqual([]);
});
test('salva, abre, cria abas, configura e mantém recuperação de sessão', async () => {
  const path = join(data, 'roundtrip.live.json');
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as any;
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as any;
  }, path);
  await replaceCode('note("d4 f4 a4").s("sine")');
  await page.locator('[data-action=save]').click();
  await expect(page.locator('#dirty-label')).toHaveText('roundtrip.live.json');
  expect(JSON.parse(await readFile(path, 'utf8')).files[0].code).toContain('d4 f4');
  await page.locator('[data-action=new]').click();
  await expect(page.locator('.cm-content')).toContainText('sessão de abertura');
  await page.locator('[data-action=open]').click();
  await page.locator('[data-choice=discard]').click();
  await expect(page.locator('.cm-content')).toContainText('d4 f4');
  await page.locator('[data-action=addFile]').click();
  await page.locator('#text-value').fill('bass.strudel');
  await page.locator('[data-answer=accept]').click();
  await expect(page.locator('#file-tabs [role=tab]')).toHaveCount(2);
  await page.locator('[data-action=settings]').click();
  await page.locator('[data-setting=theme]').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('[data-section=editor]').click();
  await page.locator('[data-setting=runKey]').selectOption('Alt-Enter');
  await page.locator('[data-dialog=close]').first().click();
  await page.locator('#library-resizer').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('style', /--library-width: 250px/);
  await page.waitForTimeout(1200);
  const bootstrap = await page.evaluate(() => window.studio.bootstrap());
  expect(bootstrap.ok && bootstrap.value.recovery?.files).toHaveLength(2);
  expect(bootstrap.ok && bootstrap.value.settings.theme).toBe('light');
});
test('importa e toca sample local por protocolo restrito e impede IPC inválido', async () => {
  const path = join(data, 'test-tone.wav');
  const rate = 44100,
    frames = 11025,
    wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    wav.writeInt16LE(Math.round(Math.sin((i / rate) * 440 * 2 * Math.PI) * 8000), 44 + i * 2);
  await writeFile(path, wav);
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as any;
  }, path);
  await page.locator('[data-action=import]').click();
  await expect(page.locator('.sample-row')).toHaveCount(1);
  await page.locator('[data-preview]').click();
  await expect(page.locator('#logs')).toContainText('Pré-escuta:');
  await replaceCode('s("sample_test_tone*4").gain(0.4)');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await expect.poll(async () => page.locator('#peak-label').textContent()).not.toContain('−∞');
  const response = await page.evaluate(async () => {
    const b = await window.studio.bootstrap();
    if (!b.ok) return 0;
    const response = await fetch(`studio://sample/${b.value.samples[0].id}`);
    return (await response.arrayBuffer()).byteLength;
  });
  expect(response).toBe(wav.length);
  const invalid = await page.evaluate(() => window.studio.settings({ volume: 99 } as any));
  expect(invalid.ok).toBe(false);
  expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
});
test('recupera após encerramento e oferece confirmação ao fechar alterações', async () => {
  await replaceCode('note("a3 c4 e4").s("triangle").crush(8).gain(0.2)');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await page.waitForTimeout(1000);
  await app.evaluate(({ app }) => app.exit(0));
  await app.close();
  app = await electron.launch({
    ...(process.env.LIVE_STUDIO_EXECUTABLE ? { executablePath: process.env.LIVE_STUDIO_EXECUTABLE } : {}),
    args: process.env.LIVE_STUDIO_EXECUTABLE ? [] : ['.'],
    env: launchEnvironment,
  });
  page = await app.firstWindow();
  await expect(page.locator('.cm-content')).toContainText('a3 c4 e4');
  await expect(page.locator('#logs')).toContainText('Sessão não salva recuperada');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect(page.locator('[data-choice=cancel]')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await expect.poll(async () => page.locator('#peak-label').textContent()).not.toContain('−∞');
});
test('abre configurações MIDI reais e mantém o layout na janela mínima', async () => {
  await page.locator('#midi-status').click();
  await page.locator('[data-setting-action=connect-midi]').click();
  await expect(page.locator('#logs')).toContainText(/MIDI ativado|Não foi possível acessar MIDI/);
  await page.locator('[data-dialog=close]').first().click();
  const window = await app.browserWindow(page);
  await window.evaluate((window) => window.setSize(900, 700));
  await page.waitForTimeout(250);
  await expect(page.locator('.inspector')).toBeHidden();
  await page.screenshot({ path: join(root, 'docs/images/window-900.png') });
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflowing).toBe(false);
  await page.locator('[data-action=toggleInspector]').click();
  await expect(page.locator('.inspector')).toBeVisible();
  await page.locator('[data-action=toggleInspector]').click();
  await expect(page.locator('.inspector')).toBeHidden();
  await window.evaluate((window) => window.setSize(900, 620));
  await page.locator('#visual-resizer').focus();
  await page.keyboard.press('ArrowUp');
  const fits = await page.evaluate(
    () =>
      document.querySelector('#console-panel')!.getBoundingClientRect().bottom <=
      document.querySelector('.statusbar')!.getBoundingClientRect().top + 1,
  );
  expect(fits).toBe(true);
  await page.screenshot({ path: join(root, 'docs/images/window-900-min.png') });
});
