# Remates - recolha em sombra

Registo do mercado de remates e remates a baliza. **Nao aposta nada.** Guarda, todos os dias, a
previsao do modelo ao lado da linha real da casa, e no dia seguinte marca quem esteve mais perto.

Existe porque a 17/09/2026 a medicao de 1755 jogos deu correlacao de so 0.22 - sinal fraco - e o
apanhado do dia dava vantagens de 30 a 100%, que e o sintoma classico de um modelo partido e nao
de um mercado mal cotado. Antes de arriscar uma stake e preciso ver o modelo a competir com a casa
em jogos reais, sem dinheiro em cima.

## Ficheiros

- previsoes/AAAA-MM-DD.json - o que o modelo disse antes dos jogos e o que a casa cotava
- scripts/prever.mjs - escreve as previsoes do dia
- scripts/avaliar.mjs - preenche os resultados reais e marca quem ganhou

## Regras

1. **So ligas medidas.** Eredivisie, La Liga, Bundesliga, Brasileirao, Premier. As medias de cada
   uma vivem em scripts/prever.mjs. Uma liga nao medida nao entra: nao ha ancora para encolher a
   previsao para a media certa.
2. **Jogo sem estatisticas e descartado, nunca vale zero.** Foi este defeito que inflacionou as
   vantagens todas na primeira tentativa. Tacas e jogos de seleccoes vem com Total Shots a null.
3. **Amostra curta fica marcada.** Menos de 6 jogos utilizaveis por equipa grava amostra_fraca a
   true. Em Setembro de 2026 quase nenhuma equipa chega la, e e essa a razao de isto comecar em
   sombra em vez de comecar com stakes.
4. **Nada disto vai para o site, para a banca ou para o P&L.**

## Como ler o resultado

A pergunta e so uma: quando o modelo e a casa discordam, quem fica mais perto do valor real?
Se a casa ganhar a maioria, isto morre aqui e poupamos o dinheiro. Se o modelo ganhar de forma
consistente numa liga, comeca-se por ai. A candidata e a Eredivisie, onde mais de 8.5 a baliza
entrou em 71% dos 308 jogos da epoca passada.

## Uso

    node remates/scripts/prever.mjs            # jogos das proximas 48h
    node remates/scripts/avaliar.mjs 2026-09-17   # confronta com o que aconteceu

## Quando passa a tip (criterio combinado com o dono a 17/09/2026)

O dono quer uma seccao de remates no site **so quando houver valor claro**. Claro quer dizer:

- pelo menos **150 linhas avaliadas** (cerca de um mes do ciclo diario), e
- o modelo **mais perto do valor real do que a casa** na maioria delas, e
- retorno simulado **positivo na Bet365 ou na Marathonbet** nas linhas com valor, nao na melhor odd do mercado.

Antes disso, qualquer numero e ruido. O ciclo das 07:00 corre isto todos os dias desde 18/09
(`prever.mjs 1`, so os jogos do proprio dia, para que o `avaliar.mjs` do dia seguinte feche tudo).
O ficheiro de 2026-09-17 e excepcao: tem jogos de 17 e 18/09, e os de 18/09 podem aparecer
tambem no de 2026-09-18. Ao somar, contar cada `fixture` uma vez.

## Zonas ataque/defesa (desde 24/09/2026)

Tese de um video sobre o grafico de analise da BeSoccer: as duas equipas na zona defensiva dao
mais de 7.5 cantos em 95% dos jogos; as duas na zona de ataque dao mais de 8.5 remates a baliza em
perto de 90%. O dono quer isto implementado.

**A API da BeSoccer (plano free, chave em `besoccer/besoccer.env`, 500 pedidos em 7 dias)** so da o
nivel 1: Premier, LaLiga e Segunda, tabela classificativa e lista de jogos. O grafico do app nao
existe em nenhum nivel da API. A tabela da golos marcados e sofridos, que e o mesmo que a
API-Football ja da, e e com isso que o perfil se calcula.

**Epoca 2025/26, 2283 jogos de 8 ligas, perfil so com jogos anteriores** (`scripts/zonas.mjs`,
`scripts/zonas-analise.mjs`, `scripts/zonas-quintis.mjs`):

- Cantos: quanto mais defensivas, **menos** cantos. 20% mais defensivos: 9.45 de media, mais de 6.5
  em 78.8%, mais de 7.5 em 69.1% (o resto das ligas da 72-75%). A Marathonbet paga 1.09 no mais de
  7.5 cantos; para dar lucro a 69% precisava de 1.45.
- Remates a baliza: sinal verdadeiro. 20% mais atacantes: mais de 7.5 em 73.1% (61% nos menos
  atacantes), mais de 8.5 em 56.5%. Ponto de equilibrio 1.37 e 1.77. As casas pagam a volta disso,
  mas cotam os jogos um a um e ja veem os mesmos golos, por isso so as odds reais dizem se sobra.
- Por liga, no mais de 7.5 a baliza: Eredivisie 91%, Bundesliga 84%, Ligue 1 79%, LaLiga 78%,
  Primeira Liga 65%, Premier 65%, Brasileirao 63%, Serie A 55%.

`scripts/zonas-prever.mjs` marca os jogos do dia que caem numa zona e guarda a odd Bet365/Marathonbet
da linha. `scripts/zonas-avaliar.mjs` fecha os terminados e imprime o acumulado. Corre no passo 1b
do ciclo. Nada disto vai para o site, para a banca ou para o P&L sem ordem do dono.

**Seleccoes** (`scripts/zonas-selecoes.mjs`, 392 jogos oficiais 2024-2026: Liga das Nacoes, Euro, Copa
America, qualificacoes e Mundial 2026). Perfil com os ultimos 10 jogos oficiais. Cantos outra vez ao
contrario: 20% mais defensivos com mais de 7.5 em 55.7%, o pior quintil. Remates a baliza, 20% mais
atacantes: mais de 7.5 em 65.8%, mais de 8.5 em 54.4% (equilibrio 1.52 e 1.84). Sinal mais fraco
que nos clubes. `scripts/zonas-selecoes-prever.mjs` regista a janela em curso no mesmo ficheiro diario.

## So Over desde 24/09/2026 (decisao do dono)

Nos 82 mercados avaliados de 17 a 20/09, as melhores linhas do lado Under (45) perderam 22.6 stakes com
vantagens anunciadas de 20 a 25% em odds perto de 3.9: a curva normal com desvio fixo subestima os jogos
com muitos remates. O lado Over (37) deu +9.3, quase todo de meia duzia de odds compridas, ou seja ruido.
O `prever.mjs` so escolhe linhas Over. Os ficheiros anteriores a 24/09 ainda tem Under; ao somar para a
revisao de 30/09, separar por `melhor_linha.lado`.

## Cantos por equipa (desde 24/09/2026)

Cantos totais do jogo nao se preveem: em 2283 jogos de 2025/26 o perfil das equipas da correlacao 0.113,
contra 0.107 so com a media da liga. Os 10% de jogos com previsao mais baixa acabaram com 9.5 cantos, os
10% mais altos com 10.0. Os cantos de uma equipa so preveem-se o dobro (0.226): (cantos que ganha + cantos
que o adversario cede) / 2 nos ultimos 10 jogos da liga.

Modelo (`scripts/cantos-calibrar.mjs`, ajustado na 1a metade da epoca e validado na 2a): media da liga +
0.702 x desvio do perfil, mais 0.48 em casa e menos 0.48 fora, binomial negativa com variancia 1.54 x media.
As probabilidades batem certo fora da amostra (ex.: mais de 4.5 previsto 52%, real 55%).

`scripts/cantos-prever.mjs` guarda todas as linhas .5 da Bet365/Marathonbet e marca um sinal por equipa
quando o valor passa 5%. `scripts/cantos-avaliar.mjs` fecha e imprime o acumulado a meia stake.
Teste com um jogo antigo: `TESTE_FIXTURE=<id> node remates/scripts/cantos-prever.mjs` (escreve teste.json,
apagar depois). **Decisao do dono:** apostas a meia stake no inicio de Novembro de 2026 se houver 150
sinais fechados com retorno positivo.
