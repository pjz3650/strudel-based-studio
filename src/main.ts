import './styles/studio.css';
import { StudioState, unwrap } from './state';
import { createProject, duplicateProject } from './shared/project';
import { settingsSchema } from './shared/schema';
import { MusicEngine } from './engine/engine';
import { MidiController } from './midi/controller';
import { renderShell } from './ui/shell';
import { MusicalEditor } from './ui/editor';
import { LibraryView } from './ui/library';
import { InstrumentView } from './ui/instrument';
import { SettingsView } from './ui/settings';
import { VisualPanel } from './visuals/panel';
import { showHelp } from './ui/help';
import { $, askText, confirmChanges, escape, icon, refreshIcons } from './ui/dom';

renderShell();
refreshIcons();
const state = new StudioState(),
  engine = new MusicEngine();
engine.onLog = (message, level) => state.log(message, level);
let editor: MusicalEditor,
  library: LibraryView,
  visuals: VisualPanel,
  settings: SettingsView,
  midi: MidiController;
let evaluating = false,
  closing = false;
let narrowInspectorOpen = false;
let reapplyTimer: ReturnType<typeof setTimeout>;
function report(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  state.log(message, 'error');
  $('#error-banner').hidden = false;
  $('#error-banner>span').textContent = message;
}
function runSafe(task: () => Promise<unknown> | unknown) {
  try {
    Promise.resolve(task()).catch(report);
  } catch (e) {
    report(e);
  }
}
async function run(restart = false) {
  if (evaluating) return;
  evaluating = true;
  const button = $<HTMLButtonElement>('[data-action=play]');
  button.disabled = true;
  try {
    const project = state.project;
    await engine.init();
    engine.setVolume(state.settings.volume);
    if (project.midi.output && !midi.access) await midi.connect();
    await engine.registerSamples(state.samples);
    const code = project.files.find((f) => f.id === project.activeFile)!.code;
    const valid = restart ? await engine.restart(code, project) : await engine.evaluate(code, project);
    if (valid) {
      $('#error-banner').hidden = true;
      $('#restore-code').hidden = true;
      state.log(restart ? 'Padrão reiniciado.' : 'Padrão atualizado no scheduler.', 'success');
      if (state.settings.audioDevice) {
        try {
          await engine.setOutput(state.settings.audioDevice);
        } catch (e) {
          state.settings.audioDevice = '';
          state.preference();
          report(e);
        }
      }
    }
    visuals.configure();
  } finally {
    evaluating = false;
    button.disabled = false;
    transport();
  }
}
function stop() {
  engine.stop();
  midi?.panic();
  editor?.highlight([], false);
  state.log('Reprodução interrompida.');
  transport();
}
function reapply() {
  clearTimeout(reapplyTimer);
  engine.setVolume(state.settings.volume);
  engine.setBpm(state.project.bpm);
  if (engine.playing && state.project.instrumentEnabled)
    reapplyTimer = setTimeout(() => runSafe(() => run()), 120);
}
function applyPreferences() {
  const s = state.settings,
    p = state.project,
    root = document.documentElement;
  settingsSchema.parse(s);
  root.dataset.theme = s.theme;
  root.style.setProperty('--accent', s.accent === '#22D3EE' && s.theme === 'light' ? '#087c8e' : s.accent);
  root.style.setProperty('--editor-size', `${s.fontSize}px`);
  root.style.setProperty(
    '--code-font',
    s.font === 'fira' ? "'Fira Code',Consolas,monospace" : 'Consolas,monospace',
  );
  const visualCap = Math.max(
    130,
    $('.center').clientHeight - 43 - 120 - 29 - 4 - (p.layout.console ? 128 : 0),
  );
  const visualHeight = Math.min(p.layout.visualHeight, visualCap);
  root.style.setProperty('--library-width', `${p.layout.libraryWidth}px`);
  root.style.setProperty('--visual-height', `${visualHeight}px`);
  $('.workspace').classList.toggle('no-inspector', !p.layout.inspector);
  $('#console-panel').hidden = !p.layout.console;
  $('.workspace').classList.toggle('reveal-inspector', narrowInspectorOpen && p.layout.inspector);
  $('[data-action=toggleInspector]').setAttribute(
    'aria-expanded',
    String(p.layout.inspector && (innerWidth > 1000 || narrowInspectorOpen)),
  );
  document
    .querySelectorAll('[data-action=toggleConsole]')
    .forEach((b) => b.setAttribute('aria-expanded', String(p.layout.console)));
  for (const [id, value, min, max] of [
    ['library-resizer', p.layout.libraryWidth, 170, 420],
    ['visual-resizer', visualHeight, 130, visualCap],
  ] as const) {
    const separator = $(`#${id}`);
    separator.setAttribute('aria-valuenow', String(Math.round(value)));
    separator.setAttribute('aria-valuemin', String(min));
    separator.setAttribute('aria-valuemax', String(max));
  }
  $<HTMLInputElement>('#master-volume').value = String(s.volume);
  $('#master-value').textContent = `${Math.round(s.volume * 100)}%`;
  $('#run-key').textContent = s.runKey === 'Ctrl-Enter' ? 'Ctrl ↵' : 'Alt ↵';
  engine.setVolume(s.volume);
  editor?.configure(s, () => runSafe(() => run()));
  visuals?.configure();
}
function transport() {
  const playing = engine.playing;
  $('[data-action=play]').setAttribute('aria-pressed', String(playing));
  $('#playback-state').textContent = playing ? 'Tocando' : 'Parado';
  $('#engine-state').textContent = engine.context
    ? `SuperDough · ${engine.context.state}`
    : 'Motor aguardando';
  document.title = `${state.dirty ? '● ' : ''}${state.project.name} — Live Studio`;
  $('#project-name').textContent = state.project.name;
  $('#dirty-label').textContent = state.dirty ? 'Alterações não salvas' : state.filename || 'Sessão local';
  if (document.activeElement !== $('#bpm')) $<HTMLInputElement>('#bpm').value = String(state.project.bpm);
}
function renderTabs() {
  $('#file-tabs').innerHTML = state.project.files
    .map(
      (f) =>
        `<button role="tab" data-file-tab="${f.id}" aria-selected="${f.id === state.project.activeFile}">${icon('file-code-2')}${escape(f.name)}</button>`,
    )
    .join('');
  refreshIcons();
}
function switchFile(id: string) {
  const file = state.project.files.find((f) => f.id === id);
  if (!file) return;
  state.project.activeFile = id;
  editor.switch(id, file.code);
  state.modify();
  renderTabs();
}
function logs() {
  $('#logs').innerHTML = state.logs
    .map(
      (log) =>
        `<div class="log ${log.level}"><time>${log.time}</time><span>${escape(log.message)}</span></div>`,
    )
    .join('');
  $('#logs').scrollTop = $('#logs').scrollHeight;
}
async function unsaved(): Promise<boolean> {
  if (!state.dirty) return true;
  const answer = await confirmChanges();
  if (answer === 'cancel') return false;
  if (answer === 'save') return state.save();
  return true;
}
async function adoptProject(project: typeof state.project) {
  stop();
  state.project = project;
  state.dirty = false;
  state.filename = '';
  editor.reset();
  const file = project.files.find((f) => f.id === project.activeFile)!;
  editor.switch(file.id, file.code);
  await state.flushRecovery();
  state.notify();
  applyPreferences();
  renderTabs();
  const missing = project.samples.filter((ref) => !state.samples.some((s) => s.id === ref.id && !s.missing));
  if (missing.length)
    state.log(
      `${missing.length} referência(s) de samples não estão disponíveis nesta biblioteca. Importe ou reassocie os arquivos para restaurar os sons.`,
      'error',
    );
}
async function openProject(id?: string) {
  if (!(await unsaved())) return;
  const project = unwrap(await window.studio.openProject(id));
  if (project) {
    await adoptProject(project);
    state.log(`Projeto aberto: ${project.name}`, 'success');
  }
}
async function command(action: string) {
  if (action === 'play') return run();
  if (action === 'stop') return stop();
  if (action === 'restart') return run(true);
  if (action === 'save' || action === 'saveAs') {
    state.project.samples = state.samples.map((s) => ({ id: s.id, name: s.name }));
    await state.save(action === 'saveAs');
    state.recents = unwrap(await window.studio.bootstrap()).recents;
    library.render();
  }
  if (action === 'open') return openProject();
  if (action === 'new' || action === 'duplicate') {
    if (!(await unsaved())) return;
    const project = action === 'duplicate' ? duplicateProject(state.project) : createProject();
    if (action === 'new') {
      project.layout = structuredClone(state.settings.layout);
      project.visuals = structuredClone(state.settings.visuals);
      project.midi = structuredClone(state.settings.midi);
    }
    unwrap(await window.studio.releaseProject());
    await adoptProject(project);
    state.modify();
  }
  if (action === 'rename') {
    const name = await askText('Renomear projeto', 'Nome do projeto', state.project.name);
    if (name) {
      state.project.name = name;
      state.modify();
    }
  }
  if (action === 'addFile') {
    if (state.project.files.length >= 32) throw new Error('O projeto já tem 32 abas.');
    const name = await askText(
      'Nova aba',
      'Nome do arquivo',
      `pattern-${state.project.files.length + 1}.strudel`,
    );
    if (name) {
      const id = crypto.randomUUID();
      state.project.files.push({
        id,
        name,
        code: '// Novo padrão\n\nnote("c4 e4 g4").s("triangle").gain(0.3)\n',
      });
      switchFile(id);
    }
  }
  if (action === 'renameFile') {
    const file = state.project.files.find((f) => f.id === state.project.activeFile)!;
    const name = await askText('Renomear aba', 'Nome do arquivo', file.name);
    if (name) {
      file.name = name;
      state.modify();
      renderTabs();
    }
  }
  if (action === 'closeFile') {
    if (state.project.files.length === 1) throw new Error('Mantenha pelo menos uma aba no projeto.');
    const answer = await askText('Fechar aba', 'Digite FECHAR para remover esta aba do projeto');
    if (answer === 'FECHAR') {
      state.project.files = state.project.files.filter((f) => f.id !== state.project.activeFile);
      switchFile(state.project.files[0].id);
    }
  }
  if (action === 'import' || action === 'importFolder') {
    state.samples = unwrap(await window.studio.importSamples(action === 'importFolder'));
    await engine.registerSamples(state.samples);
    engine.setVolume(state.settings.volume);
    state.project.samples = state.samples.map((s) => ({ id: s.id, name: s.name }));
    state.modify();
    library.mode = 'samples';
    library.render();
    state.log(`Biblioteca: ${state.samples.length} samples disponíveis.`);
  }
  if (action === 'scan') {
    state.samples = unwrap(await window.studio.scanSamples());
    state.notify();
    state.log('Verificação da biblioteca concluída.');
  }
  if (action === 'settings' || action === 'settingsMidi')
    return settings.open(action === 'settingsMidi' ? 'midi' : 'appearance');
  if (action === 'help') showHelp();
  if (action === 'clearLogs') {
    state.logs = [];
    logs();
  }
  if (action === 'toggleConsole' || action === 'toggleInspector') {
    const key = action === 'toggleConsole' ? 'console' : 'inspector';
    if (key === 'inspector' && innerWidth <= 1000) {
      narrowInspectorOpen = !narrowInspectorOpen;
      state.project.layout.inspector = narrowInspectorOpen;
    } else state.project.layout[key] = !state.project.layout[key];
    state.modify();
    applyPreferences();
  }
  if (action === 'layout') {
    state.project.layout = { libraryWidth: 240, visualHeight: 230, inspector: true, console: true };
    state.modify();
    applyPreferences();
  }
  if (action === 'restore' && engine.lastValidCode) {
    editor.replace(engine.lastValidCode);
    $('#error-banner').hidden = true;
    $('#restore-code').hidden = true;
  }
  if (action === 'dismissError') $('#error-banner').hidden = true;
}
function setupResizers() {
  for (const [id, direction, key, min, max] of [
    ['library-resizer', 'x', 'libraryWidth', 170, 420],
    ['visual-resizer', 'y', 'visualHeight', 130, 480],
  ] as const) {
    const separator = $(`#${id}`);
    separator.addEventListener('pointerdown', (event) => {
      separator.setPointerCapture(event.pointerId);
      const start = direction === 'x' ? event.clientX : event.clientY,
        initial = state.project.layout[key];
      const move = (e: PointerEvent) => {
        state.project.layout[key] = Math.max(
          min,
          Math.min(
            max,
            initial + ((direction === 'x' ? e.clientX : e.clientY) - start) * (direction === 'x' ? 1 : -1),
          ),
        );
        applyPreferences();
      };
      const up = () => {
        separator.removeEventListener('pointermove', move);
        state.settings.layout = structuredClone(state.project.layout);
        state.preference();
        state.modify();
      };
      separator.addEventListener('pointermove', move);
      separator.addEventListener('pointerup', up, { once: true });
    });
    separator.addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const delta = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 10 : -10;
        state.project.layout[key] = Math.max(min, Math.min(max, state.project.layout[key] + delta));
        state.modify();
        applyPreferences();
      }
    });
  }
}
async function boot() {
  if (!window.studio)
    throw new Error('Abra o Live Studio pelo aplicativo Electron. Use pnpm dev no desenvolvimento.');
  state.initialize(unwrap(await window.studio.bootstrap()));
  editor = new MusicalEditor(
    $('#code-editor'),
    (code) => {
      const file = state.project.files.find((f) => f.id === state.project.activeFile)!;
      file.code = code;
      state.modify(false);
    },
    () => runSafe(() => run()),
    stop,
    state.settings,
  );
  const file = state.project.files.find((f) => f.id === state.project.activeFile)!;
  editor.switch(file.id, file.code);
  midi = new MidiController(state, reapply);
  library = new LibraryView(state, engine, editor, (id) => runSafe(() => openProject(id)), switchFile);
  new InstrumentView(state, () => {
    if (engine.playing) runSafe(() => run());
  });
  visuals = new VisualPanel(state, engine, editor);
  settings = new SettingsView(state, engine, midi, (setting) => {
    if (setting === 'inspector') narrowInspectorOpen = state.project.layout.inspector;
    applyPreferences();
    reapply();
  });
  engine.onError = (error) => {
    report(error);
    editor.error(error);
    $('#restore-code').hidden = !engine.lastValidCode;
  };
  engine.addEventListener('change', transport);
  state.addEventListener('change', () => {
    transport();
    renderTabs();
    applyPreferences();
  });
  state.addEventListener('dirty', transport);
  state.addEventListener('log', logs);
  state.addEventListener('preferences', applyPreferences);
  const midiStatus = () => {
    $('#midi-status').textContent = midi.access
      ? `MIDI · ${midi.inputs.length} in / ${midi.outputs.length} out`
      : 'MIDI desativado';
  };
  midi.addEventListener('change', midiStatus);
  midi.addEventListener('message', () => {
    const message = document.getElementById('midi-message');
    if (message) message.textContent = midi.lastMessage;
  });
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (button) runSafe(() => command(button.dataset.action!));
  });
  $('#file-tabs').addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-file-tab]');
    if (tab) switchFile(tab.dataset.fileTab!);
  });
  $('#bpm').addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.reportValidity() || !Number.isFinite(input.valueAsNumber)) {
      input.value = String(state.project.bpm);
      return;
    }
    state.project.bpm = input.valueAsNumber;
    engine.setBpm(input.valueAsNumber);
    state.modify();
  });
  $('#master-volume').addEventListener('input', (event) => {
    state.settings.volume = Number((event.target as HTMLInputElement).value);
    state.preference();
  });
  window.studio.onMenu((action) => runSafe(() => command(action)));
  window.studio.onClose(() =>
    runSafe(async () => {
      if (closing) return;
      closing = true;
      try {
        if (!(await unsaved())) return;
        stop();
        await window.studio.settings(state.settings).then(unwrap);
        await window.studio.recovery(null).then(unwrap);
        visuals.dispose();
        editor.dispose();
        midi.dispose();
        await engine.dispose();
        window.studio.readyToClose();
      } finally {
        closing = false;
      }
    }),
  );
  document.addEventListener('keydown', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[role=tab]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const list = tab.closest<HTMLElement>('[role=tablist]')!;
      const tabs = [...list.querySelectorAll<HTMLElement>('[role=tab]')],
        index = tabs.indexOf(tab);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      const listId = list.id;
      tabs[next].click();
      const currentList = listId
        ? document.getElementById(listId)
        : document.querySelector('dialog[open] [role=tablist]');
      currentList?.querySelector<HTMLElement>('[aria-selected=true]')?.focus();
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    if (event.ctrlKey && event.key === '.') {
      event.preventDefault();
      stop();
    }
    if (
      (event.ctrlKey && event.key === 'Enter' && state.settings.runKey === 'Ctrl-Enter') ||
      (event.altKey && event.key === 'Enter' && state.settings.runKey === 'Alt-Enter')
    ) {
      event.preventDefault();
      runSafe(() => run());
    }
  });
  window.addEventListener('error', (event) => report(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => {
    report(event.reason);
    event.preventDefault();
  });
  window.addEventListener('resize', applyPreferences);
  const tabObserver = new MutationObserver(() =>
    document.querySelectorAll<HTMLElement>('[role=tab]').forEach((tab) => {
      const value = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      if (tab.tabIndex !== value) tab.tabIndex = value;
    }),
  );
  tabObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected'],
  });
  setupResizers();
  renderTabs();
  applyPreferences();
  transport();
  logs();
  state.log('Live Studio pronto. Sintetizadores e recursos locais disponíveis offline.');
}
void boot().catch(report);
