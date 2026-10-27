import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal';
import * as audio from '@strudel/webaudio';
import { transpiler } from '@strudel/transpiler';
import * as draw from '@strudel/draw';
import * as midi from '@strudel/midi';
import type { Project, Sample } from '../shared/schema';

/** Uses the published Cyclist scheduler. No parallel musical timing loop. */
export class MusicEngine extends EventTarget {
  private logListener = (event: Event) => {
    const { message, type } = (event as CustomEvent<{ message: string; type?: string }>).detail;
    this.onLog(
      String(message),
      type === 'error' || /error:|not found|failed/i.test(message) ? 'error' : 'info',
    );
  };
  onLog: (message: string, level: 'info' | 'error') => void = () => {};
  constructor() {
    super();
    document.addEventListener(core.logger.key, this.logListener);
  }
  repl: any;
  context!: AudioContext;
  analyser!: AnalyserNode;
  channels: AnalyserNode[] = [];
  private splitter?: ChannelSplitterNode;
  private master?: GainNode;
  private initialized?: Promise<void>;
  project?: Project;
  lastValidCode = '';
  private registration = new Map<string, string>();
  onError: (error: Error) => void = () => {};
  onEvaluated: (state: any) => void = () => {};
  get playing(): boolean {
    return !!this.repl?.state.started;
  }
  get pattern(): any {
    return this.repl?.state.pattern;
  }
  get now(): number {
    return this.repl ? Math.max(0, this.repl.scheduler.now()) : 0;
  }

  init(): Promise<void> {
    return (this.initialized ??= this.initialize().catch((error) => {
      this.initialized = undefined;
      throw error;
    }));
  }
  private async initialize() {
    audio.setLogger(core.logger);
    this.context = audio.getAudioContext();
    mini.miniAllStrings();
    await core.evalScope(core, mini, tonal, audio, draw, midi);
    await audio.registerSynthSounds();
    await audio.initAudio();
    this.repl = audio.webaudioRepl({
      transpiler,
      beforeStart: () => this.context.resume(),
      onEvalError: (error: Error) => this.onError(error),
      editPattern: (pattern: any) => {
        if (this.project?.instrumentEnabled)
          for (const [key, value] of Object.entries(this.project.parameters)) pattern = pattern[key](value);
        if (this.project?.midi.output)
          pattern = pattern.midichan(this.project.midi.channel).midi(this.project.midi.output);
        return pattern;
      },
      onToggle: () => this.dispatchEvent(new Event('change')),
      afterEval: () => {
        this.onEvaluated(this.repl.state);
        this.dispatchEvent(new Event('change'));
      },
    });
    this.master = audio.getSuperdoughAudioController().output.destinationGain;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.splitter = this.context.createChannelSplitter(2);
    this.channels = [this.context.createAnalyser(), this.context.createAnalyser()];
    this.master!.connect(this.analyser);
    this.master!.connect(this.splitter);
    this.channels.forEach((node, i) => {
      node.fftSize = 1024;
      this.splitter!.connect(node, i);
    });
    // Analysis nodes are taps only: they never reconnect to the destination.
    this.dispatchEvent(new Event('change'));
  }
  async evaluate(code: string, project: Project): Promise<boolean> {
    await this.init();
    this.project = project;
    await this.context.resume();
    this.setBpm(project.bpm);
    await this.repl.evaluate(code);
    if (this.repl.state.evalError) return false;
    this.lastValidCode = code;
    return true;
  }
  setBpm(bpm: number) {
    this.repl?.setCps(bpm / 240);
  }
  setVolume(value: number) {
    if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
  async setOutput(id: string) {
    await this.init();
    const context = this.context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (!context.setSinkId) {
      if (id)
        throw new Error(
          'Esta versão do Chromium não oferece seleção de saída. Use a configuração de som do Windows.',
        );
      return;
    }
    try {
      await context.setSinkId(id);
    } catch {
      await context.setSinkId('');
      throw new Error('Saída de áudio indisponível. A saída padrão do Windows foi restaurada.');
    }
  }
  async registerSamples(samples: Sample[]) {
    await this.init();
    for (const sample of samples) {
      const version = `${sample.name}:${sample.revision ?? ''}`;
      if (sample.missing || this.registration.get(sample.id) === version) continue;
      await audio.samples({ [sample.name]: [this.sampleUrl(sample)] });
      this.registration.set(sample.id, version);
    }
  }
  async preview(sample: Sample) {
    await this.registerSamples([sample]);
    await this.context.resume();
    const buffer = await audio.loadBuffer(this.sampleUrl(sample), this.context, sample.name);
    await audio.superdough({ s: sample.name, gain: 0.45 }, this.context.currentTime + 0.03, 1, 0.5);
    return buffer.duration as number;
  }
  private sampleUrl(sample: Sample) {
    return `studio://sample/${sample.id}${sample.revision ? '/' + sample.revision : ''}`;
  }
  stop() {
    this.repl?.stop();
    for (const output of midi.WebMidi.outputs ?? []) {
      output.clear?.();
      for (let channel = 1; channel <= 16; channel++) {
        output.channels[channel]?.sendAllSoundOff();
        output.channels[channel]?.sendAllNotesOff();
      }
    }
    this.dispatchEvent(new Event('change'));
  }
  async restart(code: string, project: Project) {
    this.stop();
    return this.evaluate(code, project);
  }
  async dispose() {
    document.removeEventListener(core.logger.key, this.logListener);
    this.stop();
    this.master?.disconnect(this.analyser);
    this.master?.disconnect(this.splitter!);
    this.splitter?.disconnect();
    this.channels.forEach((a) => a.disconnect());
    this.analyser?.disconnect();
    await this.context?.close();
  }
}
