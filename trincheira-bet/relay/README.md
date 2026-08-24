# Relay local — scan live a partir do IP de casa

## Porquê
A API-Sports aplica proteções ao nível do IP. Os Cloudflare Workers saem por IPs
partilhados, onde o tráfego de outros clientes provoca rejeições mesmo com a
nossa quota a 2%. O suporte confirmou por escrito (18/08/2026) que **não há
whitelist possível** e recomendou infraestrutura com IP de saída estável.

O IP de casa está verificado a funcionar: 298/300 por minuto, todos os headers.

## Como funciona
O Mac mini corre `relay.mjs`, que busca os dados à API-Sports e os entrega ao
worker em `POST /relay-run`. O worker continua a decidir tudo — as estratégias
nunca saíram de `worker/index.js`.

## Onde vive (importante)
O runtime está em `~/Library/Application Support/trincheira-relay/`, **não** aqui.
`~/Desktop` é protegida pelo TCC do macOS e agentes em segundo plano não lhe
acedem — o launchd devolvia exit 126. Os ficheiros aqui são cópia de referência;
para alterar o que corre, edita os de `Application Support` (ou edita aqui e copia).

## Arranque automático
`~/Library/LaunchAgents/pt.oleitech.trincheira-relay.plist`, com `RunAtLoad` e
`StartInterval 60`. Reinicia sozinho quando o Mac liga — não é preciso fazer nada.

## Comandos
```bash
launchctl list | grep trincheira     # 0 na 2ª coluna = saudável
tail -f ~/Library/Application\ Support/trincheira-relay/relay.log
launchctl unload ~/Library/LaunchAgents/pt.oleitech.trincheira-relay.plist  # parar
launchctl load   ~/Library/LaunchAgents/pt.oleitech.trincheira-relay.plist  # arrancar
```

## Travões de quota
- **Cadência**: o launchd dispara a cada 60s e o `run.sh` deixa passar só os
  minutos pares, **a todas as horas** — ~420 execuções na janela das 11h-01h.
  (Até 21/08/2026 este README dizia que o pico corria a cada 60s; era falso, a
  variável de hora no `run.sh` nunca chegou a ser usada.)
- **Orçamento**: `interestingBudget()` divide a quota restante pelos scans que
  faltam na janela, por isso **auto-escala ao plano** — não tem limiares fixos
  para acertar quando o plano muda. O que muda com o plano é só o tecto,
  `MAX_INTERESTING_PER_RUN`.
- **Plano actual: Ultra, 75.000/dia** (desde 21/08/2026; antes Pro, 7.500).
  `MAX_INTERESTING_PER_RUN = 60`, o que dá ~184 chamadas/scan no pico e ~40.000
  no dia — cerca de 54% da quota, com margem deliberada.
- **Custo por scan**: `RUN_OVERHEAD` 4 + `CALLS_PER_FIXTURE` 3. Medidos por
  regressão sobre 1376 scans reais, não estimados: subestimar aqui faz o
  orçamento prometer mais do que aguenta, que foi como a 19/08 o cap foi a 0 a
  meio da noite.

## Acoplamento a vigiar

Corre `node relay/filter-parity.test.mjs` depois de mexer em qualquer um dos lados.
Ele compara o `isInteresting()` daqui com o quick filter do `worker/index.js` e
falha se o runner deixar de cobrir algum estado que o worker pede. Tambem faz
fingerprint das linhas do filtro do worker, por isso acusa se o worker mudar e o
runner nao. Foi assim que se apanhou (21/08/2026) o `FAVORITO A PERDER` a nunca
disparar em resultados com as duas equipas a marcar.

Alem do filtro, o runner tem de trazer no bundle tudo o que o worker pede:
`fixtures?live=all`, `fixtures/statistics`, `fixtures/events`, `predictions` e
`odds/live`. Qualquer chamada nova no worker precisa de par aqui, senao da
`[RELAY-MISS]` e cai no IP estrangulado.
`isInteresting()` e `needsPredictions()` no `relay.mjs` **espelham** o bloco
"Quick filter" e o pre-warm do `handleScheduled`. Se mexeres nas condições do
worker, actualiza o runner — senão o worker pede dados que o runner não trouxe,
loga `[RELAY-MISS]` e volta a cair no IP estrangulado.

## Rollback
`launchctl unload` do agente. O worker volta a depender só do seu próprio cron
(que funciona de forma intermitente). Nada mais a desfazer.
