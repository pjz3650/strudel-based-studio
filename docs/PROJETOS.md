# Formato de projeto v1

Extensão recomendada: `.live.json`. UTF-8, JSON, `format:"live-studio"` e `version:1`. O schema normativo é `src/shared/schema.ts` e o serializer é `src/shared/project.ts`.

| Campo | Conteúdo |
|---|---|
| `id`, `name`, `createdAt`, `updatedAt` | UUID, nome e timestamps ISO |
| `bpm` | Número entre 20 e 300 |
| `files` | 1 a 32 arquivos `{id,name,code}`; limite de 500.000 caracteres por arquivo |
| `activeFile` | UUID de uma aba existente |
| `samples` | Referências `{id,name}` a recursos da biblioteca; sem áudio incorporado |
| `presets`, `parameters`, `instrumentEnabled` | Presets e parâmetros globais opcionais |
| `midi` | Entrada, saída, canal 1–16 e associações de CC |
| `layout`, `visuals` | Divisórias, visibilidade, modo, FPS, FFT e escala |
| `metadata` | Autor e descrição |

O parser recusa versões desconhecidas, BPM/valores inválidos, abas duplicadas e aba ativa inexistente. Campos opcionais recebem padrões compatíveis; versões futuras devem acrescentar uma migração explícita em vez de aceitar silenciosamente dados incompatíveis. Limite de leitura de projeto: 20 MB.

A gravação temporária e o rename ocorrem no mesmo diretório do destino. Os writes são serializados por caminho, e o arquivo temporário é removido em caso de falha. O salvamento não substitui backups externos e não resolve conflitos de sincronização do OneDrive.

`recovery.json` usa o mesmo formato ou `null` quando não existe sessão recuperável. As preferências globais não ficam dentro da instalação. Referências a samples são locais à biblioteca; não há arquivo portátil que incorpore/empacote os samples nesta versão.
