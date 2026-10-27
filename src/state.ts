import { createProject } from './shared/project';
import {
  settingsSchema,
  type Bootstrap,
  type Project,
  type Sample,
  type Settings,
  type Recent,
  type Result,
} from './shared/schema';
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
export type Log = { time: string; level: 'info' | 'error' | 'success'; message: string };
export class StudioState extends EventTarget {
  project: Project = createProject();
  settings: Settings = settingsSchema.parse({});
  samples: Sample[] = [];
  recents: Recent[] = [];
  logs: Log[] = [];
  dirty = false;
  filename = '';
  version = '0.1.0';
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private settingsTimer?: ReturnType<typeof setTimeout>;
  initialize(data: Bootstrap) {
    this.settings = data.settings;
    this.samples = data.samples;
    this.recents = data.recents;
    this.version = data.version;
    if (data.recovery) {
      this.project = data.recovery;
      this.dirty = true;
      this.log('Sessão não salva recuperada. Use Salvar como para preservar uma cópia.', 'info');
    }
    data.warnings.forEach((message) => this.log(message, 'error'));
    this.notify();
  }
  notify() {
    this.dispatchEvent(new Event('change'));
  }
  log(message: string, level: Log['level'] = 'info') {
    this.logs.push({ time: new Date().toLocaleTimeString('pt-BR'), level, message: message.slice(0, 1500) });
    this.logs = this.logs.slice(-200);
    this.dispatchEvent(new Event('log'));
  }
  modify(notify = true) {
    this.dirty = true;
    this.project.updatedAt = new Date().toISOString();
    clearTimeout(this.recoveryTimer);
    if (this.settings.autosave)
      this.recoveryTimer = setTimeout(() => {
        void this.flushRecovery().catch((error) => this.log(error.message, 'error'));
      }, 700);
    if (notify) this.notify();
    else this.dispatchEvent(new Event('dirty'));
  }
  async flushRecovery() {
    clearTimeout(this.recoveryTimer);
    unwrap(await window.studio.recovery(this.dirty ? this.project : null));
  }
  preference() {
    clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => {
      void window.studio
        .settings(this.settings)
        .then(unwrap)
        .catch((error) => this.log(error.message, 'error'));
    }, 300);
    this.dispatchEvent(new Event('preferences'));
  }
  async save(saveAs = false) {
    const snapshot = JSON.stringify(this.project);
    const result = unwrap(await window.studio.saveProject(this.project, saveAs));
    if (!result.saved) return false;
    this.filename = result.filename ?? '';
    if (snapshot === JSON.stringify(this.project)) this.dirty = false;
    await this.flushRecovery();
    this.log(`Projeto salvo: ${this.filename}`, 'success');
    this.notify();
    return true;
  }
}
