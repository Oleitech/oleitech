# Trincheira Bet - Workflow Diario de Resultados

## Como atualizar resultados

Todos os dias, depois dos jogos terminarem, faz o seguinte:

### 1. Preparar as fotos
Tira screenshots das tips que a app gerou (BTTS Scanner e Corners Scanner) **antes** dos jogos comecarem. Depois dos jogos, tira screenshots dos resultados.

### 2. Organizar na pasta
```
resultados/dia-DD-MM-YYYY/
  tips/        <- screenshots das tips geradas pela app
  resultados/  <- screenshots dos resultados finais
```

### 3. Pedir ao Claude para atualizar
Basta dizer algo como:
> "Vamos atualizar os resultados do dia de hoje" ou "Atualiza os resultados"

E partilhar as fotos (tips + resultados). Se os cantos nao tiverem screenshots dos resultados, diz manualmente quantos cantos teve cada jogo.

### O que o Claude vai fazer automaticamente:
1. Ler as imagens das tips (extrair jogos, confianca, mercado)
2. Ler as imagens dos resultados (extrair scores finais)
3. Cruzar tips com resultados e marcar GREEN/RED
4. Guardar o JSON em `resultados/data/YYYY-MM-DD.json`
5. Atualizar o historico na app (secao de resultados)
6. O **Learning Engine** (`js/learning.js`) usa estes dados automaticamente para ajustar as tips futuras

---

## Estrutura dos dados

Cada dia gera um ficheiro JSON em `resultados/data/`:

```json
{
  "date": "2026-04-12",
  "btts": {
    "tips": [
      {
        "home": "PEC Zwolle",
        "away": "Excelsior",
        "league": "Eredivisie",
        "country": "NL",
        "kickoff": "13:30",
        "confidence": 71,
        "btts_sim": 1.53,
        "result_home": 2,
        "result_away": 2,
        "btts_hit": true
      }
    ],
    "summary": {
      "total": 8,
      "green": 7,
      "red": 1,
      "hit_rate": 87.5
    }
  },
  "corners": {
    "tips": [
      {
        "home": "Team A",
        "away": "Team B",
        "league": "Liga",
        "market": "+10.5 cantos",
        "total_corners": 11,
        "hit": true
      }
    ],
    "summary": {
      "total": 3,
      "green": 2,
      "red": 1,
      "hit_rate": 66.7
    }
  }
}
```

## Melhorias ao modelo baseadas nos resultados

### Dia 12/04/2026 - Aprendizagens

**BTTS (7/8 = 87.5%)**
- Tips com confianca >= 70 foram todas GREEN (5/5 = 100%)
- A unica RED foi Genk vs OH Leuven (confianca 64) - 0-0
- Jogos da Super League CH tiveram excelente performance (2/2)
- Pro League BE: 2/3 (o miss foi o jogo com menor confianca)

**Cantos (2/3 = 66.7%)**
- +10.5 cantos: 2 jogos passaram (11 e 12 cantos), 1 falhou (5 cantos)
- O jogo que falhou ficou muito longe do target (5 vs 10.5) - possivel indicador de que o modelo precisa de melhor filtragem

**Padroes a observar:**
- Confianca >= 70 parece ser um bom threshold para BTTS
- Confianca < 65 tem risco elevado
- Cantos precisa de mais dados para avaliar tendencias

### Dia 13/04/2026 - Aprendizagens

**BTTS (1/2 = 50%)**
- Fredericia vs Vejle (conf. 80) — GREEN, 2-2. Confianca alta = resultado positivo
- Lanus vs Banfield (conf. 57) — RED, 1-0. Confianca baixa (<60) volta a falhar
- Dia com poucas tips disponíveis (apenas 2 jogos)

**Cantos (1/1 = 100%)**
- Brommapojkarna vs AIK Stockholm: Over 10.5 — GREEN (12 cantos)
- Conf. 55 mas acertou — cantos parece menos dependente da confianca

**Padroes acumulados (2 dias):**
- BTTS com conf. >= 70: 6/6 = 100% (perfeito)
- BTTS com conf. < 65: 1/3 = 33% (alto risco)
- BTTS conf. 65-69: 2/2 = 100% (amostra pequena)
- Cantos Over 10.5: 3/4 = 75%
- Threshold recomendado BTTS: >= 65 (possivelmente >= 70 para maior segurança)

---

## Notas sobre fotos HEIC
- O formato HEIC (iPhone) pode nao ser legivel. Idealmente converter para PNG/JPG antes de partilhar, ou descrever os dados manualmente.
- Nas definicoes do iPhone: Definicoes > Camera > Formatos > Mais Compativel (usa JPG em vez de HEIC)
