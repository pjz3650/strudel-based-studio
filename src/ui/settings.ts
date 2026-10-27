import type { StudioState } from '../state';
import { unwrap } from '../state';
import type { MusicEngine } from '../engine/engine';
import type { MidiController } from '../midi/controller';
import { modal, escape, field, refreshIcons } from './dom';
export class SettingsView {
  private dialog?: HTMLDialogElement;
  private section = 'appearance';
  private outputs: MediaDeviceInfo[] = [];
  constructor(
    private state: StudioState,
    private engine: MusicEngine,
    private midi: MidiController,
    private apply: (setting?: string) => void,
  ) {
    midi.addEventListener('change', () => {
      if (this.dialog?.open && this.section === 'midi') this.render();
    });
    midi.addEventListener('message', () => {
      if (
        this.dialog?.open &&
        this.section === 'midi' &&
        !midi.learning &&
        this.dialog.querySelector('[data-setting-action=learn]')?.textContent?.includes('Cancelar')
      )
        this.render();
    });
  }
  async open(section = 'appearance') {
    if (this.dialog?.open) {
      this.section = section;
      this.render();
      return;
    }
    this.section = section;
    try {
      this.outputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === 'audiooutput',
      );
    } catch {
      this.outputs = [];
    }
    this.dialog = modal('Configurações', '');
    this.dialog.addEventListener('change', (event) => {
      void this.change(event).catch((e) => this.state.log(e.message, 'error'));
    });
    this.dialog.addEventListener('click', (event) => {
      void this.click(event).catch((e) => this.state.log(e.message, 'error'));
    });
    this.render();
  }
  render() {
    if (!this.dialog?.open) return;
    const s = this.state.settings,
      p = this.state.project;
    const select = (key: string, value: string, options: [string, string][]) =>
      `<select data-setting="${key}">${options.map(([v, label]) => `<option value="${escape(v)}" ${v === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select>`;
    const check = (key: string, value: boolean, label: string) =>
      `<label class="check-field"><input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''}>${label}</label>`;
    let content = '';
    if (this.section === 'appearance')
      content = `<div class="settings-grid">${field(
        'Tema',
        select('theme', s.theme, [
          ['dark', 'Escuro'],
          ['light', 'Claro'],
        ]),
      )}${field('Cor de destaque', `<input type="color" data-setting="accent" value="${s.accent}">`)}${field(
        'Fonte do editor',
        select('font', s.font, [
          ['fira', 'Fira Code'],
          ['mono', 'Monoespaçada do sistema'],
        ]),
      )}${field('Tamanho da fonte', `<input type="number" min="12" max="24" data-setting="fontSize" value="${s.fontSize}">`)}</div>${check('inspector', p.layout.inspector, 'Exibir instrumento e medidores')}${check('console', p.layout.console, 'Exibir console')}<button data-setting-action="reset-layout">Restaurar layout</button><p>Arraste as divisórias da biblioteca e das visualizações para redimensionar os painéis. As setas do teclado também ajustam as divisórias.</p>`;
    if (this.section === 'audio') {
      const currentMissing = s.audioDevice && !this.outputs.some((d) => d.deviceId === s.audioDevice);
      const options: [string, string][] = [
        ['', 'Padrão do Windows'],
        ...this.outputs.map((d, i): [string, string] => [d.deviceId, d.label || `Saída ${i + 1}`]),
      ];
      if (currentMissing) options.push([s.audioDevice, 'Dispositivo salvo indisponível']);
      content = `${field('Dispositivo de saída', select('audioDevice', s.audioDevice, options), 'A lista e a seleção dependem do suporte do Chromium. VB-CABLE aparece aqui quando instalado no Windows.')}${field('Volume master', `<input type="range" data-setting="volume" min="0" max="1" step="0.01" value="${s.volume}">`)}<h3>Diagnóstico de áudio</h3><p class="device-note">${this.engine.context ? `${this.engine.context.sampleRate} Hz · estado ${this.engine.context.state} · latência base ${(this.engine.context.baseLatency * 1000).toFixed(1)} ms${'outputLatency' in this.engine.context ? ` · saída ${((this.engine.context as any).outputLatency * 1000).toFixed(1)} ms` : ''}` : 'Motor não iniciado. Toque um padrão para inicializar o áudio.'}</p><p>A latência exibida é informada pelo navegador. Não há controle ASIO nativo nem ajuste de buffer que o Chromium não disponibilize.</p><button data-setting-action="resume-audio">Inicializar / retomar áudio</button>`;
    }
    if (this.section === 'midi') {
      const inputOptions: [string, string][] = [
        ['', 'Todas as entradas'],
        ...this.midi.inputs.map((d) => [d.name ?? '', d.name ?? 'Sem nome'] as [string, string]),
      ];
      const outputOptions: [string, string][] = [
        ['', 'Áudio interno / MIDI definido no código'],
        ...this.midi.outputs.map((d) => [d.name ?? '', d.name ?? 'Sem nome'] as [string, string]),
      ];
      if (p.midi.output && !this.midi.outputs.some((d) => d.name === p.midi.output))
        outputOptions.push([p.midi.output, `${p.midi.output} (indisponível)`]);
      if (p.midi.input && !this.midi.inputs.some((d) => d.name === p.midi.input))
        inputOptions.push([p.midi.input, `${p.midi.input} (indisponível)`]);
      content = `<button data-setting-action="connect-midi" class="primary">${this.midi.access ? 'Atualizar dispositivos MIDI' : 'Ativar MIDI'}</button><p>${this.midi.access ? `${this.midi.inputs.length} entrada(s) e ${this.midi.outputs.length} saída(s) detectada(s).` : 'Ative o acesso para detectar dispositivos físicos ou virtuais.'}</p><div class="settings-grid">${field('Entrada', select('midi.input', p.midi.input, inputOptions))}${field('Saída dos padrões', select('midi.output', p.midi.output, outputOptions))}${field('Canal MIDI', `<input type="number" data-setting="midi.channel" min="1" max="16" value="${p.midi.channel}">`)}</div><button data-setting-action="test-midi">Enviar C4 (Note On / Off)</button><button data-setting-action="panic">Panic · encerrar notas</button><h3>Control Change</h3><div class="settings-grid">${field('CC', '<input id="cc-number" type="number" min="0" max="127" value="74">')}${field('Valor', '<input id="cc-value" type="number" min="0" max="127" value="64">')}</div><button data-setting-action="send-cc">Enviar CC</button><h3>MIDI Learn</h3><p>Selecione o parâmetro e mova um controle físico. Cada associação fica salva neste projeto.</p><div class="settings-grid">${field('Parâmetro', '<select id="learn-target"><option value="volume">Volume master</option><option value="bpm">BPM</option><option value="lpf">Filtro low-pass</option><option value="pan">Pan</option></select>')}<button data-setting-action="learn">${this.midi.learning ? 'Cancelar Learn (aguardando CC)' : 'Aprender próximo CC'}</button></div><div id="mapping-list">${p.midi.mappings.map((m, i) => `<div class="mapping"><span>${escape(m.input)} · canal ${m.channel + 1} · CC ${m.cc} → ${m.target}</span><button data-delete-mapping="${i}" aria-label="Remover mapeamento">Remover</button></div>`).join('') || '<p>Nenhum mapeamento salvo.</p>'}</div><p id="midi-message">${escape(this.midi.lastMessage)}</p>`;
    }
    if (this.section === 'library')
      content = `<p>${this.state.samples.length} samples na biblioteca · ${this.state.samples.filter((s) => s.missing).length} arquivos ausentes.</p><p>Os diretórios são selecionados na importação. A biblioteca mantém referências aos arquivos originais; não copia áudio para a pasta de instalação.</p><button data-setting-action="scan-library">Verificar arquivos ausentes</button><div>${this.state.samples
        .filter((s) => s.missing)
        .map(
          (s) =>
            `<div class="mapping"><span>${escape(s.filename)}</span><button data-relink="${s.id}">Reassociar</button></div>`,
        )
        .join(
          '',
        )}</div><p>Os samples são decodificados sob demanda. O cache de áudio do motor é liberado ao reiniciar o aplicativo; ele não lê todos os arquivos da biblioteca ao abrir.</p>`;
    if (this.section === 'editor')
      content = `<div class="settings-grid">${field('Indentação (espaços)', `<input type="number" min="2" max="8" data-setting="indent" value="${s.indent}">`)}${field(
        'Executar / atualizar',
        select('runKey', s.runKey, [
          ['Ctrl-Enter', 'Ctrl + Enter'],
          ['Alt-Enter', 'Alt + Enter'],
        ]),
      )}</div>${check('autosave', s.autosave, 'Recuperar alterações automaticamente após 700 ms')}<p>Ctrl + S salva o projeto. Ctrl + . interrompe a reprodução. A execução aplica o arquivo da aba ativa. Outras abas permanecem no projeto.</p>`;
    if (this.section === 'visuals')
      content = `<div class="settings-grid">${field(
        'Taxa de atualização',
        select('visuals.fps', String(p.visuals.fps), [
          ['15', '15 fps'],
          ['30', '30 fps'],
          ['60', '60 fps'],
        ]),
      )}${field(
        'Resolução FFT',
        select('visuals.fft', String(p.visuals.fft), [
          ['512', '512'],
          ['1024', '1024'],
          ['2048', '2048'],
          ['4096', '4096'],
        ]),
      )}${field('Escala do osciloscópio', `<input type="number" data-setting="visuals.scale" min="0.25" max="4" step="0.25" value="${p.visuals.scale}">`)}</div><p>Piano roll e ritmo usam eventos reais do padrão. Osciloscópio, espectro e medidores usam o sinal real após o volume master. Os medidores indicam picos de amostra em dBFS, sem alegar RMS, true peak ou LUFS.</p>`;
    this.dialog.querySelector('.dialog-body')!.innerHTML =
      `<nav class="settings-tabs" role="tablist" aria-label="Seções de configurações">${[
        ['appearance', 'Aparência'],
        ['audio', 'Áudio'],
        ['midi', 'MIDI'],
        ['library', 'Biblioteca'],
        ['editor', 'Editor'],
        ['visuals', 'Visualizações'],
      ]
        .map(
          ([key, label]) =>
            `<button role="tab" data-section="${key}" aria-selected="${key === this.section}">${label}</button>`,
        )
        .join('')}</nav><section class="settings-section">${content}</section>`;
    refreshIcons();
  }
  async change(event: Event) {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting;
    if (!key) return;
    const value =
      input.type === 'checkbox'
        ? input.checked
        : input.type === 'number' || input.type === 'range' || key.startsWith('visuals.')
          ? Number(input.value)
          : input.value;
    if (input.type === 'number' && !input.reportValidity()) return;
    const s = this.state.settings,
      p = this.state.project;
    if (key.startsWith('midi.')) {
      const k = key.slice(5) as 'input' | 'output' | 'channel';
      (p.midi as any)[k] = k === 'channel' ? Number(value) : value;
      s.midi = structuredClone(p.midi);
      this.state.modify();
    } else if (key.startsWith('visuals.')) {
      (p.visuals as any)[key.slice(8)] = value;
      s.visuals = structuredClone(p.visuals);
      this.state.modify();
    } else if (key === 'inspector' || key === 'console') {
      p.layout[key] = Boolean(value);
      s.layout = structuredClone(p.layout);
      this.state.modify();
    } else (s as any)[key] = value;
    if (key === 'audioDevice') {
      try {
        await this.engine.setOutput(String(value));
      } catch (error) {
        s.audioDevice = '';
        this.render();
        this.state.log((error as Error).message, 'error');
      }
    }
    this.state.preference();
    this.apply(key);
  }
  async click(event: Event) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.section) {
      this.section = button.dataset.section;
      this.render();
      return;
    }
    const action = button.dataset.settingAction;
    if (action === 'connect-midi') {
      await this.midi.connect();
      this.render();
    }
    if (action === 'test-midi') await this.midi.testNote();
    if (action === 'panic') this.midi.panic();
    if (action === 'send-cc')
      this.midi.sendCC(
        Number(this.dialog!.querySelector<HTMLInputElement>('#cc-number')!.value),
        Number(this.dialog!.querySelector<HTMLInputElement>('#cc-value')!.value),
      );
    if (action === 'learn') {
      this.midi.learning = this.midi.learning
        ? null
        : (this.dialog!.querySelector<HTMLSelectElement>('#learn-target')!.value as any);
      this.render();
    }
    if (action === 'scan-library') {
      this.state.samples = unwrap(await window.studio.scanSamples());
      this.state.notify();
      this.render();
    }
    if (action === 'resume-audio') {
      await this.engine.init();
      await this.engine.context.resume();
      this.engine.setVolume(this.state.settings.volume);
      this.render();
    }
    if (action === 'reset-layout') {
      this.state.project.layout = { libraryWidth: 240, visualHeight: 230, inspector: true, console: true };
      this.state.modify();
      this.apply();
    }
    if (button.dataset.deleteMapping !== undefined) {
      this.state.project.midi.mappings.splice(Number(button.dataset.deleteMapping), 1);
      this.state.modify();
      this.render();
    }
    if (button.dataset.relink) {
      const sample = unwrap(await window.studio.relinkSample(button.dataset.relink));
      if (sample) {
        Object.assign(this.state.samples.find((s) => s.id === sample.id)!, sample);
        this.state.notify();
        this.render();
      }
    }
  }
}
