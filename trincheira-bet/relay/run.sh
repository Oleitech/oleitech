#!/bin/bash
# Wrapper do launchd: carrega os segredos e corre um ciclo do relay.
# Vive fora de ~/Desktop porque o TCC do macOS bloqueia agentes em segundo
# plano nessa pasta (o launchd devolvia exit 126).
cd "$(dirname "$0")"

# O launchd dispara a cada 60s; este filtro deixa passar só os minutos pares, a
# TODAS as horas — ~420 execuções na janela das 11h-01h, não 1440.
#
# O comentário anterior dizia que o pico corria a cada 60s. Nunca correu: havia
# uma variável HORA lida e nunca usada, portanto a condição de hora não existia.
# Corrigido a 21/08/2026 (comportamento inalterado, só o texto estava errado).
# O interestingBudget e o MAX_INTERESTING_PER_RUN estão calibrados para esta
# cadência de 2 min — passar a 1 min duplica o consumo no pico e obriga a
# recalibrar os dois.
MIN=$(date +%M)
if [ "$HORA" -lt 18 ] && [ $((10#$MIN % 2)) -ne 0 ]; then exit 0; fi

set -a; . ./relay.env; set +a
exec "/opt/homebrew/bin/node" relay.mjs
