# Tips Curadas — Workflow

**Comando único do utilizador:**
> "vamos gerar as tips de hoje" _(ou variantes: "tips para hoje", "tips para sábado", "gera as tips de [data]")_

Quando este comando dispara, segue **exatamente** o procedimento abaixo.
Podes (e deves) demorar o tempo que for preciso. Volume-alvo: **1–3 tips/dia**, muito seletivo.

---

## Passo 1 — Carregar contexto

1. Lê `config.js` para a `API_KEY` e `API_HOST` (`v3.football.api-sports.io`)
2. Lê `js/constants.js` para o `LEAGUES` map (id → name, country, flag, bttsRate, avgCorners, avgCards)
3. Determina a data-alvo (default: hoje em PT timezone) e calcula `YYYY-MM-DD`
4. Confirma que `tips/YYYY-MM-DD.json` ainda não existe (se existir, pergunta ao utilizador se quer substituir)

## Passo 2 — Fixtures do dia (API-Football)

```bash
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures?date=YYYY-MM-DD&timezone=Europe/Lisbon"
```

Filtra pelas **ligas-foco**, por esta ordem de prioridade:

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
- Ligas no `LEAGUE_PREGAME_BLACKLIST` (Eredivisie, Bundesliga Austria, Pro League BE, 3.Liga DE — calibração fim-de-época)

## Passo 3 — Análise matemática (API-Football, por fixture candidata)

Para cada fixture nas ligas-foco, recolhe via API:

```bash
# Predictions (model do API-Football)
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/predictions?fixture=$FIXTURE_ID"

# H2H entre as duas equipas
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures/headtohead?h2h=$HOME_ID-$AWAY_ID&last=10"

# Estatísticas de equipa na época
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/teams/statistics?team=$TEAM_ID&season=$SEASON&league=$LEAGUE_ID"

# Lesões e suspensões
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/injuries?fixture=$FIXTURE_ID"

# Onzes (só disponível ~30-60 min antes)
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/fixtures/lineups?fixture=$FIXTURE_ID"

# Odds (preferir Betclic = bookmaker id 27; senão Bet365 = 8, Pinnacle = 4)
curl -s -H "x-apisports-key: $API_KEY" \
  "https://v3.football.api-sports.io/odds?fixture=$FIXTURE_ID&bookmaker=27"
```

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
```

Espera validação humana antes de gravar.

## Passo 7 — Gravar JSON

Depois de validado, escreve `tips/YYYY-MM-DD.json` (schema em `tips/README.md`).
Confirma o `fixtureId` (do API-Football) — é o que liga ao `live-engine`.

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
