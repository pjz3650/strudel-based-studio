import { button, icon } from './dom';
export function renderShell() {
  document.getElementById('app')!.innerHTML = `
  <header class="transport">
    <div class="brand">${icon('audio-lines')}<span>Live <strong>Studio</strong></span></div>
    <div class="transport-actions">
      ${button('Tocar / atualizar (Ctrl+Enter)', 'play', 'play', 'play-button')}
      ${button('Parar (Ctrl+.)', 'square', 'stop')}
      ${button('Reiniciar padrão', 'rotate-ccw', 'restart')}
    </div>
    <label class="tempo"><input id="bpm" type="number" min="20" max="300" value="120" aria-label="BPM"><span>BPM</span></label>
    <div class="transport-clock"><span id="cycle">001:1</span><small id="playback-state">Parado</small></div>
    <div class="project-heading"><button id="project-name" data-action="rename" title="Renomear projeto">Nova sessão</button><span id="dirty-label">Não salvo</span></div>
    <div class="file-actions">${button('Novo projeto', 'file-plus-2', 'new')}${button('Abrir projeto (Ctrl+O)', 'folder-open', 'open')}${button('Salvar projeto (Ctrl+S)', 'save', 'save')}${button('Salvar como (Ctrl+Shift+S)', 'save-all', 'saveAs')}${button('Duplicar projeto', 'copy', 'duplicate')}</div>
    ${button('Configurações (Ctrl+,)', 'settings-2', 'settings')}
  </header>
  <main class="workspace">
    <aside class="library" aria-label="Biblioteca">
      <div class="panel-heading"><h2>Biblioteca</h2><div>${button('Importar samples', 'file-plus', 'import')}${button('Importar pasta', 'folder-plus', 'importFolder')}</div></div>
      <div class="search">${icon('search')}<input id="library-search" type="search" placeholder="Buscar na biblioteca" aria-label="Buscar na biblioteca"></div>
      <nav id="library-nav" aria-label="Seções da biblioteca">
        <button data-library="files">${icon('files')}Arquivos da sessão</button>
        <button data-library="samples">${icon('folder-music')}Samples locais</button>
        <button data-library="instruments" aria-pressed="true">${icon('piano')}Instrumentos</button>
        <button data-library="presets">${icon('sliders-horizontal')}Presets</button>
        <button data-library="favorites">${icon('star')}Favoritos</button>
        <button data-library="recents">${icon('history')}Projetos recentes</button>
      </nav>
      <div class="list-heading"><h3 id="library-section-name">Sintetizadores</h3><span id="library-count"></span></div>
      <div id="library-list" class="library-list"></div>
      <div class="library-bottom"><span>${icon('hard-drive')}Biblioteca local</span><button data-action="scan" title="Verificar arquivos ausentes" aria-label="Verificar arquivos ausentes">${icon('refresh-cw')}</button></div>
    </aside>
    <div id="library-resizer" class="resizer vertical" role="separator" aria-label="Largura da biblioteca" aria-orientation="vertical" tabindex="0"></div>
    <section class="center" aria-label="Sessão de live coding">
      <div class="editor-toolbar"><div id="file-tabs" role="tablist" aria-label="Arquivos do projeto"></div><div class="tab-actions">${button('Nova aba', 'plus', 'addFile')}${button('Renomear aba', 'pencil', 'renameFile')}${button('Fechar aba', 'x', 'closeFile')}</div><span class="editor-label">Strudel / JavaScript</span></div>
      <div class="editor-region"><div id="code-editor"></div></div>
      <div class="editor-foot"><span id="editor-position">Live coding</span><span>Atualizar <kbd id="run-key">Ctrl ↵</kbd></span><button data-action="restore" id="restore-code" hidden>Recuperar último código válido</button></div>
      <div id="visual-resizer" class="resizer horizontal" role="separator" aria-label="Altura das visualizações" aria-orientation="horizontal" tabindex="0"></div>
      <section class="visuals" aria-label="Visualizações musicais">
        <div class="visual-toolbar"><div id="visual-tabs" role="tablist" aria-label="Tipo de visualização"><button data-visual="piano" role="tab">Piano roll</button><button data-visual="scope" role="tab">Osciloscópio</button><button data-visual="spectrum" role="tab">Espectro</button><button data-visual="rhythm" role="tab">Ritmo</button></div><button id="pause-visual" title="Pausar visualização" aria-label="Pausar visualização">${icon('pause')}</button></div>
        <div class="canvas-container"><canvas id="visual-canvas" aria-label="Visualização dos eventos e áudio reais"></canvas><div id="visual-empty">${icon('piano')}<span>Seu código ganha forma aqui.</span><small>Toque um padrão para visualizar os eventos musicais.</small></div></div>
        <div class="visual-foot"><span id="visual-description">Notas · duração · posição no ciclo</span><span id="visual-fps">30 fps</span></div>
      </section>
      <section class="console" id="console-panel" aria-label="Console"><header><h2>${icon('terminal')}Console</h2><span id="engine-state">Motor aguardando</span><div>${button('Limpar console', 'trash-2', 'clearLogs')}${button('Ocultar console', 'chevron-down', 'toggleConsole')}</div></header><div id="logs" role="log" aria-live="polite"></div></section>
    </section>
    <aside class="inspector" aria-label="Instrumento e saída">
      <div class="panel-heading"><h2>Instrumento</h2><button id="reset-instrument" aria-label="Restaurar instrumento" title="Restaurar instrumento">${icon('rotate-ccw')}</button></div>
      <label class="instrument-switch"><input id="instrument-enabled" type="checkbox">Aplicar a todos os padrões</label>
      <p class="inspector-help">Ative para aplicar estes parâmetros ao atualizar o código.</p>
      <div id="instrument-controls"></div>
      <button id="save-preset" class="preset-save">${icon('bookmark-plus')}Salvar preset</button>
      <section class="master"><div class="section-heading"><h3>Saída master</h3><span id="peak-label">−∞ dBFS</span></div><div class="meters"><div class="meter-track"><span id="meter-l"></span></div><div class="meter-track"><span id="meter-r"></span></div></div><div class="meter-scale"><span>−60</span><span>−24</span><span>−12</span><span>0</span></div><label class="parameter"><span>Volume master<output id="master-value">70%</output></span><input id="master-volume" aria-label="Volume master" type="range" min="0" max="1" step="0.01" value="0.7"></label><div id="clip-indicator">Sem clipping detectado</div></section>
      <button class="routing-link" data-action="settingsMidi">${icon('cable')}Áudio e MIDI${icon('arrow-up-right')}</button>
    </aside>
  </main>
  <footer class="statusbar"><span id="audio-status">${icon('volume-2')}Áudio não iniciado</span><button id="midi-status" data-action="settingsMidi">MIDI desativado</button><span id="memory-status"></span><div class="status-right"><button data-action="toggleInspector">Instrumento</button><button data-action="toggleConsole">Console</button><button data-action="help">Guia DAW</button><span class="attribution">Strudel © contribuidores · AGPL-3.0+</span></div></footer>
  <div id="error-banner" role="alert" hidden><span></span><button data-action="dismissError" aria-label="Fechar erro">${icon('x')}</button></div>`;
}
