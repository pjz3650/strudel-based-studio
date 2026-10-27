# Diagnóstico inicial

A pasta de trabalho estava vazia e o destino GitHub continha apenas uma licença MIT. O histórico e a licença inicial foram preservados. O Strudel oficial foi clonado em `upstream/`, ignorado pelo Git, para reconhecimento e testes.

- Origem: https://codeberg.org/uzu/strudel
- Commit inspecionado: `fdaa55937776dbd644da3d64e864527df4a105a6`.
- Monorepo pnpm 10.15.0, Node >=18, 39 workspaces.
- Interface original: Astro/React, editor CodeMirror 6. O novo shell não necessita Astro nem de um framework adicional.
- `packages/core`: padrões, REPL, transpilation scope e scheduler Cyclist/NeoCyclist.
- `packages/mini`, `tonal`, `edo`, `transpiler`: mini-notation e linguagem musical.
- `packages/webaudio`, `superdough`: saída Web Audio, síntese, samples, efeitos, AudioWorklets e analisadores.
- `packages/draw`: piano roll baseado em haps reais; reutilizado pelo painel.
- `packages/midi`: saída MIDI integrada ao scheduler; reutilizada pelo REPL.

Estratégia: pacotes npm oficiais fixados em lockfile, sem alterações no motor. Atenção: a API publicada pode diferir do HEAD; a integração verifica a API instalada. Recursos visuais ligados ao canvas do site não são assumidos como idênticos aos do shell desktop.

Os comandos e resultados executados são registrados em `VALIDACAO.md`. O script `test` do upstream imprime a versão do Vitest; a suíte real precisa de `pnpm exec vitest run`.
