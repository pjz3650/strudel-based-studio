# Matriz de conformidade

Esta matriz aplica os estados exigidos pelo briefing. A entrega é uma versão inicial funcional; **não representa conclusão integral de todos os requisitos**.

| Requisito | Implementação | Teste / evidência | Status |
|---|---|---|---|
| Inspeção do Strudel e baseline | `docs/DIAGNOSTICO.md`, clone local ignorado | 1.093 testes upstream; site original respondeu HTTP 200 | Concluído e validado |
| Aplicativo desktop Windows | `electron/main.ts`, `preload.ts` | Cinco fluxos Electron, também no executável extraído | Concluído e validado |
| Interface personalizada e temas | `src/ui`, `src/styles`, `DESIGN.md` | Capturas ampla/900px/mínima, tema claro, ajustes de layout e revisão independente | Concluído e validado |
| Editor e live coding | `src/ui/editor.ts`, `src/engine/engine.ts` | Executar, atualizar, recuperar erro e manter padrão válido; abas e atalhos | Concluído e validado |
| API musical extensa do Strudel | Pacotes oficiais sem modificação | Mini-notation, múltiplos `$:`, notas/samples/efeitos testados; nem toda API opcional foi exercitada | Parcial |
| Projetos versionados e recuperação | `schema.ts`, `project.ts`, `state.ts`, `storage.ts` | Roundtrip, versões inválidas, abas, backup de corrupção, 25 writes concorrentes, reinicialização e cancelamento de fechamento | Concluído e validado |
| Biblioteca de samples locais | `electron/library.ts`, `src/ui/library.ts`, protocolo `studio` | WAV importado, tocado e lido no app; busca/categorias/favoritos implementados, sem ensaio completo de MP3/OGG/pastas grandes | Parcial |
| Arquivos ausentes e reassociação | Verificação de realpath/stat e revisão de URL | Validação de caminhos unitária; operação manual implementada, sem matriz de arquivos movidos/formatos | Implementado, mas não validado |
| Instrumentos e presets | Síntese SuperDough e `editPattern`, `instrument.ts` | Sintetizadores, filtro, reverb/delay e efeito AudioWorklet reproduzidos; todos os sliders/presets ainda não têm teste auditivo individual | Parcial |
| Piano roll | `@strudel/draw.__pianoroll`, `visuals/panel.ts` | Desenho de haps reais em reprodução e captura | Concluído e validado |
| Osciloscópio | Tap do master em AnalyserNode | Áudio real presente; troca de modo exercitada, escala/pausa implementadas | Concluído e validado |
| Espectro FFT | AnalyserNode, bins logarítmicos e resolução | Troca de modo em reprodução; FFT real do sinal | Concluído e validado |
| Medidores estéreo e clipping | `visuals/analysis.ts`, splitter e medidores | Cálculo de pico/dBFS unitário e leitura não silenciosa no app | Concluído e validado |
| Ritmo e realce musical | Consulta dos eventos do padrão | Inspeção e captura do realce; ritmo não tem teste individual de todas as transformações | Implementado, mas não validado |
| MIDI | Scheduler do pacote MIDI + controlador Web MIDI | Quatro testes de portas/mensagens simuladas; ativação real retornou 0 entradas e 0 saídas | Parcial |
| MIDI físico, loopMIDI e DAWs | Seleção de portas, canal, Learn, Note On/Off, CC e Panic | Sem controlador, porta virtual ou DAW disponível para ensaio físico | Bloqueado |
| Seleção da saída de áudio | `AudioContext.setSinkId`, configuração e fallback | Implementada; não houve comparação de dispositivos/cabos físicos | Implementado, mas não validado |
| Integração com DAWs | Guia interno e `docs/GUIA.md` | Orientações e rotas MIDI/áudio implementadas; VB-CABLE/DAW não testados | Parcial |
| Funcionamento básico offline | Assets/fontes/worklets locais e síntese nativa | Playwright com contexto offline, sem Vite, inclusive no aplicativo extraído | Concluído e validado |
| Segurança Electron e IPC | Isolamento, sandbox, schemas, origem/frame, protocolo limitado | Renderer sem require e IPC inválido rejeitado; revisão estática | Concluído e validado |
| Segurança contra JS malicioso/infinito | REPL JavaScript no renderer | Não há isolamento de CPU nem proteção completa contra código malicioso; não executa ao abrir | Parcial |
| Preferências e layout | Diretório userData, schemas, debounce e bounds | Tema/atalho/layout salvos; janela mínima sem clipping, preferências lidas em IPC | Concluído e validado |
| CPU e memória total | Apenas heap JavaScript real é exibido | Medição agregada do Electron não foi adicionada | Parcial |
| Instalador Windows e portátil | electron-builder NSIS/portable e ícone próprio | NSIS instalado com exit 0 e atalhos verificados; 5/5 fluxos no instalado; portátil executou áudio offline; hashes em `VALIDACAO.md` | Concluído e validado |
| Assinatura digital | Sem certificado | Authenticode retorna NotSigned; limitação documentada | Não implementado |
| Documentação e licenças | README, guias, AGPL, avisos e MIT inicial preservada | Revisão documental e lockfile versionado | Concluído e validado |

## Lacunas que permanecem

- **Hardware:** testar controlador MIDI, loopMIDI, desconexão física e execução de notas em uma DAW. Testes simulados não comprovam temporização fim a fim no hardware.
- **Áudio externo:** validar CABLE Input/Output, monitoramento e latência em DAWs. Não há ASIO nativo nem host VST.
- **Biblioteca:** testar MP3/OGG de diferentes codificações, importações extensas, reassociação em outra máquina e limites de memória. Não há operações coletivas de categoria, waveform de samples ou projeto com assets incorporados.
- **Motor:** APIs opcionais como soundfonts, Hydra, OSC, ferramentas do site e samples online não são carregadas implicitamente. A CSP é local por padrão; fetch de bancos remotos não está habilitado. Os recursos nativos dos pacotes incluídos permanecem disponíveis.
- **Desempenho:** não há stress test prolongado nem limite agregado de cache; o teste musical usa múltiplos padrões e AudioWorklet, sem alegar benchmark de latência/CPU.
- **Distribuição:** assinatura digital requer um certificado válido. A validação local não substitui testes em uma instalação limpa de Windows nem em outras versões do sistema.

O arquivo de evidências é a fonte para saber quais artefatos foram efetivamente gerados e executados; o estado de CI remoto deve ser consultado separadamente.
