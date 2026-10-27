# Evidências de validação

Data local: **27/10/2026**, America/Sao_Paulo. Ambiente: Windows x64 `10.0.26300`, Node `24.19.0`, pnpm `10.15.0`, Electron `45.0.0`.

## Base oficial

- Clone oficial no commit `fdaa55937776dbd644da3d64e864527df4a105a6`; README, CONTRIBUTING, POLICY, LICENSE, manifestos e módulos inspecionados.
- Instalação: `pnpm install` no monorepo, 39 workspaces.
- `node node_modules/vitest/vitest.mjs run --reporter=dot`, no diretório `upstream`: **21 arquivos e 1.093 testes aprovados**, 7,52 s.
- O script `test` do monorepo imprime a versão do Vitest; por isso o runner foi chamado diretamente.
- Site original iniciado com Astro, na pasta `upstream/website`, porta 4322; consulta HTTP retornou **200** com o HTML do REPL. Não foi feita validação física do som do site original.

## Live Studio

- `node node_modules/typescript/bin/tsc --noEmit`: aprovado após as correções de tipos.
- `node node_modules/vitest/vitest.mjs run`: **5 arquivos, 28 testes aprovados**.
- `node scripts/build.mjs`: aprovado. Assets, fontes e dois AudioWorklets locais gerados em `dist/renderer`. Aviso de chunk JavaScript grande, aproximadamente 1,84 MB sem gzip; não bloqueia a execução e permanece registrado para otimização.
- `node node_modules/@playwright/test/cli.js test`: **5 fluxos aprovados**. Resultados variam de duração conforme inicialização do MIDI; uma execução completa após revisão levou 17,8 s.
- Repetição com `LIVE_STUDIO_EXECUTABLE` apontando para `release/win-unpacked/Live Studio.exe`: **5/5 aprovados**, a partir de `app.asar`, sem servidor de desenvolvimento. A primeira execução levou 24,8 s; a repetição final com encaminhamento dos logs nativos e erro de sample ausente levou **17,7 s**.
- Instalação NSIS silenciosa em `.test-data/installed`: **exit 0**. Executável e desinstalador encontrados; atalhos no menu Iniciar e na área de trabalho confirmados. Os **cinco fluxos passaram no aplicativo instalado**, incluindo reinicialização e reprodução, em **19,5 s**. A instalação de teste é removida ao terminar a validação.
- `node scripts/smoke-portable.mjs`: **PORTABLE_SMOKE_OK**. Executável portátil real extraiu/iniciou a interface e reproduziu áudio offline com medidores não silenciosos; Stop foi verificado. O teste abre uma porta CDP local apenas durante o ensaio e usa dados isolados.

Fluxos cobertos:

1. Contexto offline, reprodução com duas camadas, medidores não silenciosos, atualização durante reprodução, osciloscópio/FFT, erro de avaliação e recuperação.
2. Salvar/abrir JSON por diálogos nativos controlados no teste, nova sessão, múltiplas abas, tema/atalho e layout persistidos, snapshot de recuperação.
3. Importação e pré-escuta de WAV gerado pelo teste, playback no scheduler, protocolo de recursos locais, rejeição de IPC inválido e ausência de Node no renderer.
4. Encerramento deliberado, reabertura com código recuperado, confirmação de fechamento, Cancelar e reprodução de efeito AudioWorklet.
5. Ativação MIDI real (0 entradas, 0 saídas), configurações, janela mínima, reabertura do painel de instrumento e limite vertical do console.

As mensagens de console da avaliação propositalmente inválida são esperadas no teste de recuperação. Elas não significam falha do runner. Avisos de dependências de build (`DEP0190`, pacotes descontinuados e tamanho de bundle) foram observados; não foram suprimidos como se não existissem.

## Revisão independente

Uma revisão separada de código e capturas encontrou quatro problemas: instrumento inacessível na janela estreita, altura das visualizações além do viewport, diálogos sem nome acessível e navegação de abas/separadores incompleta. Todos foram corrigidos. A revisão seguinte pontuou os **quatro como resolvidos**, com escopo limitado às correções, sem certificar hardware.

Capturas reais: `docs/images/live-studio.png`, `window-900.png` e `window-900-min.png`. Detector mecânico visual executado uma vez sobre os arquivos de interface: resultado `[]`.

## Artefatos Windows

- Diretório executável: `release/win-unpacked/Live Studio.exe`.
- Instalador NSIS: `release/Live-Studio-0.1.0-x64-setup.exe`.
- Portátil: `release/Live-Studio-0.1.0-x64-portable.exe`.
- Integridade: `release/SHA256SUMS.txt`, gerado a partir dos binários finais.

Os pacotes foram gerados com electron-builder. A primeira tentativa identificou falta de privilégio para symlinks macOS do auxiliar winCodeSign; o build passou a usar edição de recursos Windows com rcedit e um ícone DIB multirresolução. Também foi corrigida uma macro de nome de artefato não suportada. Essas tentativas falharam antes da entrega e não são consideradas builds aprovados.

Authenticode foi consultado e retornou **NotSigned**. As linhas “signing with signtool.exe” emitidas pelo empacotador não comprovam assinatura; não existe certificado configurado.

Binários finais:

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| `Live-Studio-0.1.0-x64-setup.exe` | 121313721 | `f3d0df0f344395fa9b7c41e157bb065a69b3f486880edcdab8d90e6778e70bab` |
| `Live-Studio-0.1.0-x64-portable.exe` | 121105901 | `07bfe6f61250d380ad7d6210c8d7cbf5617fa38073fbadfb0dc0906c779efca3` |

## Limites de evidência

- Não há controlador MIDI, loopMIDI, VB-CABLE ou DAW disponível. Há testes simulados de Note On/Off, CC, Learn, desconexão/reconexão e acesso negado; nenhum é apresentado como teste físico.
- WAV foi testado; MP3/OGG não receberam uma matriz completa de decodificação.
- Offline foi verificado pelo contexto do Chromium e pela execução de assets locais, sem dependências HTTP do motor básico; não foi desligada fisicamente a rede do Windows.
- Não foram feitos testes de duração longa, medição de latência externa ou comparação auditiva com hardware.
- Testes locais não certificam automaticamente o workflow no GitHub ou todas as versões do Windows.

## CI remota

A execução inicial `40452791128` aprovou instalação, tipos, os 28 testes unitários, build e os cinco fluxos Electron no runner Windows. Também gerou NSIS e portátil, mas o passo terminou com erro porque o electron-builder tentou publicar automaticamente sem `GH_TOKEN`. Os scripts `dist` e `pack` foram corrigidos para usar `--publish never`: a CI gera artefatos e não precisa de permissão para publicar releases. A correção não altera o runtime ou os binários locais já testados.
