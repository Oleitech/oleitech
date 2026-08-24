# Tips Curadas — Workflow

**Comando único do utilizador:**
> "vamos gerar as tips de hoje" _(ou variantes: "tips para hoje", "tips para sábado", "gera as tips de [data]")_

Quando este comando dispara, segue **exatamente** o procedimento abaixo.
Podes (e deves) demorar o tempo que for preciso. Volume-alvo: **1–3 tips/dia**, muito seletivo.

---

## Passo 0 — Verificação obrigatória de Grand Slams / torneios major

**ANTES de qualquer outra coisa**, verifica se hoje cai dentro de um Grand Slam de tennis ou torneio NBA em playoff:

| Torneio | Período aproximado | Acção |
|---|---|---|
| Australian Open (ATP+WTA) | Jan 13–26 | **Tennis OBRIGATÓRIO** |
| Roland Garros (ATP+WTA) | 24 Mai–7 Jun | **Tennis OBRIGATÓRIO** |
| Wimbledon (ATP+WTA) | 30 Jun–13 Jul | **Tennis OBRIGATÓRIO** |
| US Open (ATP+WTA) | 25 Ago–7 Set | **Tennis OBRIGATÓRIO** |
| NBA Playoffs | Abr–Jun | **NBA OBRIGATÓRIO** |

Se a data-alvo cair dentro de um Grand Slam:
1. Corre `tips/tennis/WORKFLOW.md` **em paralelo** com o futebol (não opcional, não esquecível)
2. Usa WebSearch para obter o order of play do dia: `"Roland Garros [data] order of play"`
3. Identifica matches do dia por sessão (manhã / tarde / night session)
4. Dá prioridade a night session e afternoon matches — são os que ainda têm odds abertas quando as tips são geradas de manhã
5. Não gerar tips de tennis para matches já em curso ou terminados

**Nota:** Em Grand Slams a 1ª semana tem slate massivo (40-60 jogos/dia). Não tentar cobrir tudo — foca nos 3-5 jogos com mais angle claro (upset narrative, forma extremamente díspar, motivação especial).

---

## Passo 1 — Carregar contexto

1. Lê `config.js` para a `API_KEY` e `API_HOST` (`v3.football.api-sports.io`)
2. Lê `js/constants.js` para o `LEAGUES` map (id → name, country, flag, bttsRate, avgCorners, avgCards)
3. Determina a data-alvo (default: hoje em PT timezone) e calcula `YYYY-MM-DD`
4. Confirma que `tips/YYYY-MM-DD.json` ainda não existe (se existir, pergunta ao utilizador se quer substituir — se existir e for um update de tennis/NBA, fazer MERGE em vez de substituir)

## ⚙️ Protocolo de fetch da API (POUPAR TOKENS — obrigatório)

**Regra de ouro: NUNCA leias o JSON cru da API para o contexto.** As respostas da API-Football são enormes (o `/fixtures` de um dia traz *todos os jogos do mundo*; o `/odds` traz *todos os mercados*). Em vez disso:

1. Grava sempre a resposta num ficheiro de scratch.
2. Filtra/extrai só os campos necessários com `jq`.
3. Só o output do `jq` entra no teu contexto — o ficheiro cru fica em disco e nunca é lido inteiro.

Define o scratch dir uma vez no início (`DATE` = TARGET_DATE):

```bash
SCRATCH="/Users/oleitech/Desktop/generic_site_builder/projects/trincheira-bet/.cache/$DATE"
mkdir -p "$SCRATCH"
```

> Os `</dev/null` evitam o aviso `no stdin data received in 3s`. Se aparecer, é inofensivo — continua.

---

## Passo 2 — Fixtures do dia (API-Football)

Grava a resposta crua e extrai só as fixtures das ligas-foco (jamais leias `fixtures-raw.json` inteiro):

```bash
# IDs das ligas-foco (core + taças + tier 2 — ajusta conforme a lista abaixo)
LEAGUE_IDS="39,140,135,78,61,94,2,3,848,45,143,137,66,81,96,531,5,307,253,71,262,144,79,218,207,103,119"

curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures?date=$DATE&timezone=Europe/Lisbon" </dev/null \
  > "$SCRATCH/fixtures-raw.json"

jq -c --argjson ids "[$LEAGUE_IDS]" '
  [ .response[]
    | select(.league.id as $l | $ids | index($l))
    | { fixtureId: .fixture.id, kickoff: .fixture.date, status: .fixture.status.short,
        leagueId: .league.id, league: .league.name, country: .league.country,
        homeId: .teams.home.id, home: .teams.home.name,
        awayId: .teams.away.id, away: .teams.away.name } ]
' "$SCRATCH/fixtures-raw.json" > "$SCRATCH/fixtures.json"

cat "$SCRATCH/fixtures.json"   # ← só ISTO entra no contexto (lista curta e limpa)
```

A lista de prioridade das ligas (para escolheres quais analisar a fundo):

**Core (sempre olhar):**
- 39 Premier League · 140 La Liga · 135 Serie A · 78 Bundesliga · 61 Ligue 1
- 94 Liga Portugal
- 2 Champions League · 3 Europa League · 848 Conference League

**Tier 2 (olhar só se houver sinal forte na investigação):**
- 88 Eredivisie · 144 Pro League BE · 88 Eerste Divisie · 79 2.Bundesliga
- 88 + 218 + 207 + 103 + 119 (BTTS-strong leagues do `LEAGUES` map)
- 307 Saudi Pro League · 253 MLS · 71 Brasileirão · 262 Liga MX

**🏆 SEMPRE verificar finais e meias-finais de Taça** (mesmo se não estiverem na lista core acima):
- **45 FA Cup** (Inglaterra)
- **143 Copa del Rey** (Espanha)
- **137 Coppa Italia** (Itália)
- **66 Coupe de France** (França)
- **81 DFB-Pokal** (Alemanha)
- **96 Taça de Portugal** _(corrige se ID diferente — confirma via `/leagues?country=Portugal`)_
- **531 UEFA Super Cup**, **5 UEFA Nations League finals**

Lógica: estes jogos têm contexto diferente (jogo único, estádio neutro, motivação extrema) e a API não os capta nas ligas regulares. **Adicionado em 2026-05-16 após missing da FA Cup Final Chelsea-City.**

Procedimento: depois de filtrar fixtures pelas ligas core, faz uma segunda passagem por estas IDs de competições de taça nacionais/internacionais.

**Skip:**
- Ligas fora do `LEAGUES` map
- Ligas no `LEAGUE_PREGAME_BLACKLIST` — **TEMPORÁRIO até arranque da época 2026/27 (Aug 2026)**:
  - **Eredivisie** (NL) — BTTS-strong 60%+, voltar em Agosto
  - **Bundesliga Austria** — volátil, voltar em Julho/Agosto
  - **Pro League BE** — playoffs caóticos, voltar em Agosto
  - **3.Liga DE** — sample pequena, voltar em Agosto

Razão do blacklist: final de época nestes campeonatos = rotação massiva, equipas safe relaxam, promovidos/despromoção distorcem motivações, jovens da formação a estrear. O ruído supera qualquer análise pré-jogo. Em Setembro-Abril estes campeonatos voltam a ser candidatos válidos.

## Passo 3 — Análise matemática (API-Football, por fixture candidata)

Para cada fixture nas ligas-foco, recolhe via API. **Mesma regra: gravar cru → `jq` → só o `jq` entra no contexto.** Trabalha por fixture (`F=$FIXTURE_ID`):

```bash
# --- Predictions (model do API-Football) ---
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/predictions?fixture=$F" </dev/null > "$SCRATCH/pred-$F.json"
jq -c '.response[0] | {
  percent: .predictions.percent, advice: .predictions.advice,
  winner: .predictions.winner.name, under_over: .predictions.under_over,
  goals: .predictions.goals, comparison: .comparison,
  homeForm: .teams.home.last_5, awayForm: .teams.away.last_5,
  homeGoals: .teams.home.league.goals, awayGoals: .teams.away.league.goals
}' "$SCRATCH/pred-$F.json"

# --- H2H (só golos + BTTS por jogo) ---
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures/headtohead?h2h=$HOME_ID-$AWAY_ID&last=10" </dev/null > "$SCRATCH/h2h-$F.json"
jq -c '[.response[] | {date: .fixture.date, home: .teams.home.name, away: .teams.away.name,
  g: "\(.goals.home)-\(.goals.away)", btts: (.goals.home>0 and .goals.away>0)}]' "$SCRATCH/h2h-$F.json"

# --- Estatísticas de equipa (só médias relevantes) --- repete para HOME e AWAY
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/teams/statistics?team=$TEAM_ID&season=$SEASON&league=$LEAGUE_ID" </dev/null > "$SCRATCH/stats-$TEAM_ID.json"
jq -c '.response | {team: .team.name, form: .form,
  gf: .goals.for.average, ga: .goals.against.average,
  cleanSheet: .clean_sheet, failedToScore: .failed_to_score,
  btts_pct: (.goals.for.average.total)}' "$SCRATCH/stats-$TEAM_ID.json"

# --- Lesões/suspensões (só nome + razão) ---
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/injuries?fixture=$F" </dev/null > "$SCRATCH/inj-$F.json"
jq -c '[.response[] | {team: .team.name, player: .player.name, type: .player.type, reason: .player.reason}]' "$SCRATCH/inj-$F.json"

# --- Onzes (só disponível ~30-60 min antes) ---
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures/lineups?fixture=$F" </dev/null > "$SCRATCH/lineup-$F.json"
jq -c '[.response[] | {team: .team.name, formation: .formation, xi: [.startXI[].player.name]}]' "$SCRATCH/lineup-$F.json"

# --- Odds: o /odds é ENORME. Extrair SÓ os 3 mercados úteis do bookmaker preferido ---
# Betclic = 27; fallback Bet365 = 8, Pinnacle = 4
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/odds?fixture=$F&bookmaker=27" </dev/null > "$SCRATCH/odds-$F.json"
jq -c '.response[0].bookmakers[0].bets[]
  | select(.name=="Match Winner" or .name=="Both Teams Score" or .name=="Goals Over/Under")
  | {market: .name, values: .values}' "$SCRATCH/odds-$F.json"
```

> Se um `jq` vier vazio (campo ausente nessa resposta), inspeciona o ficheiro cru com um `jq` mais específico — mas nunca faças `cat` ao ficheiro cru inteiro para o contexto.

**Sinais matemáticos a extrair:**
- **BTTS rate** das duas equipas (casa/fora separadamente) — alvo: ambas ≥ 60%
- **Golos marcados/sofridos** por jogo, dentro/fora
- **H2H BTTS%** nos últimos 5-10 jogos
- **Forma** (últimos 5 — WWDLW etc.)
- **Clean sheets** (queremos POUCOS para BTTS)
- **Cantos médios** por equipa vs. média da liga (para mercado de cantos)
- **xG / xGA** se disponível em `predictions`
- **Probabilidades implícitas** das odds (1/odd) e juicy de margem

## Passo 4 — Pesquisa qualitativa (notícias, onzes, lesões)

**Para cada fixture candidata**, faz `WebSearch` ou `WebFetch` orientado:

### Por país/liga, fontes preferidas

| Liga / país | Jornais & sites de referência |
|---|---|
| **Premier League** | BBC Sport, Sky Sports (predicted XI), The Athletic, The Guardian, Football.London (Arsenal/Chelsea/Spurs), Liverpool Echo, Manchester Evening News |
| **La Liga** | Marca, AS, Mundo Deportivo (Barça), Sport (Barça), Diario Madridista (RM) |
| **Serie A** | Gazzetta dello Sport, Corriere dello Sport, Tuttosport, La Repubblica |
| **Bundesliga** | Kicker, Bild, Sport1, WAZ (Schalke/Dortmund) |
| **Ligue 1** | L'Équipe, Le Parisien (PSG), RMC Sport, La Provence (OM) |
| **Liga Portugal** | A Bola, Record, O Jogo, Maisfutebol, ZeroZero |
| **Eredivisie (NL)** _(em Aug 2026)_ | De Telegraaf (telesport), AD.nl, Voetbal International (vi.nl), ESPN.nl, 1908.nl (Ajax), Eindhovens Dagblad (PSV), Rijnmond.nl (Feyenoord) |
| **Pro League BE** _(em Aug 2026)_ | Het Laatste Nieuws (HLN), Sporza.be, La Dernière Heure (DH), Walfoot.be, Nieuwsblad |
| **Bundesliga AT** _(em Jul/Aug 2026)_ | Krone.at, Laola1.at, Sky Sport Austria, Salzburger Nachrichten (Salzburg), Kleine Zeitung (Sturm Graz) |
| **3.Liga DE** _(em Aug 2026)_ | Kicker, Sport1, jornais locais por clube (WAZ, Express, etc.) |
| **UEFA (CL/EL/UECL)** | UEFA.com + jornais dos dois países dos clubes |

### Sites estatísticos cross-liga (sempre úteis)

- **Sofascore** — predicted lineup, form, player ratings, current shape
- **FotMob** — predicted lineup, injury news consolidado
- **Whoscored** — form, key players, average ratings
- **Understat** — xG histórico (Top-5 ligas apenas)
- **FBref** — stats avançadas
- **Rotowire** — confirmed lineups (US-friendly)

### Queries-tipo

- `"[Home Team] predicted lineup vs [Away Team]"`
- `"[Home Team] injury news today"`
- `"[Liga] [matchday] preview"`
- `"[Player chave] fitness latest"`
- Jornais do país, em PT/EN/ES/IT/DE/FR conforme

### O que procurar

- **Onze provável publicado** (treinador deu pista? jornalista local confirmou?)
- **Lesões/suspensões de peso ofensivo ou defensivo** (esp. avançado e guarda-redes)
- **Estado motivacional** (jogo decisivo? meio de tabela? equipa B?)
- **Rotação esperada** (jogo europeu na 1/2 a meio de semana? eliminatória já decidida?)
- **Polémicas / tensão** (treinador em risco, lesões em série, derby acirrado)
- **Condições meteorológicas extremas** (chuva forte tende a aumentar BTTS, baixar cantos)

## Passo 4.5 — Cross-check com sites de tipsters (sentimento de mercado)

**ATENÇÃO ANTI-VIÉS (correcção 2026-05-16 v2):** Este passo tem de correr em DUAS fases distintas para evitar confirmação:

- **Fase A — Antes de qualquer pré-seleção** (entre Passo 1 e Passo 2): faz uma volta CEGA pelos sites de tipsters do dia. Procura `"best football tips today [data]"`, `"acca tips today"`, `"daily picks [data]"`. Anota **todas as picks consensuais** que surgirem, **sem filtrar** pela tua hipótese matemática (porque ainda não a tens). Cria uma lista bruta de candidatos.
- **Fase B — Após análise matemática + qualitativa** (depois do Passo 4): cruza a lista da Fase A com as tuas conclusões. Picks que aparecem nos dois lados → reforço real. Picks só na tua análise → re-avaliar se não estás a ver fantasmas. Picks só nos tipsters → considerar se a tese é defensável; pode ser um candidato que perdeste.

Sem esta separação, o cross-check vira **rubber-stamp** das escolhas já feitas e perde valor.

### Sites de previsões / tipsters (cross-check)

**Internacionais (Top-5 + UEFA + Cup finals):**
- **Sportsgambler.com** — predicted lineups + tip por mercado (BTTS, O/U, scorer)
- **Footballwhispers.com** — análise + tips
- **Lineups.com** — previsões DFS + odds
- **Sports Mole** — preview com team news e prediction
- **OneFootball** — previews dos editores
- **Goal.com / Goal.com betting tips** — análise editorial
- **ESPN** — preview detalhado para jogos grandes
- **FotMob predictions** — predicted lineup + xG-based pick
- **WhoScored** — preview estatístico + key player

**Sites de odds/movimentos & sentimento de apostadores:**
- **Oddsportal.com** — variação de odds entre casas (steam moves)
- **OddsChecker** — média e variação
- **Forebet** — predições com probabilidades em %
- **Statarea** — predições por modelo estatístico
- **Pickdojo / Footballpredictions.com** — agregador

**Portugueses (Liga Portugal e Taça PT):**
- **ZeroZero predictions** — palpites editoriais
- **Apostas10**, **Apostasonline tipsters**

### Queries-tipo

- `"[Home] vs [Away] [date] prediction tips"`
- `"[Home] vs [Away] anytime scorer pick"`
- `"[Home] vs [Away] BTTS over 2.5 tip"`
- `"[Match] expert preview"`

### O que extrair

1. **Tip consensus** — qual o mercado/pick que aparece em 3+ sites diferentes? (ex.: se 5 sites todos sugerem Over 2.5, há razão)
2. **Tip divergence** — onde é que os sites discordam? (sinal de incerteza real)
3. **Movimento de odds** — a odd do nosso pick subiu ou desceu nas últimas 24h? Steam-move a favor é validação; contra é red flag.
4. **xG-based picks** — pontos onde modelos matemáticos (Forebet, Statarea, FotMob) batem ou divergem do mercado
5. **"Underdog love"** — pick popular do underdog que reduz o value real do favorito (ou vice-versa)

### Regra

- **Consenso ≥3 sites + a nossa tese alinhada** → reforça a tip (+5 no score)
- **Divergência total (a nossa tese isolada)** → re-avaliar: temos sinal único ou estamos a ver fantasmas?
- **Steam contra a nossa tip nas últimas 12h** → adiar e re-verificar lineups, lesões de última hora
- **Nunca apostar só porque o consenso é forte** — o value pode já não existir; a tese matemática + qualitativa tem de continuar a fazer sentido

## Passo 5 — Cruzar e decidir

Para cada candidato, monta uma **tabela de decisão** mental:

| Dimensão | Sinal forte? |
|---|---|
| Matemático (BTTS rate, xG, H2H, forma) | ✅/⚠️/❌ |
| Onze ofensivo confirmado / sem ausências chave | ✅/⚠️/❌ |
| Defesas vulneráveis / sem peças centrais | ✅/⚠️/❌ |
| Contexto motivacional positivo | ✅/⚠️/❌ |
| Odd com value (≥1.55, sem ser óbvia) | ✅/⚠️/❌ |
| **Consenso de mercado (≥3 tipsters alinhados)** | ✅/⚠️/❌ |

**Regra:** uma tip vai a `tips/YYYY-MM-DD.json` apenas se ≥4 dimensões em ✅ ou (3 ✅ + 0 ❌ + contexto excepcional).

**Volume-alvo:** **1–5 tips/dia** (originalmente 1–3, alargado em 2026-05-16: o utilizador concorda com até 5 quando há jogos grandes / final de taça / pelo menos 2 ligas-foco em ação). **Dias com zero tips são esperados e válidos.**

**Equilíbrio de mercados:** evita concentrar tips no mesmo mercado se houver alternativas equivalentes. **Scorers é dos mercados mais difíceis** — limita a no máximo 1–2 picks de scorer por dia, e só quando o contexto é excecional (defesa adversária fraturada + jogador em forma + onze confirmado).

### Escolher o mercado que corresponde à tese (adicionado 24/08/2026)

**O BTTS não é o mercado por omissão.** A 24/08 as últimas 14 tips eram todas
"Ambas Marcam", por deriva na execução — não por regra. Custou dinheiro e
oportunidades:

- **Preço pior pela mesma tese.** A tip da Roma foi publicada em Ambas Marcam Não
  a 1.91, quando a tese escrita era "a Roma não sofre em casa". Esse é o mercado
  `Clean Sheet`, que pagava **2.20** — mais 15%.
- **Bilhetes que incluem o contrário da tese.** Esse mesmo Ambas Marcam Não também
  ganhava com a Fiorentina a vencer 1-0, o cenário oposto ao argumento.
- **Jogos deitados fora.** O Osasuna-Levante foi rejeitado por "sinais
  contraditórios". Não eram — eram BTTS-contraditórios. "O Levante sofre 2+ golos
  em 5 dos últimos 6 fora" é uma frase sobre o Osasuna marcar duas vezes, não
  sobre ambas marcarem. O Málaga-Deportivo tinha dois números independentes a
  apontar ao empate ao intervalo e não chegou a ser considerado.

**Procedimento:** depois de formar a tese, escreve-a numa frase e pergunta qual o
mercado que a exprime **exactamente**. Se o bilhete ganha em cenários que a tese
não prevê, é o bilhete errado — mesmo que a odd pareça atraente.

Mercados úteis para além do 1X2, todos disponíveis na API:

| Tese | Mercado | id |
|---|---|---|
| "X não sofre" | Clean Sheet - Home/Away | — |
| "X vence sem sofrer" | Win to Nil - Home/Away | — |
| "X marca N+ golos" | Total - Home / Total - Away | 16 / 17 |
| "a 1ª parte fica equilibrada" | First Half Winner | — |
| "o favorito não perde" | Double Chance | 12 |
| "jogador marca" | Anytime Goal Scorer | 36 / 38 |

**Continuam desactivados por decisão do utilizador (Abril/2026):** cartões,
cantos e over/under 2.5, retirados depois de -44€ nos cartões da LaLiga. Não
reabrir sem pedido explícito.

## Passo 5.5 — Cálculo de stake (Sistema B — bandas por score)

Aplica esta tabela a cada tip aprovada (definida 2026-05-16):

| Banda | Score | Stake |
|---|---|---|
| Alta confiança | **≥85** | **10€** |
| Média-alta | **75–84** | **7€** |
| Média | **65–74** | **5€** |
| Baixa | **<65** | **não apostar** |

**Regras adicionais:**
- O score sai da tabela de 6 dimensões (Passo 5). Não inflar scores para aumentar stake.
- Tipo de mercado **não** influencia stake (scorers, favorites, btts e corners usam as mesmas bandas) — o que diferencia é a robustez da tese, capturada no score.
- Total diário sugerido: até **40€** por dia em apostas (≈4 tips médias). Se 5 tips com 2+ em banda alta, podes ultrapassar — é decisão consciente.
- Stakes em euros (€), não em unidades, para alinhar com o tracking actual.

## Passo 5.6 — Construir Acumulador(es)

Depois de aprovadas as tips e calculadas as stakes (Passo 5.5), constrói acumuladores em **três fases**:

1. **Fase A — Acumuladores Standard** (pool restrito, tips aprovadas)
2. **Fase B — Acumuladores Curtos** (pool alargado, odds baixas, 3 pernas)
3. **Fase C — Acumulador Corvo** (2 pernas, Resultado + Total, combinada 1.7–2.2)

As Fases A e B partilham a regra R1 (nenhuma perna se repete entre acumuladores).
**A Fase C está fora dessa regra**: pode reutilizar um jogo já usado, desde que o
mercado seja outro — decisão tomada a 21/08/2026, com a contrapartida de a
sobreposição ter de ser declarada nas `notes` do dia.

**Objectivo de cada acumulador:** odd combinada entre **2.0 e 3.0**. Acima de 3.0 é demasiado arriscado; abaixo de 2.0 não vale a pena compor.

**Sem limite fixo de acumuladores** — o total depende de quantas pernas elegíveis existem no dia. Com N pernas na shortlist curta, geras ⌊N/3⌋ acumuladores curtos independentes.

---

### Regras de ouro (aplicam-se a TODOS os acumuladores)

**R1 — Nenhuma perna se repete entre acumuladores**
Se a perna A entra no Acumulador 1, não pode entrar no Acumulador 2. Partilhar uma perna significa que, se ela cair, perdemos os dois — anula o propósito de ter acumuladores independentes.

**R2 — Dentro do mesmo acumulador, nunca duas seleções do mesmo jogo**
BTTS + Over 2.5 no mesmo jogo são eventos altamente correlacionados. Dois mercados do mesmo fixture num acumulador é proibido.

**R3 — Preferir ligas/desportos diferentes entre pernas do mesmo acumulador**
Dois jogos da mesma liga no mesmo dia têm correlação escondida (clima, árbitros, calendário). Misturar Premier League + Serie A, ou futebol + NBA, é superior a dois jogos da Premier League.

**R5 — Máximo 3 pernas por acumulador**
Com 4+ pernas a margem composta da casa torna o acumulador matematicamente desfavorável mesmo com boas seleções.

---

### Fase A — Acumuladores Standard

**Pool:** todas as tips aprovadas do dia (qualquer desporto), ordenadas por score (maior primeiro).

**Regra extra (standard):**
**R4 — Cada perna tem de valer isolada**
Só entra uma tip que já passou os critérios individuais do Passo 5 (≥4 dimensões ✅). Nunca adicionar uma seleção fraca apenas para atingir a odd alvo.

**Algoritmo:**
1. Pool = tips aprovadas do dia, por ordem de score
2. Gera todos os **pares** (2 pernas) e **trios** (3 pernas) com produto ∈ [2.0, 3.0] e jogos diferentes
3. Filtra por R2/R3; ordena por score mínimo (maior primeiro)
4. Selecciona até 2 acumuladores (A = maior score; B = próximo sem partilhar perna com A via R1)
5. Se nenhum candidato em [2.0, 3.0] → Fase A não produz nenhum; avança para Fase B

**Score:** score mínimo das pernas incluídas
**Stake:** bandas Sistema B sobre o score mínimo (≥85→10€ · 75–84→7€ · 65–74→5€ · <65→não incluir)
**Label no JSON:** `"label": "standard"` (ou omitir — é o default)

---

### Fase B — Acumuladores Curtos (pool alargado)

**Racional:** 1.30 × 1.30 × 1.30 = 2.197 — três odds de 1.3 já fazem um acumulador acima de 2.0. Para odds assim baixas não é necessário o processo completo de curadoria individual.

O processo tem **dois sub-passos**: primeiro constrói a lista de pernas elegíveis, depois combina-as em trios.

---

#### Sub-passo B1 — Shortlist de pernas elegíveis

Varre todos os fixtures do dia (não só as ligas core — **sem qualquer restrição de liga ou país**; o blacklist de pré-jogo NÃO se aplica aqui) e identifica pernas candidatas com:

- **Odds: > 1.25 e ≤ 1.55** (estritamente acima de 1.25; abaixo é sem valor; acima de 1.55 vai para pool Standard)
- **Mercados elegíveis:** BTTS Sim, 1X2 favorito claro (probabilidade implícita >65%), Over 1.5 golos, DNB (empate devolve), handicap asiático 0, double chance
- **Filtro mínimo por candidata** (sem este filtro, não entra na shortlist):
  - H2H últimos 5 jogos alinhado com o pick (≥3/5 resultados favoráveis)
  - Forma recente alinhada (≥3/5 dos últimos jogos favoráveis)
  - Sem red flag evidente (lesão de GR / toda a defesa ausente para BTTS; rival em grande forma para 1X2)
- NÃO é necessário: pesquisa qualitativa completa, onze provável, tipsters cross-check

Apresenta a shortlist ao utilizador **antes** de montar os acumuladores:
```
📋 Shortlist de pernas curtas (odds 1.25–1.55):
  P1 — Celta Vigo -0.5 handicap @ 1.28  (H2H 4/5 ✅, forma 4/5 ✅)
  P2 — Betis BTTS Sim @ 1.35  (H2H 3/5 ✅, forma 5/5 ✅)
  P3 — Lazio Over 1.5 @ 1.30  (H2H 5/5 ✅, forma 4/5 ✅)
  P4 — Porto vitória @ 1.32  (H2H 4/5 ✅, forma 3/5 ✅)
  P5 — Marselha BTTS Sim @ 1.38  (H2H 3/5 ✅, forma 4/5 ✅)
  P6 — Udinese Over 1.5 @ 1.28  (H2H 4/5 ✅, forma 3/5 ✅)
  → 6 pernas elegíveis → 2 acumuladores independentes possíveis
```

---

#### Sub-passo B2 — Combinações 3 a 3

Com a shortlist de N pernas elegíveis, constrói **o máximo de acumuladores independentes** possível:

1. Agrupa as pernas em trios sem repetição, de jogos e ligas preferencialmente diferentes (R2/R3)
2. Cada trio deve ter produto ∈ [2.0, 3.0] — com odds 1.26–1.55 isto é garantido quase sempre (1.26³ = 2.00; 1.55³ = 3.72 — se ultrapassar 3.0, trocar uma perna por outra mais baixa)
3. **Sem limite de número** — se a shortlist tiver 9 pernas, geras 3 acumuladores (P1+P2+P3, P4+P5+P6, P7+P8+P9); se tiver 6, geras 2; se tiver 3, geras 1
4. Nenhuma perna se repete entre acumuladores Curtos (R1), nem entre Curtos e Standard (R1)
5. Ordena os trios pela força média das pernas (H2H + forma mais alinhados primeiro)

**Score do Acumulador Curto:** fixo em **65** (score base para selecções sem curadoria completa)
**Stake:** **3€** fixo por acumulador curto
**Label no JSON:** `"label": "curto"`

---

### Exemplo completo (1 tip aprovada, 6 pernas na shortlist)

```
Tips aprovadas: A (Bayern BTTS, score 80, odd 1.57)
Fase A: só 1 tip → impossível par/trio → 0 Standard

Shortlist Fase B (6 pernas):
  P1 Celta -0.5 @ 1.28  P2 Betis BTTS @ 1.35  P3 Lazio Over 1.5 @ 1.30
  P4 Porto 1X2 @ 1.32   P5 Marselha BTTS @ 1.38  P6 Udinese Over 1.5 @ 1.28

Trios:
  Curto 1: P1+P2+P3 → 1.28×1.35×1.30 = 2.247 ✅ (ligas: ESP, ESP, ITA — aceitar, sem alternativa)
  Curto 2: P4+P5+P6 → 1.32×1.38×1.28 = 2.330 ✅ (ligas: PT, FRA, ITA — ótimo ✅)
  → Sem sobreposição entre Curto 1 e Curto 2 ✅, nem com Standard (A não entra em curtos) ✅

Resultado: 0 Standard + 2 Curtos = 2 acumuladores
```

---

### Exemplo com Fase A a produzir acumuladores

```
Tips aprovadas: A (PL, score 82, odd 1.72), B (La Liga, score 78, odd 1.55), C (NBA, score 74, odd 1.45)

Fase A:
  Par A+B: 1.72×1.55 = 2.67 ✅  → Standard 1 (score mín 78, stake 7€)
  Segundo Standard: Par A+C e B+C partilham pernas com Std1 → 0 candidatos → 1 Standard

Shortlist Fase B: pernas que NÃO sejam A, B ou C (odds 1.26–1.55):
  P1 Porto 1X2 @ 1.32  P2 Atalanta BTTS @ 1.38  P3 Lille Over 1.5 @ 1.29
  P4 Villarreal DNB @ 1.40  P5 Wolfsburg BTTS @ 1.35  P6 Lens Over 1.5 @ 1.30

Trios:
  Curto 1: P1+P2+P3 → 1.32×1.38×1.29 = 2.350 ✅
  Curto 2: P4+P5+P6 → 1.40×1.35×1.30 = 2.457 ✅

Resultado: 1 Standard + 2 Curtos = 3 acumuladores
```

---

---

### Fase C — Acumulador Corvo (2 pernas, Resultado + Total)

Modelo adoptado a 21/08/2026, a partir dos boletins em `exemplos/corvo_bets/`.
Corre **em paralelo** com as tips curadas e com as Fases A e B — não as substitui.
**No máximo 1 por dia**, e dias sem combinação válida ficam sem ele.

#### A ideia

Nas 19 pernas analisadas, o "Total" quase nunca é o risco — é o **amplificador de
preço**. O Arsenal–Coventry pagava 1.20 na vitória simples; `V1 e TAb(5.5)` pagava
**1.31**. Aceita-se o risco minúsculo de uma goleada de 6+ golos para ganhar 9
pontos de odd. O núcleo é sempre um favorito claro ou uma dupla hipótese barata,
empurrada para cima por uma condição de golos que quase sempre se verifica.

Combinadas observadas nos boletins originais: 1.69, 1.72, 1.77, 1.78, 1.78, 1.80,
1.83, 1.92 — todas na metade de baixo da banda.

#### Mercados utilizáveis

Bookmaker de referência: **Marathonbet** (id 2 na API). Fallback: Superbet →
Betfair → 10Bet. **O Bet365 não serve** — só expõe a linha 2.5 do mercado
Resultado + Total.

| Mercado API | id | Uso |
|---|---|---|
| `Result/Total Goals` | 25 | Núcleo. `Home/Under 4.5`, `Home/Under 5.5`, `Away/Under 5.5`, `Home/Over 1.5` |
| `Total Goals/Both Teams To Score` | 49 | `o/yes 2.5` = ambas marcam + mais de 2,5 |
| `Double Chance` | 12 | Dupla hipótese simples |
| `Goals Over/Under` | 5 | Total simples |
| `Total - Home` / `Total - Away` | 16 / 17 | A equipa X marca (Over 0.5) |

**NÃO existe na API:** dupla hipótese **combinada** com total (`2X e TAb(4.5)`,
`1X e TAc(1.5)`). Verificado nos 14 bookmakers a 21/08/2026 — nenhum a expõe,
apesar de ser o grosso dos boletins originais. Se a vires no teu bookmaker e a
quiseres usar, a odd entra **à mão**; caso contrário fica de fora.

#### Regras

1. **Exactamente 2 pernas**, de **jogos diferentes**.
2. Cada perna entre **1.25 e 1.55**.
3. Combinada entre **1.70 e 2.20**. Fora disto **não se publica** — não esticar
   a banda para arranjar aposta.
4. Ligas: o mesmo country gate das restantes tips.
5. **Sobreposição permitida**: uma perna pode usar um jogo que já está numa tip
   curada **desde que o mercado seja diferente** (ex.: BTTS na tip, `V1 e TAb`
   no corvo). Quando acontecer, a `notes` do dia **tem de o declarar** — a
   exposição fica correlacionada e o registo não pode esconder isso.
6. **Curadoria intermédia** por perna: H2H (≥3/5 alinhado), forma recente
   (≥3/5) e **lesões/onze provável**. Este último não é opcional: `V1` exige
   que o favorito ganhe mesmo, e um titular ausente muda isso.
7. **Stake: 5 € fixos.** `score` = mínimo das duas pernas.
8. `label: "corvo"` no JSON. O `js/ui.js` mostra "Acumulador Corvo" e a casa
   de referência a partir daí.

#### Como escolher

Procurar favoritos claros (probabilidade implícita ≥65%) em que o mercado 25
ofereça `Under 4.5`/`Under 5.5` na banda 1.25–1.55. Um favorito a 1.20–1.35 na
vitória simples costuma dar exactamente isso. Evitar jogos de eliminatória com
segunda mão, onde o favorito pode gerir o resultado.

## Passo 6 — Rascunho no chat

Antes de gravar, mostra ao utilizador um rascunho compacto:

```
🟢 BTTS — Liverpool vs Arsenal (PL, 17:30)
   Pick: Sim @ 1.72 (Betclic) · Score 78 · Stake 10€

   Tese: [4-6 frases com onze, lesões, contexto, factor decisivo]

   Factors:
   - H2H 6/6 BTTS
   - Liverpool 9/10 BTTS em casa
   - Arsenal sem clean sheet fora há 12 jogos
   - Salah e Saka no onze

   Fontes: Sky Sports onze 11h00 · API-Football H2H · Sofascore

---
---
🔗 ACUMULADOR A · 2.67 combinada · Score mín: 78 · Stake: 7€
   1. ⚽ BTTS Sim — Liverpool vs Arsenal (PL) @ 1.72
   2. ⚽ Vitória Real Madrid — Real Madrid vs Sevilla (La Liga) @ 1.55
   [pernas de ligas diferentes ✅, sem sobreposição com Acumulador B ✅]

🔗 ACUMULADOR B · 2.28 combinada · Score mín: 74 · Stake: 5€
   1. ⚽ BTTS Sim — Bayern vs Stuttgart (DFB Pokal) @ 1.57
   2. 🏀 Over 218.5 — Celtics vs Cleveland (NBA) @ 1.45
   [cross-sport ✅, nenhuma perna partilhada com Acumulador A ✅]

🐦 ACUMULADOR CORVO · 1.83 combinada · Score mín: 71 · Stake: 5€  [Marathonbet]
   1. ⚽ Porto e Menos de 5.5 golos — Rio Ave vs Porto (Liga PT) @ 1.49
   2. ⚽ PSV e Mais de 1.5 golos — Excelsior vs PSV (Eredivisie) @ 1.23
   [jogos diferentes ✅, combinada dentro de 1.7–2.2 ✅]

   (ou "Sem acumulador hoje — nenhuma combinação cai entre 2.0 e 3.0.")
```

Espera validação humana antes de gravar.

## Passo 7 — Gravar JSON

Depois de validado, escreve `tips/YYYY-MM-DD.json` (schema em `tips/README.md`).
Confirma o `fixtureId` (do API-Football) — é o que liga ao `live-engine`.

## Passo 7.5 — Manutenção automática da star list (lineup-edge scanner)

Como side-effect da pesquisa que já fizeste nos Passos 1–4, **actualizar a star list global**
sem perguntar ao utilizador:

1. Buscar estado actual: `curl -s https://trincheira-live.rodrigo-fcp1997.workers.dev/stars`
2. Decidir mudanças:
   - **Adicionar**: novo top-scorer que apareceu na pesquisa (ex: jovem em break-out >5g em 5 jogos),
     ou jogador transferido para clube de uma liga-foco
   - **Remover**: transferido para fora das Top-5/Liga PT/UEFA, lesão longa (>3 meses), reformado
   - **Actualizar role**: se um jogador mudou de posição (raro)
3. Se houver mudanças → fazer `POST /stars` com a lista completa actualizada
   (substitui tudo de uma vez — manter sempre os ~40-60 nomes nucleares)

```bash
curl -X POST "https://trincheira-live.rodrigo-fcp1997.workers.dev/stars" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: lineuptoken" \
  -d '[<lista completa actualizada>]'
```

**Schema por jogador:**
```json
{ "name": "Watkins", "team_id": 66, "team_name": "Aston Villa", "role": "striker" }
```

**Roles válidos** (mapeados para mercado heurístico no worker):
- `striker`, `winger`, `playmaker` → Under 2.5 (perda ofensiva)
- `anchor_mid`, `top_cb`, `top_gk` → Over 2.5 / BTTS Yes (defesa exposta)

**Não perguntar ao utilizador.** Apenas reportar em 1 linha no fim das tips: "Star list:
+2/-1 mudanças aplicadas (X, Y adicionados; Z removido — motivo)."

Se a lista ficar com >70 nomes ou <30, sinalizar para revisão.

---

## Passo 8 — Reportar ao utilizador

Resumo final: ficheiro escrito + 1 linha por tip + lembrete de que a página
`index.html` já mostra automaticamente quando aberta hoje.

---

## Erros / situações comuns

- **Sem jogos das ligas-foco**: reporta vazio, sem inventar tips
- **Onzes ainda não publicados**: usa probable lineups da Sky/Sofascore. Se nenhuma fonte tiver, marca como ⚠️ na tese
- **API limit baixo**: prioriza fixtures core; usa cache em `Cache.js` quando possível
- **Conflito entre fontes**: privilegia jornal do país do clube, depois Sky/Sofascore, depois Understat
- **Lesão de última hora descoberta**: re-avaliar — pode ser anulação da tip
