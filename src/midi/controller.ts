import * as strudelMidi from '@strudel/midi';
import type { StudioState } from '../state';
import { decodeCC, mappedValue } from './mapping';
export class MidiController extends EventTarget {
  access?: MIDIAccess;
  learning: 'volume' | 'bpm' | 'lpf' | 'pan' | null = null;
  lastMessage = 'Nenhuma mensagem recebida';
  private disposed = false;
  constructor(
    private state: StudioState,
    private apply: () => void,
  ) {
    super();
  }
  get inputs() {
    return [...(this.access?.inputs.values() ?? [])];
  }
  get outputs() {
    return [...(this.access?.outputs.values() ?? [])];
  }
  async connect() {
    if (!navigator.requestMIDIAccess) throw new Error('Web MIDI não está disponível neste ambiente.');
    try {
      this.access ??= await navigator.requestMIDIAccess({ sysex: false });
      await strudelMidi.WebMidi.enable({ sysex: false });
      this.access.onstatechange = () => {
        if (!this.disposed) this.refresh();
      };
      this.refresh();
      this.state.log(
        `MIDI ativado: ${this.inputs.length} entrada(s), ${this.outputs.length} saída(s).`,
        'success',
      );
    } catch (error) {
      throw new Error(`Não foi possível acessar MIDI: ${(error as Error).message}`);
    }
  }
  refresh() {
    for (const input of this.inputs)
      input.onmidimessage = (event) => this.message(input.name ?? '', event.data!);
    const output = this.state.project.midi.output;
    if (output && !this.outputs.some((p) => p.name === output && p.state === 'connected'))
      this.state.log(
        `Saída MIDI "${output}" indisponível. Reconecte a porta ou selecione outra saída.`,
        'error',
      );
    this.dispatchEvent(new Event('change'));
  }
  private message(input: string, data: Uint8Array) {
    const selected = this.state.project.midi.input;
    if (selected && selected !== input) return;
    this.lastMessage = `${input}: ${[...data].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`;
    const cc = decodeCC(data);
    if (cc) {
      if (this.learning) {
        const target = this.learning;
        this.state.project.midi.mappings = this.state.project.midi.mappings.filter(
          (m) => m.target !== target,
        );
        this.state.project.midi.mappings.push({ input, channel: cc.channel, cc: cc.cc, target });
        this.learning = null;
        this.state.modify();
        this.state.log(`MIDI Learn: CC ${cc.cc} → ${target}`, 'success');
      }
      for (const mapping of this.state.project.midi.mappings)
        if (mapping.input === input && mapping.channel === cc.channel && mapping.cc === cc.cc) {
          const value = mappedValue(mapping.target, cc.value);
          if (mapping.target === 'volume') {
            this.state.settings.volume = value;
            this.state.preference();
          } else if (mapping.target === 'bpm') this.state.project.bpm = value;
          else {
            this.state.project.parameters[mapping.target] = value;
            this.state.project.instrumentEnabled = true;
          }
          this.state.modify();
          this.apply();
        }
    }
    this.dispatchEvent(new Event('message'));
  }
  async testNote() {
    const output = this.outputs.find(
      (p) => p.name === this.state.project.midi.output && p.state === 'connected',
    );
    if (!output) throw new Error('Selecione uma saída MIDI conectada antes de enviar uma nota de teste.');
    const channel = this.state.project.midi.channel - 1;
    await output.open();
    output.send([0x90 | channel, 60, 80]);
    output.send([0x80 | channel, 60, 0], performance.now() + 180);
    this.state.log(`Note On/Off C4 enviado para ${output.name}, canal ${channel + 1}.`);
  }
  sendCC(controller: number, value: number) {
    const output = this.outputs.find(
      (p) => p.name === this.state.project.midi.output && p.state === 'connected',
    );
    if (!output) throw new Error('Selecione uma saída MIDI conectada.');
    if (![controller, value].every((n) => Number.isInteger(n) && n >= 0 && n <= 127))
      throw new Error('CC e valor devem estar entre 0 e 127.');
    output.send([0xb0 | (this.state.project.midi.channel - 1), controller, value]);
  }
  panic() {
    for (const output of this.outputs) {
      (output as MIDIOutput & { clear?: () => void }).clear?.();
      for (let c = 0; c < 16; c++) {
        output.send([0xb0 | c, 123, 0]);
        output.send([0xb0 | c, 120, 0]);
      }
    }
  }
  dispose() {
    this.disposed = true;
    this.panic();
    if (this.access) this.access.onstatechange = null;
    this.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    void strudelMidi.WebMidi.disable();
  }
}
