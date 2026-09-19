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
