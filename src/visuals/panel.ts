import { __pianoroll } from '@strudel/draw';
import type { StudioState } from '../state';
import type { MusicEngine } from '../engine/engine';
import type { MusicalEditor } from '../ui/editor';
import { $, icon, refreshIcons } from '../ui/dom';
import { amplitudeToDb, meterPercent, peakAmplitude } from './analysis';

export class VisualPanel {
  private canvas = $<HTMLCanvasElement>('#visual-canvas');
  private ctx = this.canvas.getContext('2d')!;
  private request = 0;
  private previous = 0;
  private lastMetrics = 0;
  private clipUntil = 0;
  private time = new Float32Array(2048);
  private frequency = new Uint8Array(1024);
  private meter = new Float32Array(1024);
  private observer: ResizeObserver;
  private failed = false;
  constructor(
    private state: StudioState,
    private engine: MusicEngine,
    private editor: MusicalEditor,
  ) {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    $('#visual-tabs').addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-visual]');
      if (tab) {
        state.project.visuals.mode = tab.dataset.visual as typeof state.project.visuals.mode;
        state.modify();
        this.configure();
      }
    });
    $('#pause-visual').addEventListener('click', () => {
      state.project.visuals.paused = !state.project.visuals.paused;
      state.modify();
      this.configure();
    });
    state.addEventListener('change', () => {
      this.failed = false;
      this.configure();
    });
    this.configure();
    this.request = requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const ratio = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * ratio);
    this.canvas.height = Math.round(this.canvas.clientHeight * ratio);
  }
  configure() {
    const v = this.state.project.visuals;
    document
      .querySelectorAll<HTMLElement>('[data-visual]')
      .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.visual === v.mode)));
    $('#pause-visual').setAttribute('aria-pressed', String(v.paused));
    $('#pause-visual').innerHTML = icon(v.paused ? 'play' : 'pause');
    refreshIcons();
    $('#pause-visual').setAttribute('aria-label', v.paused ? 'Retomar visualização' : 'Pausar visualização');
    $('#visual-description').textContent = {
      piano: 'Notas · duração · posição no ciclo',
      scope: `Sinal real · escala ${v.scale.toFixed(2)}×`,
      spectrum: `FFT ${v.fft} · frequência (Hz)`,
      rhythm: 'Eventos reais · ciclos / subdivisões',
    }[v.mode];
    $('#visual-fps').textContent = `${v.fps} fps${v.paused ? ' · pausado' : ''}`;
    if (this.engine.analyser) {
      this.engine.analyser.fftSize = v.fft;
      this.time = new Float32Array(v.fft);
      this.frequency = new Uint8Array(v.fft / 2);
    }
  }
  frame(timestamp: number) {
    this.request = requestAnimationFrame((t) => this.frame(t));
    if (document.hidden || timestamp - this.previous < 1000 / this.state.project.visuals.fps) return;
    this.previous = timestamp;
    try {
      this.draw(timestamp);
    } catch (error) {
      if (!this.failed) {
        this.failed = true;
        this.state.log(`Visualização: ${(error as Error).message}`, 'error');
      }
    }
  }
  draw(timestamp: number) {
    const engine = this.engine,
      v = this.state.project.visuals;
    const now = engine.now,
      pattern = engine.pattern;
    const code = this.state.project.files.find((f) => f.id === this.state.project.activeFile)?.code;
    if (engine.playing && pattern && code === engine.lastValidCode) {
      const active = pattern
        .queryArc(now, now + 0.0001)
        .filter((h: any) => h.whole && h.whole.begin <= now && h.endClipped > now);
      this.editor.highlight(active, true);
    } else this.editor.highlight([], false);
    const beats = now * 4;
    $('#cycle').textContent = `${String(Math.floor(now) + 1).padStart(3, '0')}:${Math.floor(beats % 4) + 1}`;
    if (engine.analyser) this.meters(timestamp);
    if (timestamp - this.lastMetrics > 1000) {
      this.lastMetrics = timestamp;
      this.metrics();
    }
    if (v.paused) return;
    const width = this.canvas.width,
      height = this.canvas.height;
    if (!width || !height) return;
    const ctx = this.ctx;
    const css = getComputedStyle(document.documentElement),
      bg = css.getPropertyValue('--bg').trim(),
      accent = css.getPropertyValue('--accent').trim(),
      muted = css.getPropertyValue('--muted').trim();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    $('#visual-empty').hidden =
      !!pattern || ((v.mode === 'scope' || v.mode === 'spectrum') && !!engine.analyser);
    if (v.mode === 'piano' && pattern) {
      const haps = pattern
        .queryArc(Math.max(0, now - 1), now + 3)
        .filter((h: any) => h.whole)
        .slice(0, 4096);
      __pianoroll({
        ctx,
        time: now,
        haps,
        cycles: 4,
        playhead: 0.25,
        fold: 0,
        minMidi: 35,
        maxMidi: 84,
        fill: true,
        fillActive: true,
        active: css.getPropertyValue('--green').trim(),
        inactive: accent,
        background: bg,
        playheadColor: muted,
        labels: 1,
        fontFamily: 'Fira Code',
      });
    } else if (v.mode === 'scope' && engine.analyser) {
      engine.analyser.getFloatTimeDomainData(this.time as Float32Array<ArrayBuffer>);
      ctx.strokeStyle = css.getPropertyValue('--border').trim();
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6 * devicePixelRatio;
      ctx.beginPath();
      for (let i = 0; i < this.time.length; i++) {
        const x = (i / (this.time.length - 1)) * width,
          y = height / 2 - ((this.time[i] * height) / 2) * v.scale;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else if (v.mode === 'spectrum' && engine.analyser) {
      engine.analyser.getByteFrequencyData(this.frequency as Uint8Array<ArrayBuffer>);
      const nyquist = engine.context.sampleRate / 2,
        bars = 100;
      ctx.fillStyle = accent;
      for (let i = 0; i < bars; i++) {
        const from = Math.floor(((20 * Math.pow(nyquist / 20, i / bars)) / nyquist) * this.frequency.length);
        const to = Math.max(
          from + 1,
          Math.ceil(((20 * Math.pow(nyquist / 20, (i + 1) / bars)) / nyquist) * this.frequency.length),
        );
        let level = 0;
        for (let bin = from; bin < Math.min(to, this.frequency.length); bin++)
          level = Math.max(level, this.frequency[bin]);
        const h = (level / 255) * (height - 24 * devicePixelRatio);
        ctx.fillRect(
          (i / bars) * width,
          height - 20 * devicePixelRatio - h,
          Math.max(1, width / bars - 2),
          h,
        );
      }
      ctx.fillStyle = muted;
      ctx.font = `${10 * devicePixelRatio}px Fira Code`;
      for (const hz of [20, 100, 1000, 10000])
        ctx.fillText(
          hz >= 1000 ? `${hz / 1000}k` : String(hz),
          (Math.log(hz / 20) / Math.log(nyquist / 20)) * (width - 30),
          height - 4 * devicePixelRatio,
        );
    } else if (v.mode === 'rhythm' && pattern) {
      const cycle = Math.floor(now),
        haps = pattern.queryArc(cycle, cycle + 1).filter((h: any) => h.hasOnset());
      ctx.strokeStyle = css.getPropertyValue('--border').trim();
      for (let i = 0; i <= 16; i++) {
        const x = (i / 16) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      haps.slice(0, 2048).forEach((h: any, i: number) => {
        ctx.fillStyle =
          h.whole.begin <= now && h.endClipped > now ? css.getPropertyValue('--green').trim() : accent;
        const x = (Number(h.whole.begin) - cycle) * width;
        ctx.fillRect(
          x,
          12 + ((i % 6) * (height - 24)) / 6,
          Math.max(3, Number(h.duration) * width - 2),
          Math.max(3, (height - 24) / 6 - 4),
        );
      });
      ctx.strokeStyle = muted;
      ctx.beginPath();
      ctx.moveTo((now - cycle) * width, 0);
      ctx.lineTo((now - cycle) * width, height);
      ctx.stroke();
    }
  }
  meters(timestamp: number) {
    const peaks = this.engine.channels.map((node) => {
      node.getFloatTimeDomainData(this.meter as Float32Array<ArrayBuffer>);
      return peakAmplitude(this.meter);
    });
    const peak = Math.max(...peaks);
    if (peak >= 1) this.clipUntil = timestamp + 2000;
    const clipped = timestamp < this.clipUntil;
    ['l', 'r'].forEach((channel, index) => {
      const bar = $(`#meter-${channel}`);
      bar.style.width = `${meterPercent(peaks[index])}%`;
      bar.classList.toggle('clipped', clipped);
    });
    $('#peak-label').textContent =
      `${Number.isFinite(amplitudeToDb(peak)) ? amplitudeToDb(peak).toFixed(1) : '−∞'} dBFS`;
    $('#clip-indicator').textContent = clipped
      ? 'Clipping detectado · reduza o volume'
      : 'Sem clipping detectado';
    $('#clip-indicator').classList.toggle('clipped', clipped);
  }
  metrics() {
    if (this.engine.context)
      $('#audio-status').textContent =
        `${this.engine.context.state === 'running' ? 'Áudio ativo' : 'Áudio suspenso'} · ${this.engine.context.sampleRate / 1000} kHz`;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (memory)
      $('#memory-status').textContent = `Heap JS ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(0)} MB`;
  }
  dispose() {
    cancelAnimationFrame(this.request);
    this.observer.disconnect();
  }
}
