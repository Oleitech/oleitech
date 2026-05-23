# Curated Tips — `tips/`

Cada dia tem o seu ficheiro: `YYYY-MM-DD.json`. A página `index.html` carrega
automaticamente o ficheiro correspondente ao dia atual e renderiza as tips.

Sem ficheiro para o dia → estado "Sem tips publicadas para hoje".

## Fluxo

1. Utilizador no chat: _"dá-me as tips de hoje"_
2. Claude faz pesquisa (API-Football + notícias + onzes prováveis + lesões)
3. Propõe rascunho de 1–3 tips
4. Validação humana
5. Grava `tips/YYYY-MM-DD.json` (este formato)

## Schema

```json
{
  "date": "2026-05-16",
  "generated_at": "2026-05-16T11:30:00+01:00",
  "notes": "Opcional — contexto geral do dia",
  "accumulators": [
    {
      "selections": [
        { "fixtureId": 1234567, "match": "Liverpool vs Arsenal", "pick": "BTTS Sim", "odds": 1.72, "sport": "football" },
        { "fixtureId": 7654321, "match": "Real Madrid vs Sevilla", "pick": "Vitória Real Madrid", "odds": 1.45, "sport": "football" }
      ],
      "combined_odds": 2.49,
      "score": 76,
      "stake": 7
    },
    {
      "selections": [
        { "fixtureId": 1234567, "match": "Liverpool vs Arsenal", "pick": "BTTS Sim", "odds": 1.72, "sport": "football" },
        { "fixtureId": 9999999, "match": "Boston Celtics vs Cleveland", "pick": "Over 218.5 pts", "odds": 1.85, "sport": "nba" }
      ],
      "combined_odds": 2.62,
      "score": 74,
      "stake": 5
    }
  ],
  "tips": [
    {
      "market": "btts",
      "pick": "Sim",
      "fixtureId": 1234567,
      "home": { "name": "Liverpool", "logo": "https://media.api-sports.io/football/teams/40.png" },
      "away": { "name": "Arsenal",   "logo": "https://media.api-sports.io/football/teams/42.png" },
      "league": "Premier League",
      "leagueLogo": "https://media.api-sports.io/football/leagues/39.png",
      "kickoff": "2026-05-16T17:30:00Z",
      "odds": 1.72,
      "bookmaker": "Betclic",
      "score": 78,
      "stake": 10,
      "tese": "Texto da análise (3–6 frases): onze provável, lesões, contexto, motivação, factor decisivo.",
      "factors": [
        "H2H: 6/6 últimos com ambas a marcar",
        "Liverpool 9/10 em casa com BTTS",
        "Arsenal sem clean sheet fora há 12 jogos"
      ],
      "sources": [
        "Sky Sports — onze 11h00",
        "API-Football stats / H2H",
        "Sofascore"
      ]
    }
  ]
}
```

## Campos

| Campo          | Tipo            | Obrigatório | Notas |
|----------------|-----------------|-------------|-------|
| `date`         | string          | sim         | `YYYY-MM-DD` |
| `accumulators` | array           | não         | Lista de acumuladores do dia (0+); array vazio se não foi possível construir nenhum. Standard: até 2. Curtos: ⌊N pernas shortlist / 3⌋ |
| `accumulators[].label` | `"standard"` \| `"curto"` | não | `"standard"` = tips aprovadas pelo processo completo; `"curto"` = 3 pernas de odds baixas (1.15–1.45) de pool alargado (ligas secundárias permitidas). Omitir = standard. |
| `accumulators[].selections` | array | sim       | 2–3 seleções (standard) ou exactamente 3 seleções (curto) |
| `accumulators[].selections[].fixtureId` | number | não | API-Football fixture ID (ou outro ID de desporto) |
| `accumulators[].selections[].match` | string | sim | "Home vs Away" ou nome do jogo |
| `accumulators[].selections[].pick` | string | sim | Descrição da aposta |
| `accumulators[].selections[].odds` | number | sim | Odd individual (Betclic PT) |
| `accumulators[].selections[].sport` | string | não | `"football"`, `"nba"`, `"tennis"` |
| `accumulators[].combined_odds` | number | sim       | Produto das odds — deve estar entre 2.0 e 3.0 |
| `accumulators[].score` | number | sim            | Score mínimo das seleções incluídas |
| `accumulators[].stake` | number | sim            | € calculado pelas bandas do Sistema B sobre o score mínimo |
| `generated_at` | string ISO 8601 | sim         | timestamp da curadoria |
| `notes`        | string          | não         | nota geral do dia (ex.: "Jornada europeia") |
| `tips[].market`| `btts` \| `favorites` \| `scorers` \| `corners` | sim | mercado |
| `tips[].pick`  | string          | sim         | texto da aposta (ex.: "Sim", "Vitória Liverpool", "Over 9.5 cantos") |
| `tips[].fixtureId` | number      | recomendado | API-Football fixture ID (permite ao live-engine cruzar) |
| `tips[].home/away` | `{name, logo}` | sim     | nome e logo das equipas |
| `tips[].league/leagueLogo` | string | sim    | competição |
| `tips[].kickoff` | string ISO 8601 | sim       | hora de início UTC |
| `tips[].odds`  | number          | sim         | odd da casa (Betclic PT) |
| `tips[].bookmaker` | string      | não         | default: Betclic |
| `tips[].score` | number 0–100    | sim         | confiança da curadoria |
| `tips[].stake` | number          | não         | € (informativo no card) |
| `tips[].tese`  | string          | sim         | parágrafo de análise; aparece em destaque no card |
| `tips[].factors` | string[]      | não         | bullet points objetivos (estatísticas, H2H) |
| `tips[].sources` | string[]      | não         | nome das fontes usadas (mostradas no card) |

## Mercados suportados

- **btts** — Ambas Marcam (Sim/Não)
- **favorites** — Favorito 1X2 (odds-alvo 1.55–2.00)
- **scorers** — Anytime Scorer (jogador X marca)
- **corners** — Over/under de cantos pré-jogo

## Ligas-foco

Top-5 Europa (Premier League, La Liga, Serie A, Bundesliga, Ligue 1), Liga Portugal,
competições UEFA (Champions, Europa, Conference). Outras ligas só se a investigação
indicar evento muito certo.

## Volume

1–3 tips por dia, muito seletivo. Dias sem tips são esperados quando nada cumpre
os critérios.
