---
name: Live Studio
description: Interface de live coding musical organizada como uma DAW.
colors:
  bg: "#0B1220"
  panel: "#1F2937"
  surface: "#121c2c"
  border: "#334155"
  accent: "#22D3EE"
  purple: "#C084FC"
  green: "#34D399"
  text: "#F8FAFC"
  muted: "#a4b2c6"
  comment: "#98a8ba"
  function: "#cbdafa"
  danger: "#fda4af"
  hover: "#ffffff08"
  selection: "#22d3ee26"
  light-bg: "#f7f9fc"
  light-panel: "#e9eef5"
  light-surface: "#fff"
  light-border: "#c0ccda"
  light-accent: "#087c8e"
  light-purple: "#7947b3"
  light-green: "#087b56"
  light-text: "#152236"
  light-muted: "#4f6077"
  light-comment: "#576c65"
  light-function: "#294981"
  light-danger: "#b91c3b"
  light-hover: "#00000007"
  light-selection: "#087c8e20"
typography:
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "10px"
  code:
    fontFamily: "'Fira Code', Consolas, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.9
rounded:
  radius: "5px"
  compact: "3px"
  dialog: "8px"
spacing:
  gap-small: "4px"
  gap: "8px"
  inset-small: "12px"
  inset: "16px"
  inset-large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.radius}"
    padding: "6px 9px"
  button-ghost:
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    padding: "6px 9px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    padding: "7px 9px"
  library-navigation-active:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.accent}"
    rounded: "{rounded.radius}"
    padding: "8px 10px"
  file-tab-active:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    padding: "0 18px"
    height: "42px"
---

# Design System: Live Studio

## Overview

**Creative North Star: "Interface DAW"**

Interface escura e densa para edição e execução musical. O editor ocupa a área central, acompanhado por biblioteca, transporte, visualizações, console e controles de instrumento. A organização segue o compromisso de interface DAW registrado em PRODUCT.md.

A hierarquia depende de superfícies, divisórias e estados de controles. Acentos identificam interação, sintaxe e sinal de áudio. Os textos da interface usam português brasileiro.

**Key Characteristics:**

- Editor central predominante.
- Painéis compactos separados por bordas.
- Ciano, violeta e verde com funções identificáveis.
- Tipografia de sistema na interface e monoespaçada no código.

## Colors

Os tokens acima registram os valores de `src/styles/tokens.css`; o tema escuro é o padrão. Os tokens com prefixo `light-` correspondem às substituições do tema claro e conservam os mesmos papéis.

### Primary

- **Ciano:** `accent` identifica ações primárias, foco, cursor, palavras-chave e abas selecionadas. `selection` fornece o fundo translúcido de seleção; `hover` marca passagem do ponteiro.

### Secondary

- **Violeta:** `purple` aparece nos instrumentos, números e booleanos do editor e controles pressionados de visualização e samples.

### Tertiary

- **Verde:** `green` identifica reprodução ativa, strings, mensagens de sucesso e medidores de áudio.
- **Rosa de erro:** `danger` marca erros, clipping e a ação de recuperação do código.

### Neutral

- `bg` é o fundo principal e dos campos; `surface` é a superfície de barras e painéis laterais; `panel` aparece nos medidores, tooltips e avisos.
- `border` separa regiões e contorna campos. `text` é o texto principal; `muted` é usado em metadados e legendas.
- `comment` e `function` distinguem comentários e funções ou propriedades no editor.

## Typography

**Body Font:** system-ui, com fallback sans-serif.
**Label/Mono Font:** Fira Code local, com fallbacks Consolas e monospace.

A interface usa tamanhos compactos e pesos discretos. Código, relógio, BPM, logs e valores de parâmetros usam a família monoespaçada; o relógio e as saídas numéricas usam algarismos tabulares onde configurados.

- **Title:** títulos de painel usam o token `title`; títulos de diálogo usam tamanho maior (17px), com peso (600).
- **Body:** o token `body` define o tamanho geral; botões e campos herdam a fonte.
- **Label:** metadados e rodapés usam o token `label`; rótulos auxiliares também aparecem em (11px) e (12px).
- **Code:** o token `code` registra a configuração inicial do editor. O tamanho é configurável; logs usam (10px), com entrelinha (1.9).

## Layout

A janela ocupa toda a altura. O transporte superior tem (66px) e a barra de estado (30px). A área intermediária é uma grade: biblioteca inicialmente com (240px), divisor ajustável de (4px), centro com mínimo de (320px) e inspetor com (232px). O centro empilha abas, editor flexível, visualizações e console.

As visualizações iniciam em (230px), com mínimo de (130px) e máximo CSS de (480px). A altura efetiva também é limitada pelo espaço vertical disponível, reservando o editor e, quando aberto, o console de (128px). Listas, editor e inspetor têm rolagem própria. Os espaços recorrentes estão no frontmatter; não há uma escala proporcional declarada no CSS.

Até (1200px), o inspetor passa a (208px) e informações auxiliares são ocultadas. Até (1000px), o inspetor fica recolhido por padrão; o botão Instrumento o abre sobreposto à direita, com largura (232px), entre o transporte superior (66px) e a barra de estado inferior (30px). Nesse intervalo, o relógio é ocultado, o rodapé fica mais compacto e a grade de configurações usa uma coluna. A implementação conserva o arranjo de trabalho de desktop.

## Elevation & Depth

Não há sombras declaradas no sistema. A profundidade vem dos fundos neutros e de bordas de (1px). Diálogos usam sobreposição escura (`#0009`); o aviso de erro usa borda na cor de erro. O editor permanece integrado ao fundo principal.

## Shapes

Botões e campos usam o raio `radius`; linhas da biblioteca e atalhos usam `compact`; diálogos usam `dialog`. Abas têm cantos retos. Medidores têm raio mínimo (1px). Ícones são contornos SVG, geralmente (17px), com espessura (1.5).

## Components

### Buttons

Botões compactos, com fundo transparente por padrão e altura mínima (32px). A ação primária usa ciano e texto na cor do fundo. O hover primário aplica brilho (1.12); botões comuns usam o fundo `hover`, e o estado ativo usa `selection`. O foco visível é um contorno ciano (2px), com deslocamento interno (-2px). Desabilitados usam opacidade (.45) e cursor de espera.

As transições de fundo e cor duram (.12s). O transporte usa botões quadrados (34px); tocar fica verde durante reprodução. A preferência por movimento reduzido remove transições.

### Inputs / Fields

Campos usam fundo principal, texto claro, borda neutra e o mesmo foco dos botões. A busca tem altura (34px), ícone à esquerda e espaço inicial (31px). Sliders e checkboxes usam a cor de destaque; os sliders têm altura (18px).

### Navigation

A biblioteca usa itens alinhados à esquerda, texto (12px) e intervalo (2px). O item ativo troca o texto para ciano e recebe fundo de seleção. Abas de arquivo usam texto secundário em repouso e sublinhado ciano (2px) quando selecionadas. Abas de visualização usam texto (11px) e a mesma indicação inferior.

### Panels / Dialogs

Painéis laterais são planos e usam fundo de superfície. Cabeçalhos têm altura (46px). Diálogos têm largura máxima (720px), margem lateral mínima (20px), corpo com padding (22px) e rolagem interna; cabeçalho e rodapé são separados por bordas.

### Medidores e editor

Medidores estéreo têm trilhas de (7px), fundo de painel e preenchimento verde, que muda para a cor de erro em clipping. A largura acompanha a medição com transição (.05s). Eventos ativos no editor recebem fundo de seleção e contorno ciano (1px); erros usam sublinhado ondulado na cor de erro.

## Do's and Don'ts

### Do:

- **Do** preservar o editor central e a organização em painéis de DAW.
- **Do** usar os tokens existentes para manter os papéis de cor nos dois temas.
- **Do** manter foco visível e diferenciar seleção, reprodução e erro.
- **Do** usar Fira Code no código e nas leituras numéricas já monoespaçadas.

### Don't:

- **Don't** transformar estados de áudio ou dispositivo em decoração sem dados reais.
- **Don't** substituir os estados de seleção e erro por cores sem relação com os tokens.
- **Don't** aplicar transições quando a preferência por movimento reduzido estiver ativa.
