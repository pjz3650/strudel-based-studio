import type { StudioState } from '../state';
import { parametersSchema, type Parameters } from '../shared/schema';
import { $, askText } from './dom';
export const controls: {
  key: keyof Parameters;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}[] = [
  { key: 'gain', label: 'Volume', min: 0, max: 1, step: 0.01 },
  { key: 'attack', label: 'Attack', min: 0, max: 4, step: 0.01, unit: 's' },
  { key: 'decay', label: 'Decay', min: 0, max: 4, step: 0.01, unit: 's' },
  { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01 },
  { key: 'release', label: 'Release', min: 0, max: 8, step: 0.01, unit: 's' },
  { key: 'lpf', label: 'Filtro low-pass', min: 40, max: 20000, step: 10, unit: 'Hz' },
  { key: 'lpq', label: 'Ressonância', min: 0, max: 20, step: 0.1 },
  { key: 'room', label: 'Reverb', min: 0, max: 1, step: 0.01 },
  { key: 'delay', label: 'Delay', min: 0, max: 0.95, step: 0.01 },
  { key: 'pan', label: 'Pan', min: 0, max: 1, step: 0.01 },
];
export class InstrumentView {
  constructor(
    private state: StudioState,
    private reapply: () => void,
  ) {
    $('#instrument-controls').innerHTML = controls
      .map(
        (c) =>
          `<label class="parameter"><span>${c.label}<output id="value-${c.key}"></output></span><input type="range" data-param="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" aria-label="${c.label}"></label>`,
      )
      .join('');
    $('#instrument-controls').addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const key = input.dataset.param as keyof Parameters;
      if (!key) return;
      state.project.parameters[key] = Number(input.value);
      state.modify(false);
      this.values();
    });
    $('#instrument-controls').addEventListener('change', () => {
      if (state.project.instrumentEnabled) reapply();
    });
    $('#instrument-enabled').addEventListener('change', (e) => {
      state.project.instrumentEnabled = (e.target as HTMLInputElement).checked;
      state.modify();
      reapply();
    });
    $('#save-preset').addEventListener('click', () => {
      void this.save().catch((e) => state.log(e.message, 'error'));
    });
    $('#reset-instrument').addEventListener('click', () => {
      state.project.parameters = parametersSchema.parse({});
      state.modify();
      reapply();
    });
    state.addEventListener('change', () => this.render());
    this.render();
  }
  render() {
    $('#instrument-enabled').toggleAttribute('checked', this.state.project.instrumentEnabled);
    $<HTMLInputElement>('#instrument-enabled').checked = this.state.project.instrumentEnabled;
    document.querySelectorAll<HTMLInputElement>('[data-param]').forEach((input) => {
      input.value = String(this.state.project.parameters[input.dataset.param as keyof Parameters]);
    });
    this.values();
  }
  values() {
    for (const c of controls)
      $(`#value-${c.key}`).textContent =
        `${this.state.project.parameters[c.key].toFixed(c.key === 'lpf' ? 0 : 2)}${c.unit ? ' ' + c.unit : ''}`;
  }
  async save() {
    const name = await askText('Salvar preset', 'Nome do preset');
    if (!name) return;
    this.state.project.presets.push({
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      parameters: structuredClone(this.state.project.parameters),
    });
    this.state.modify();
    this.state.log(`Preset salvo: ${name}`, 'success');
  }
}
