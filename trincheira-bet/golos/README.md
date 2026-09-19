# Golos — mais/menos 2.5 pelo modelo GAP

Implementacao da tese do video da Bet Angel (17/09/2026), que e o artigo de Wheatcroft (2020),
*A profitable model for predicting the over/under market in football*, International Journal of
Forecasting 36(3). Grava a previsao todos os dias e no dia seguinte marca o
resultado.

## A tese

Os golos sao ruido para prever golos. O que prevê melhor e a pressao: **remates + cantos**. Cada
equipa tem quatro classificacoes (ataque e defesa, em casa e fora) que se actualizam depois de cada
jogo pelo erro entre o previsto e o que aconteceu (taxa `lambda`, repartida casa/fora por `phi`).
A pressao prevista do jogo e `(ataque casa + defesa fora)/2 + (ataque fora + defesa casa)/2`, e a
probabilidade sai de uma regressao logistica que tambem leva a odd do mercado:

    P(mais de 2.5) = 1 / (1 + e^-(a + b1*pressao + b2*logit(mercado)))

## O que a medicao disse (backtest.mjs, 17/09/2026)

21 ligas europeias, 2005-2026, dados football-data.co.uk. Parametros afinados em 2012-2017
(`lambda` 0.2, `phi` 0.5), teste fora da amostra em 2018-2026 (51 mil jogos), coeficientes de cada
epoca ajustados so com as 6 anteriores.

| | log-loss (menor = melhor) |
|---|---|
| so mercado | **0.67757** |
| so pressao | 0.68563 |
| pressao + mercado | 0.67773 |

| apostas (valor > 5%) | odd media | odd maxima entre casas |
|---|---|---|
| so mercado | -9.3% (410) | -1.1% (2721) |
| pressao + mercado | -4.6% (1756) | **+1.2% ± 1.2** (7103) |

- **A pressao sozinha perde para o mercado.** Junta a ele nao melhora a previsao.
- **So da lucro a odd maxima entre todas as casas**, e mesmo ai e um erro-padrao — nao se distingue
  de zero. Por epoca: +5.3, +1.2, +4.8, +0.1, -4.0, +6.6, **-4.6 (2025/26)**.
- A odd media perde sempre. Quem aposta numa casa so esta perto da media, nao do maximo.
- O artigo cobria 2007-2019. O mercado de 2.5 ficou mais eficiente desde entao.

Conclusao: a tese e verdadeira na parte do ruido (a pressao tem sinal), mas o sinal ja esta
dentro da odd. Nao ha vantagem demonstrada para apostar. Ficou em sombra ate 17/09/2026; a partir
dai os sinais com valor entram nas tips com meia stake, a titulo de teste (regra 5).

## Ficheiros

- `scripts/gap.mjs` — o modelo (classificacoes, logistica). `node golos/scripts/gap.mjs` testa-o.
- `scripts/backtest.mjs [limiar] [media|max]` — repete a medicao acima (~2 s).
- `scripts/prever.mjs [dias]` — previsoes das proximas 48 h em `previsoes/AAAA-MM-DD.json`.
- `scripts/avaliar.mjs [data]` — fecha os jogos e soma o balanco acumulado.
- Historico em `.cache/gap/Matches.csv` (github.com/xgabora/Club-Football-Match-Data-2000-2025;
  o football-data.co.uk bloqueia pedidos automaticos). Os jogos depois do fim do CSV vem da
  API-Football, com estatisticas guardadas em `.cache/gap/stats/`.

## Regras

1. **Jogo sem remates ou cantos e descartado, nunca vale zero.**
2. **Menos de 6 jogos por equipa = sem previsao.** No inicio de epoca as classificacoes vem da
   epoca anterior; equipas promovidas comecam na media da liga.
3. **`sinal` = valor >= 5% a odd maxima.** Grava-se tambem o valor na Marathonbet e na Bet365,
   que e onde se aposta de facto.
4. **Nomes:** a API e o CSV escrevem as equipas de forma diferente. Os pares saem com
   `PARES=1 node golos/scripts/prever.mjs`; os que falham vao para `sem_par` e o jogo nao entra.
   Quando aparecer uma equipa nova sem par, acrescenta-la a `ALIAS` em `prever.mjs`.
5. **Desde 17/09/2026 os sinais podem virar tips, com meia stake.** Decisão do dono: *"vamos por meia
   stake até que testamos a fórmula"*. Só entram sinais com valor ≥5% na Bet365 ou na Marathonbet, e
   passam pela investigação normal das tips. Regras completas em `tips/WORKFLOW.md`, Passo 5. As
   previsões sem sinal continuam a ser só registo.

## Quando reabrir

So com **300 sinais fechados ou mais** e ROI positivo **na Marathonbet ou na Bet365**, nao na odd
maxima. Abaixo disso, qualquer numero e ruido (erro-padrao ~6% com 300 apostas).
Actualizar o CSV quando o repositorio mudar: o `prever.mjs` completa pela API, mas cada chamada
conta na quota.
