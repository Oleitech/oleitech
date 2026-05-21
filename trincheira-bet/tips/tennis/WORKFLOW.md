# Tennis Tips — Workflow

**Comando único do utilizador:**
> "vamos gerar as tips de hoje" (mesmo comando — o slate ATP/WTA é avaliado em paralelo)

**Regra de filtro absoluta:** **Só sugerir tips com odds ≥ 1.50.** Favoritos a 1.05-1.30 são automaticamente descartados — value vive nos mercados secundários.

---

## Diferenças vs futebol/NBA

| Dimensão | Tennis |
|---|---|
| Dados schedule | ESPN público + WebSearch (ATP/WTA sites) |
| API-Sports tennis | **Não disponível** (endpoint inexistente nesta key) |
| Métricas-chave | Forma recente, surface, H2H, fitness, fuso horário |
| Mercados-alvo | **Match winner (>=1.50), Games Total Over, Set Winner, Handicap games** |
| Janela KO | ATP/WTA: tarde europeia ou madrugada (US Open ~01-06 Lisboa) |
| Tipsters | Last Word on Sports, TennisAbstract, Tennis World, BettingPros tennis, Tennis Up to Date, Lineups.com |

---

## Passo 1 — Schedule do dia

ESPN público:
```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=YYYYMMDD"
curl -s "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard?dates=YYYYMMDD"
```

Devolve só tournaments e estados (round em curso). Para listas de jogos específicos por torneio:
- ATP Tour: `atptour.com/en/scores/current/<tournament-slug>`
- WTA Tour: `wtatennis.com/tournaments/<slug>/draws`
- Ou WebSearch: `"ATP <Tournament>" <date> schedule order of play`

**Filtros de prioridade (do mais para o menos importante):**
1. **Grand Slams** (AO, RG, Wimbledon, US Open) — 128 jogos / 1ª semana, foco em jogos prime time + UPSET potencial
2. **Masters 1000** (Indian Wells, Miami, Monte Carlo, Madrid, Rome, Canada, Cincinnati, Shanghai, Paris) — top players, profundidade de informação
3. **ATP/WTA 500** — boa cobertura, alguns top players
4. **ATP/WTA 250** — só QF/SF/Final + se houver upset narrative claro
5. **Challenger/ITF** — skip salvo se o user pedir explicitamente

## Passo 2 — Data de arquivo (mesma regra global)

Aplicar `getBettingDate` semantics (KO - 3h):
- KO entre **00:00-08:00 Lisboa** → ficheiro do dia ANTERIOR (user vê na noite anterior)
- KO entre **08:00-23:59 Lisboa** → ficheiro do dia do KO

**Ex:**
- US Open noturno 22/05 03:00 Lisboa → `tips/2026-05-21.json`
- Roland Garros 22/05 14:00 Lisboa → `tips/2026-05-22.json`

## Passo 3 — Análise por candidato

Para cada jogo candidato, recolher:

### Forma & contexto
- **Últimos 5-10 jogos:** wins/losses, surface, oponentes
- **Surface specialist?** (clay/grass/hard rating do jogador)
- **Fitness:** lesões recentes, retiros, set duro na ronda anterior
- **H2H entre os dois:** career, em superfície (decisivo se 4+ encontros)
- **Hora local + fuso:** chegou há 24h? jet-lag?
- **Motivação:** defending champion? home crowd? prize money?

### Stats granulares (TennisAbstract)
- **1st serve %**, **1st serve pts won**, **2nd serve pts won**
- **Break points saved / converted**
- **Return points won** (vs left/right handed)
- **Hold/Break %** na superfície

### Tipsters
- Last Word on Sports (preview QF/SF/Final)
- TennisAbstract Match Charting Project
- Tennis Up to Date predictions
- BettingPros tennis picks
- Lineups.com tennis preview
- TenniSphere/TennisInfinity
- Twitter/X: @TennisAbstract, @TennisGolden, @atpwtaInsider

## Passo 4 — Mercados-alvo (filtro odds >= 1.50)

### 1. Match Winner do underdog
- Quando: underdog com forma > favorito (5-2 vs 3-4), específico da surface, OU vantagem H2H
- Odd típica: 1.80-3.00
- Sweet spot: underdog ranking #20-40 vs top-10 inconsistente

### 2. Total Games Over (linha do jogo)
- Quando: dois bons sacadores em hard court (poucos breaks → mais games), OU jogadores de break tight
- Odd típica: 1.70-2.10
- Sweet spot: Over 22.5 num jogo BO3 onde se espera 2 sets longos + tie-break

### 3. Set Winner (especificamente 1º set para underdog)
- Quando: underdog está habitualmente a começar bem, favorito demora a aquecer
- Odd típica: 2.20-3.50
- Sweet spot: GS de manhã (top seed ainda morno)

### 4. Handicap games
- Quando: jogo prevê-se desequilibrado mas próximo
- "Underdog +3.5 games" odd típica 1.55-1.85
- "Favorito -3.5 games" odd típica 1.80-2.20

### Casos a evitar
- Favorito ML <1.40 (sempre) — no value
- BO5 de Grand Slam round 1 vs nameless qualifier — não vale o stake
- WTA top-50 contra ranking >150 — surpresas demais, market eficiente

## Passo 5 — Sistema de stakes (Sistema B, igual aos outros desportos)

| Banda | Score | Stake |
|---|---|---|
| Alta | ≥85 | 10€ |
| Média-alta | 75-84 | 7€ |
| Média | 65-74 | 5€ |
| Baixa | <65 | skip |

## Passo 6 — Schema JSON

```json
{
  "market": "tennis_match",
  "sport": "tennis",
  "pick": "Casper Ruud vence",
  "fixtureId": "geneva-sf-1",
  "home": { "name": "Casper Ruud", "logo": "..." },
  "away": { "name": "Jaume Munar", "logo": "..." },
  "league": "ATP 250 Geneva — Semifinal",
  "kickoff": "2026-05-22T11:00:00+01:00",
  "odds": 1.62,
  "bookmaker": "Bet365",
  "score": 75,
  "stake": 7,
  "tese": "...",
  "factors": [...],
  "sources": [...]
}
```

**Markets válidos:**
- `tennis_match` — Match Winner
- `tennis_games_total` — Total Games Over/Under
- `tennis_set_winner` — Set Winner (especificar 1º/2º/3º)
- `tennis_handicap` — Games Handicap

**Para tennis, `home`/`away` são os 2 jogadores.** "home" = primeiro nome listado no order of play / quem serve primeiro (convenção).

## Passo 7 — Merge

Mesma regra do NBA: se ficheiro do dia já existe, MERGE em vez de overwrite.

## Passo 8 — Tracking

ESPN scoreboard ou ATP/WTA sites para apurar resultado:
- Match Winner: simples win/loss
- Total Games: somar todos os games dos sets
- Set Winner: ver quem ganhou aquele set específico
- Handicap: aplicar +/- ao games count e comparar

Adicionar à `resultados/data/YYYY-MM-DD.json` em `curated_tips.tips[]` com `sport: "tennis"`.

---

## Limitações

- **Sem player props** (PRA-equivalente em tennis seria aces, double faults — só Bet365 oferece e é mercado fininho)
- **Sem star list scanner** (tennis não tem "lineup" — só withdrawal antes do match; já é coberto pelo Order of Play news)
- **Odds via WebSearch / Bet365** — confirmar Betclic PT antes de apostar
