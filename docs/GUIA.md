# Guia de uso

## Compor e tocar

O projeto inicial usa sintetizadores nativos e funciona sem internet. Clique em Tocar ou use Ctrl+Enter. Enquanto toca, edite e execute de novo para aplicar o código no scheduler. Stop/Ctrl+. interrompe e envia encerramento de notas MIDI. Reiniciar para e executa do início.

O campo BPM usa quatro batidas por ciclo. Para polirritmia, transformações, efeitos e mini-notation, consulte a [documentação oficial](https://strudel.cc/learn/). O motor preserva essas APIs; serviços opcionais externos não fazem parte do modo offline.

Cada aba é um arquivo salvo no projeto. Executar aplica apenas a aba ativa. Camadas simultâneas usam `$:` ou `stack(...)` na mesma aba. Desfazer/refazer é independente por arquivo. O autocomplete inclui funções musicais comuns, sem prometer cobertura de toda a API.

Se uma avaliação falhar, a execução anterior continua. O console e o aviso mostram o diagnóstico. Recuperar último código válido restaura a última avaliação bem-sucedida. Não existe proteção contra um loop JavaScript infinito; reabra o app para recuperar a sessão se o renderer travar.

## Projetos

Use Novo, Abrir, Salvar, Salvar como ou Duplicar no transporte/menu Arquivo. O nome pode ser alterado clicando no título do projeto. Salvar usa `.live.json`. Projetos recentes aparecem na biblioteca. Criar, abrir ou fechar com alterações exibe opções Salvar, Descartar e Cancelar.

A recuperação automática, configurável em Editor, grava após 700 ms de inatividade. Após encerramento inesperado, o app oferece a sessão recuperada na própria interface. Salve uma cópia; o caminho de salvamento anterior não é automaticamente assumido. O salvamento explícito continua necessário para manter um arquivo de projeto.

## Samples

Importe arquivos ou uma pasta. São aceitos WAV, MP3 e OGG com até 200 MB por arquivo. A decodificação efetiva depende do codec suportado pelo Chromium. WAV foi exercitado nos testes; MP3/OGG ainda exigem validação de arquivos reais de diferentes codificações.

O aplicativo não copia nem move os arquivos originais. Na biblioteca:

- Botão Play: pré-escuta e leitura da duração quando o buffer for decodificado.
- Nome: insere `s("sample_nome*4")` no editor.
- Estrela: adiciona/remove favorito.
- Pasta: cria ou altera a categoria daquele sample.
- Verificar arquivos ausentes: confere as referências. Um sample ausente pode ser reassociado por seleção de novo arquivo.

Busca considera identificador, nome original e categoria. Não há monitoramento contínuo de diretórios nem editor de áudio. Para renomear uma categoria inteira, altere seus samples individualmente; operações coletivas ainda não existem.

Projetos guardam referências, não áudio incorporado. Ao mover o projeto para outro computador, também transfira os samples e importe-os novamente. Se necessário, ajuste os identificadores no código. Um sample ausente pode ter seu caminho corrigido sem mudar seu ID dentro da biblioteca atual.

## Instrumentos e presets

Volume, ADSR, low-pass, ressonância, reverb, delay e pan correspondem a parâmetros reais do Strudel/SuperDough. A opção Aplicar a todos os padrões transforma o padrão na próxima avaliação. Mudanças manuais no painel são aplicadas ao confirmar o slider durante a reprodução. Presets salvam esses valores no projeto; aplique o preset e atualize o código.

O volume master sempre atua na saída final. Os medidores são pós-master e mostram os canais disponíveis na mistura estéreo. Clipping significa amostras com módulo >=1; diminua ganho/volume. Não é uma medição de loudness.

## Visualizações e layout

Escolha Piano roll, Osciloscópio, Espectro ou Ritmo. A pausa congela somente o desenho. Configurações → Visualizações permite FPS, FFT e escala do sinal. Não há notas de demonstração nas visualizações: elas dependem do padrão real.

Arraste as divisórias ou use as setas com o separador focado. A altura se adapta ao espaço disponível. Na janela estreita, Instrumento abre um painel sobreposto. Console e instrumento podem ser recolhidos pela barra de estado. Temas, fontes, destaque e atalhos são configuráveis; as preferências persistem.

## MIDI e loopMIDI

1. Conecte um controlador ou, opcionalmente, instale loopMIDI e crie uma porta virtual.
2. Configurações → MIDI → Ativar MIDI.
3. Escolha entrada, saída e canal. Selecione a porta na faixa da DAW e ative monitoramento.
4. Use Enviar C4 para testar Note On/Off e depois execute um padrão.

```javascript
note("c3 eb3 g3 bb3")
  .velocity(0.65)
  .midichan(1)
  .midi('Live Studio Out')
```

A porta precisa existir e o nome deve corresponder ao dispositivo detectado. Deixe a saída global vazia para definir rotas por padrão no código. Em Learn, selecione Volume, BPM, Filtro ou Pan e mova um controle CC. Para Filtro/Pan, o instrumento global é ativado. As associações são salvas no projeto.

Desconexões são informadas. Após reconectar, atualize a lista se necessário; uma porta renomeada deve ser selecionada novamente. Panic envia encerramento de notas e silêncio. A implementação foi testada com portas simuladas; não houve dispositivo físico ou loopMIDI disponível nesta entrega.

## Áudio, VB-CABLE e DAWs

Configurações → Áudio lista saídas disponibilizadas pelo Chromium. Se `AudioContext.setSinkId` não estiver disponível, use o mixer de volume do Windows. Um dispositivo salvo ausente provoca retorno à saída padrão, com diagnóstico.

Para gravar em Ableton Live, FL Studio, REAPER ou outra DAW:

1. Instale VB-CABLE separadamente.
2. Selecione **CABLE Input** como saída do Live Studio.
3. Selecione **CABLE Output** como entrada de uma faixa de áudio na DAW.
4. Arme a gravação e ajuste monitoramento, evitando retorno ao mesmo cabo.

Drivers virtuais, instrumentos da DAW e gravação são fornecidos por programas externos. Live Studio usa Web Audio e os dispositivos de áudio do Windows; não oferece ASIO nativo ou plugins VST. A latência exibida é informada pelo AudioContext, sem controle fictício de buffer. O roteamento físico/virtual ainda precisa ser validado nesses programas.

## Solução de problemas

| Sintoma | Verificação |
|---|---|
| Não toca | Clique em Tocar para liberar o AudioContext; confira volume master, ganho e saída Windows. |
| Sample ausente | Verifique a biblioteca e reassocie o arquivo. Projetos não carregam caminhos arbitrários automaticamente. |
| Erro no código | Consulte console e recupere o último código válido. Funções não importadas ou recursos remotos podem não estar disponíveis. |
| MIDI sem portas | Ative MIDI, confirme driver/loopMIDI e reinicie a porta. A tela pode legitimamente mostrar 0 entradas/0 saídas. |
| Notas presas | Use Stop ou Panic. Confira também o monitoramento da DAW. |
| Estalos ou travamentos | Reduza polifonia, reverberações e FPS; não execute loops JS infinitos. O cache de samples cresce sob demanda. |
| Configurações inválidas | O app restaura padrões e mantém backup `.corrupt-*` no diretório de dados. |
| Acesso negado ao salvar | Escolha uma pasta gravável e confira bloqueios do Windows/OneDrive. |
| SmartScreen | O build não é assinado. Confira origem e checksum antes de executar. |

Para reportar um problema, inclua versão, passos, trecho mínimo de código e diagnóstico, omitindo dados pessoais e arquivos sem autorização.
