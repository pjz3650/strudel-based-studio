import type { StudioState } from '../state';
import { unwrap } from '../state';
import type { MusicEngine } from '../engine/engine';
import type { MusicalEditor } from './editor';
import { $, escape, icon, refreshIcons, askText } from './dom';
const instruments = [
  { name: 'Sine', sound: 'sine', description: 'Senoidal · som puro' },
  { name: 'Triangle', sound: 'triangle', description: 'Triangular · suave' },
  { name: 'Sawtooth', sound: 'sawtooth', description: 'Dente de serra · harmônicos' },
  { name: 'Square', sound: 'square', description: 'Quadrada · pulsante' },
  { name: 'White noise', sound: 'white', description: 'Ruído branco · percussão' },
  { name: 'Pink noise', sound: 'pink', description: 'Ruído rosa · textura' }
];
export class LibraryView {
  mode: 'samples' | 'instruments' | 'presets' | 'recents' | 'files' | 'favorites' = 'instruments';
  query = '';
  constructor(private state: StudioState, private engine: MusicEngine, private editor: MusicalEditor, private openRecent: (id: string) => void, private switchFile: (id: string) => void) {
    $('#library-search').addEventListener('input', event => { this.query = (event.target as HTMLInputElement).value.toLowerCase(); this.renderList(); });
    $('#library-nav').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-library]');
      if (button) { this.mode = button.dataset.library as typeof this.mode; this.render(); }
    });
    $('#library-list').addEventListener('click', event => { void this.action(event).catch(e => state.log(e.message, 'error')); });
    state.addEventListener('change', () => this.render()); this.render();
  }
  render() {
    document.querySelectorAll<HTMLElement>('[data-library]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.library === this.mode)));
    $('#library-section-name').textContent = ({ samples: 'Samples locais', instruments: 'Sintetizadores', presets: 'Presets de instrumento', recents: 'Projetos recentes', files: 'Arquivos da sessão', favorites: 'Favoritos' })[this.mode];
    this.renderList();
  }
  renderList() {
    const list = $('#library-list'); const q = this.query;
    if (this.mode === 'instruments') list.innerHTML = instruments.filter(i => `${i.name} ${i.description}`.toLowerCase().includes(q)).map(i => `<button class="library-row" data-synth="${i.sound}">${icon('audio-waveform')}<span><strong>${i.name}</strong><small>${i.description}</small></span>${icon('plus')}</button>`).join('');
    if (this.mode === 'samples' || this.mode === 'favorites') {
      const samples = this.state.samples.filter(s => (this.mode !== 'favorites' || s.favorite) && `${s.name} ${s.filename} ${s.category}`.toLowerCase().includes(q));
      list.innerHTML = samples.map(s => `<div class="sample-row"><button class="sample-play" data-preview="${s.id}" aria-label="${s.missing ? 'Reassociar' : 'Pré-escutar'} ${escape(s.name)}">${icon(s.missing ? 'file-warning' : 'play')}</button><button class="sample-insert" data-insert="${s.id}" title="Inserir sample no código"><strong>${escape(s.name)}</strong><small>${escape(s.category)} · ${s.duration !== undefined ? s.duration.toFixed(2) + ' s' : (s.bytes / 1024).toFixed(0) + ' KB'}${s.missing ? ' · Ausente' : ''}</small></button><button data-star="${s.id}" aria-label="${s.favorite ? 'Remover dos' : 'Adicionar aos'} favoritos" aria-pressed="${s.favorite}">${icon('star')}</button><button data-category="${s.id}" aria-label="Editar categoria">${icon('folder-pen')}</button></div>`).join('');
      if (!samples.length) list.innerHTML = `<div class="empty-state">${icon('folder-open')}<p>${q ? 'Nenhum resultado para esta busca.' : this.mode === 'favorites' ? 'Seus samples favoritos aparecerão aqui.' : 'Sua biblioteca começa com seus sons.'}</p><button data-action="import">Importar samples</button><small>WAV, MP3 e OGG · até 200 MB por arquivo</small></div>`;
    }
    if (this.mode === 'presets') list.innerHTML = this.state.project.presets.filter(p => p.name.toLowerCase().includes(q)).map(p => `<button class="library-row" data-preset="${p.id}">${icon('sliders-horizontal')}<span><strong>${escape(p.name)}</strong><small>Aplicar ao instrumento global</small></span></button>`).join('') || '<p class="empty-copy">Ajuste o instrumento e clique em Salvar preset para criar seu primeiro preset.</p>';
    if (this.mode === 'recents') list.innerHTML = this.state.recents.filter(r => r.name.toLowerCase().includes(q)).map(r => `<button class="library-row" data-recent="${r.id}">${icon('file-audio')}<span><strong>${escape(r.name)}</strong><small>${escape(r.filename)}</small></span></button>`).join('') || '<p class="empty-copy">Os projetos salvos ou abertos aparecerão aqui.</p>';
    if (this.mode === 'files') list.innerHTML = this.state.project.files.filter(f => f.name.toLowerCase().includes(q)).map(f => `<button class="library-row" data-file="${f.id}">${icon('file-code-2')}<span><strong>${escape(f.name)}</strong><small>${f.code.split('\n').length} linhas</small></span></button>`).join('');
    refreshIcons();
  }
  async action(event: Event) {
    const b = (event.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
    if (b.dataset.synth) this.editor.insert(`\n$: note("c4 eb4 g4 bb4").s("${b.dataset.synth}").gain(0.25)\n`);
    if (b.dataset.file) this.switchFile(b.dataset.file);
    if (b.dataset.recent) this.openRecent(b.dataset.recent);
    const id = b.dataset.preview || b.dataset.insert || b.dataset.star || b.dataset.category;
    if (id) {
      const sample = this.state.samples.find(s => s.id === id)!;
      if (b.dataset.preview) {
        if (sample.missing) { const updated = unwrap(await window.studio.relinkSample(id)); if (updated) Object.assign(sample, updated); this.engine.project = this.state.project; this.state.notify(); return; }
        await this.engine.preview(sample); this.engine.setVolume(this.state.settings.volume); this.state.log(`Pré-écoute : ${sample.name}`);
      }
      if (b.dataset.insert) this.editor.insert(`\n$: s("${sample.name}*4").gain(0.5)\n`);
      if (b.dataset.star) { sample.favorite = !sample.favorite; Object.assign(sample, unwrap(await window.studio.updateSample(sample))); this.renderList(); }
      if (b.dataset.category) {
        const category = await askText('Catégorie du sample', 'Nome da categoria (criar ou mover)', sample.category);
        if (category) { Object.assign(sample, unwrap(await window.studio.updateSample({ ...sample, category: category.slice(0, 80) }))); this.renderList(); }
      }
    }
    if (b.dataset.preset) { const preset = this.state.project.presets.find(p => p.id === b.dataset.preset)!; this.state.project.parameters = structuredClone(preset.parameters); this.state.project.instrumentEnabled = true; this.state.modify(); }
  }
}
