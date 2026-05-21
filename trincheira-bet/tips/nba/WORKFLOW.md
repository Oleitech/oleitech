# NBA Tips — Workflow

**Comando único do utilizador:**
> "vamos gerar as tips de hoje" (mesmo comando do futebol — o slate de cada desporto é avaliado em paralelo)

Quando há jogos NBA elegíveis (Conference Finals / Finals ou regular season seleccionada),
segue este procedimento adaptado do `tips/WORKFLOW.md` do futebol.

---

## Diferenças vs futebol

| Dimensão | Futebol | NBA |
|---|---|---|
| Origem dos dados | API-Football (v3) | **ESPN público** (free, sem auth, sem quota) + WebSearch |
| Métricas-chave | xG, BTTS rate, posse, SoT | **Pace, ORtg, DRtg, FG%, Total Points avg** |
| Mercado-alvo | BTTS / Favorito / Scorer | **Over/Under Total Points** (principal), spread, moneyline |
| Lineup window | ~T-60min | **Injury Report oficial ~T-30min** |
| Tipsters | Sportsgambler, Racing Post | Action Network, BettingPros, NBC Sports, OddsShark, Covers, Bleacher Nation |
| Janela de KO | tarde/noite Lisboa | **Madrugada Lisboa** (jogos EUA 00h-04h) |
| Bookmaker ref | Bet365 | Bet365 / FanDuel (DK também) — confirmar Betclic PT antes apostar |

---

## Passo 1 — Schedule do dia

ESPN scoreboard endpoint (sem auth):
```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD"
```
- `dates` é o dia EUA (ET). Para um jogo "amanhã 01:00 Lisboa" usar dia ET = hoje.
- Filtrar por playoff status: durante Finals / Conf Finals, geralmente 1-2 jogos/noite.
- Para regular season, podem ser 8-12 jogos — seleccionar **máximo 2-3 focais** (jogos com mais narrativa, maior audiência, equipas top).

## Passo 2 — Janela de tempo Lisboa

Maioria dos jogos NBA: ~20-22:00 ET = 01-03 Lisboa do dia seguinte.
- **A tip é arquivada na data Lisboa do KO**, não da pesquisa.
- Ex: jogo Cavs@Knicks 21/05 20:00 ET → KO 22/05 01:00 Lisboa → ficheiro `tips/2026-05-22.json`.

## Passo 3 — Pesquisa qualitativa (WebSearch)

Por jogo focal, recolher:

### Fontes de previsão / tipsters
- **Action Network**, **BettingPros**, **Covers**, **OddsShark**
- **NBC Sports betting**, **CBS Sports NBA picks**, **Bleacher Report**
- **The Athletic NBA**, **ESPN NBA picks**, **Yahoo Sports**
- **Lineups.com** (DFS/odds), **Fadeaway World**

### Queries-tipo
- `"Team A" vs "Team B" prediction over under [date]`
- `"Team A" "Team B" injury report Game N [date]`
- `"Team A" pace ORtg DRtg recent`
- `"Team A" coach quote rotation rest`
- `NBA totals trend playoffs Conference Finals`

### O que extrair
- **Total line atual** (Bet365 / FanDuel reference) — começa por aqui
- **Movimento da linha** (abriu em 218.5, está em 214.5 → -4 = sharp money no Under)
- **Injury report oficial** — quem está OUT/DOUBT/Q
- **Pace dos dois times** (possessions per 48 min). NBA league avg ~99-101.
- **Ofensive Rating** e **Defensive Rating** (pontos por 100 possessions)
- **Style match-up**: dois times "run-and-gun" → Over; uma defesa elite → Under
- **Context**: back-to-back? rest day advantage? playoff seeding? rivalry?
- **Crowd factor**: home court na playoffs = +3 to +5 pts edge

## Passo 4 — Decisão de mercado

Mercados ordenados por preferência (MVP):

1. **Total Over/Under** (mercado principal)
   - Procurar edge ≥5pp vs linha implícita
   - Playoff tendency = -2pts under em média
   - Game 1 → Game 2: defenses tightenem na segunda mão

2. **Spread** (handicap)
   - Banker quando home court + form gap massivo

3. **Moneyline** (1X NBA não tem empate)
   - Underdog moneyline quando narrativa forte (revenge game, rest advantage)

4. **Player props** (PRA — points/rebounds/assists)
   - Mais difícil, apenas quando contexto excepcional (e.g. star ausente do outro lado)

## Passo 5 — Sistema de stakes (igual ao futebol — Sistema B)

| Banda | Score | Stake |
|---|---|---|
| Alta | ≥85 | 10€ |
| Média-alta | 75-84 | 7€ |
| Média | 65-74 | 5€ |
| Baixa | <65 | skip |

## Passo 6 — Schema JSON

Mesma estrutura do futebol, com 2 diferenças:
- `sport: "nba"` (obrigatório para routing no renderer)
- `market`: usar `nba_total`, `nba_spread`, `nba_moneyline`, `nba_prop`

Exemplo:
```json
{
  "market": "nba_total",
  "sport": "nba",
  "pick": "Under 214.5 Pontos",
  "fixtureId": 401873342,
  "home": { "name": "New York Knicks", "logo": "https://a.espncdn.com/i/teamlogos/nba/500/nyk.png" },
  "away": { "name": "Cleveland Cavaliers", "logo": "https://a.espncdn.com/i/teamlogos/nba/500/cle.png" },
  "league": "NBA · Eastern Conference Finals — Game 2",
  "kickoff": "2026-05-22T01:00:00+01:00",
  "odds": 1.90,
  "bookmaker": "Bet365",
  "score": 75,
  "stake": 7,
  "tese": "...",
  "factors": [...],
  "sources": [...]
}
```

## Passo 7 — Merge com tips de futebol do mesmo dia

**Se `tips/YYYY-MM-DD.json` já existir** (ex: futebol foi gerado primeiro):
1. Ler ficheiro existente
2. Adicionar a nova tip NBA ao array `tips[]`
3. Escrever ficheiro completo de novo

**Nunca substituir cegamente.** Misturar futebol + NBA num só ficheiro mantém a página de hoje coesa.

## Passo 8 — Tracking de resultados

No dia seguinte (quando user diz "atualizar resultados"):
1. ESPN scoreboard para apurar score final
2. Calcular GREEN/RED conforme o mercado:
   - Total: `home_score + away_score > line` ? GREEN if Over picked
   - Spread: aplicar handicap ao home, comparar
   - Moneyline: simples win/loss
3. Adicionar entrada `sport: "nba"` ao JSON de `resultados/data/YYYY-MM-DD.json` em `curated_tips.tips[]`

---

## Limitações actuais

- **API-Sports basketball:** plano Free só dá 2022-2024. Não usar para temporada actual.
- **ESPN público:** sem player stats granulares — só agregados. Para player props, depender de WebSearch.
- **Odds:** Bet365 / FanDuel reference via WebSearch. Confirmar Betclic PT antes apostar.
- **Sem star list scanner para NBA** (worker scanner é só futebol). Avaliar adicionar quando tivermos volume regular.
