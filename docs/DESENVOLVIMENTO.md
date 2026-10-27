# Desenvolvimento e empacotamento

## Setup

Use Windows x64 e Node >=22. O lockfile foi gerado com pnpm 10.15.0. `pnpm install --frozen-lockfile` instala as versões exatas. A primeira instalação e o primeiro empacotamento baixam Electron e ferramentas de build; isso não é uma dependência de rede do aplicativo instalado.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

`dev.mjs` compila main/preload com esbuild, inicia Vite em `127.0.0.1:5173` e abre Electron. Alterações no renderer têm HMR; alterações em main/preload requerem reiniciar o comando. A variável `ELECTRON_RUN_AS_NODE` é removida ao iniciar a janela, para ambientes de desenvolvimento que a tenham definido.

## Build

```powershell
pnpm build
pnpm start
pnpm pack
pnpm dist
```

`build` valida tipos, compila os assets e gera `dist/electron/main.cjs`, `preload.cjs` e `dist/renderer/`. Os worklets são assets locais extraídos dos pacotes oficiais. Não use `vite preview` para certificar o produto desktop.

`pack` gera `release/win-unpacked/Live Studio.exe`. `dist` gera também:

Os dois comandos usam `--publish never`: gerar pacotes não envia binários automaticamente para o GitHub, inclusive em CI. A publicação de uma release é uma operação separada.

- `release/Live-Studio-0.1.0-x64-setup.exe`
- `release/Live-Studio-0.1.0-x64-portable.exe`

O projeto não tem certificado de assinatura. `scripts/after-pack.cjs` aplica ícone e metadados com rcedit, sem assinatura e sem extrair os symlinks macOS presentes no auxiliar winCodeSign do electron-builder. O ícone Windows pode ser reproduzido com `node scripts/icon.mjs`. A ferramenta rcedit e algumas dependências transitivas do empacotador têm avisos de depreciação no registro; são ferramentas de desenvolvimento, não o motor musical. Atualize-as com testes de empacotamento antes de novas distribuições.

Para gerar somente os instaladores a partir de um diretório já empacotado:

```powershell
pnpm exec electron-builder --win nsis portable --prepackaged release/win-unpacked
```

Não use essa alternativa após mudar o código sem primeiro recompilar/empacotar o aplicativo. Não modifique os arquivos dentro do ASAR depois de gerar o executável: a integridade é inserida no pacote.

## Testes

```powershell
pnpm check
pnpm build
pnpm test:e2e
```

Os testes unitários cobrem formato, versões inválidas, configurações, gravações concorrentes, preservação de dados corrompidos, referências de samples, CC, dispositivos simulados e cálculos reais dos medidores.

Playwright abre o Electron real. Testes usam diretórios isolados em `.test-data`, substituem somente os diálogos nativos para escolher arquivos e usam um WAV de teste gerado matematicamente. O motor e o áudio não são mocks. O teste de MIDI no sistema pode mostrar zero portas; os testes de mensagens usam doubles explicitamente simulados.

Para repetir todos os fluxos contra o executável empacotado:

```powershell
$env:LIVE_STUDIO_EXECUTABLE = (Resolve-Path 'release/win-unpacked/Live Studio.exe').Path
pnpm test:e2e
Remove-Item Env:LIVE_STUDIO_EXECUTABLE
```

O teste de recuperação encerra o processo deliberadamente com mudanças não salvas e abre novamente no mesmo diretório de teste. O encerramento normal com alterações é verificado separadamente. Não use o diretório de dados pessoal nos testes.

O smoke do portátil é `node scripts/smoke-portable.mjs [caminho-do-exe]`: ele inicia o pacote, conecta temporariamente ao CDP local, verifica transporte/áudio offline e encerra. O processo normal do produto não habilita porta de depuração.

`LIVE_STUDIO_TEST`/`LIVE_STUDIO_TEST_DATA` servem exclusivamente para isolar o diretório de dados em testes. Não fazem parte da interface pública nem permitem acesso a caminhos pelo renderer.

## Continuar o projeto

1. Leia `ARQUITETURA.md`, `PROJETOS.md` e `CONFORMIDADE.md`.
2. Adicione limites e schemas em `src/shared/schema.ts` antes de expandir o IPC.
3. Preserve uma única instância dos pacotes core; evite misturar o bundle web com os módulos individuais.
4. Não altere o scheduler para resolver desenho ou controle de interface.
5. Após mudanças no áudio, teste um padrão sintetizado, sample local e atualização com erro.
6. Para novos formatos de projeto, escreva migração e teste arquivos antigos/incompatíveis.
7. Para mudanças visuais, mantenha `DESIGN.md` e os tokens sincronizados e confira 900×620 e uma janela ampla.

Prioridades conhecidas: validação física MIDI e DAWs; fixtures MP3/OGG; projetos portáteis com cópia e reassociação de assets; cache de áudio limitado; testes de segurança contra iframes e entradas IPC em frames secundários; suporte a APIs opcionais adicionais; medição CPU/RAM agregada, caso implementada com dados reais do Electron.

## Integração contínua

O workflow `windows.yml` instala o lockfile, executa tipos/unitários, build e os fluxos Electron, gera NSIS/portátil e publica os arquivos como artefatos de CI. A execução local é a evidência descrita em `VALIDACAO.md`; a existência do workflow não implica execução remota aprovada.
