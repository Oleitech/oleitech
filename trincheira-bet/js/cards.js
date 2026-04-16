const Cards = {
  MAX_ANALYZE: 30,
  analyzed: [],
  isAnalyzing: false,

  getCardsFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        const cA = LEAGUES[a.league.id]?.avgCards || 0;
        const cB = LEAGUES[b.league.id]?.avgCards || 0;
        return cB - cA;
      });
  },

  show(fixtures) {
    const section = document.getElementById('cards-section');
    const grid = document.getElementById('cards-grid');
    const btn = document.getElementById('btn-cards');
    const costSpan = document.getElementById('cards-cost');

    const cardsFixtures = this.getCardsFixtures(fixtures);
    if (cardsFixtures.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const toFetch = Math.min(cardsFixtures.length, this.MAX_ANALYZE);
    let cached = 0;
    cardsFixtures.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    if (cached > 0) {
      this.showCachedResults(cardsFixtures.slice(0, toFetch));
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const analysis = Analysis.analyzeCards(cached[0], f);
        if (analysis && analysis.score >= THRESHOLDS.CARDS_MEDIUM) {
          results.push({ fixture: f, prediction: cached[0], cards: analysis, cardsOdds: null });
        }
      }
    });

    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.cardsOdds = this.extractCardsOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.cards.score - a.cards.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  extractCardsOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const cardsBet = bk.bets?.find(b =>
          b.name === 'Total Cards' ||
          b.name === 'Cards Over Under' ||
          b.name === 'Cards Over/Under' ||
          (b.name && b.name.toLowerCase().includes('card'))
        );
        if (cardsBet && cardsBet.values) {
          const overVal = cardsBet.values.find(v =>
            v.value === 'Over 3.5' || v.value === 'Over 4.5' || v.value === 'Over 2.5'
          );
          const underVal = cardsBet.values.find(v =>
            v.value === 'Under 3.5' || v.value === 'Under 4.5' || v.value === 'Under 2.5'
          );
          if (overVal) {
            const line = parseFloat(overVal.value.replace('Over ', ''));
            return {
              line,
              over: parseFloat(overVal.odd || 0),
              under: parseFloat(underVal?.odd || 0),
              bookmaker: bk.name || 'Unknown'
            };
          }
        }
      }
    }
    return null;
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('cards-grid');
    const loading = document.getElementById('cards-loading');
    const progressBar = document.getElementById('cards-progress-bar');
    const progressText = document.getElementById('cards-progress-text');
    const btn = document.getElementById('btn-cards');

    const cardsFixtures = this.getCardsFixtures(fixtures);
    const toAnalyze = cardsFixtures.slice(0, this.MAX_ANALYZE);

    btn.style.display = 'none';
    loading.style.display = 'flex';
    grid.innerHTML = '';

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }

      progressBar.style.width = `${(done / toAnalyze.length) * 100}%`;
      progressText.textContent = `A analisar ${done + 1}/${toAnalyze.length}...`;

      const data = await API.getPrediction(f.fixture.id);
      done++;

      if (data && data.length > 0) {
        const analysis = Analysis.analyzeCards(data[0], f);
        if (analysis && analysis.score >= THRESHOLDS.CARDS_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], cards: analysis, cardsOdds: null });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    // Fetch odds for top candidates
    const topCandidates = results
      .sort((a, b) => b.cards.score - a.cards.score)
      .slice(0, 8);

    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;

      progressText.textContent = `A buscar odds ${oddsCount + 1}/${topCandidates.length}...`;
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;

      if (oddsData) {
        r.cardsOdds = this.extractCardsOdds(oddsData);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.cards.score - a.cards.score);
    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="cards-empty">
          Sem jogos com padrão forte de cartões identificado hoje
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  renderResults(results) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    const filtered = results.filter(r => {
      if (r.cardsOdds && r.cardsOdds.over > 0 && r.cardsOdds.over < THRESHOLDS.CARDS_MIN_ODDS) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="cards-empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.CARDS_MIN_ODDS})
        </div>`;
      return;
    }

    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderCard(result, rank) {
    const { fixture, prediction, cards, cardsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    const homeForm = prediction.teams?.home?.league?.form?.slice(-5) || '';
    const awayForm = prediction.teams?.away?.league?.form?.slice(-5) || '';

    const card = UI.el('div', 'cards-card');
    card.dataset.fixtureId = fixture.fixture.id;

    const tier = cards.score >= THRESHOLDS.CARDS_FIRE ? 'fire' :
                 cards.score >= THRESHOLDS.CARDS_HIGH ? 'hot' : 'warm';

    const scoreColor = cards.score >= THRESHOLDS.CARDS_FIRE ? 'var(--red)' :
                       cards.score >= THRESHOLDS.CARDS_HIGH ? 'var(--amber)' : 'var(--purple)';

    const suggestedLine = cards.estimatedCards >= 5 ? 'Over 4.5' :
                          cards.estimatedCards >= 4.2 ? 'Over 3.5' :
                          cards.estimatedCards >= 3.5 ? 'Over 2.5' : 'Over 1.5';

    let oddsHtml = '';
    if (cardsOdds && cardsOdds.over > 0) {
      const oddsClass = cardsOdds.over >= 1.70 ? 'cards-odds--value' :
                        cardsOdds.over >= 1.50 ? 'cards-odds--fair' : 'cards-odds--low';
      oddsHtml = `
        <div class="cards-card__odds ${oddsClass}">
          <span class="cards-card__odds-label">Over ${cardsOdds.line} Cartões</span>
          <span class="cards-card__odds-value">${cardsOdds.over.toFixed(2)}</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="cards-card__header">
        <div class="cards-card__rank">#${rank}</div>
        <div class="cards-card__tier">
          ${tier === 'fire' ? '&#128293;' : tier === 'hot' ? '&#11088;' : '&#9898;'}
        </div>
        <div class="cards-card__score-ring" style="--score-color:${scoreColor}">
          <span class="cards-card__score-value">${cards.score}</span>
          <span class="cards-card__score-label">CRT</span>
        </div>
      </div>

      <div class="cards-card__league">${leagueName} &middot; ${time}</div>

      <div class="cards-card__matchup">
        <div class="cards-card__team">
          <img src="${home.logo}" alt="" class="cards-card__team-logo" onerror="this.style.display='none'">
          <span>${home.name}</span>
        </div>
        <span class="cards-card__vs">vs</span>
        <div class="cards-card__team">
          <img src="${away.logo}" alt="" class="cards-card__team-logo" onerror="this.style.display='none'">
          <span>${away.name}</span>
        </div>
      </div>

      ${oddsHtml}

      <div class="cards-card__estimate">
        <div class="cards-card__estimate-bar">
          <div class="cards-card__estimate-fill" style="width:${Math.min(100, (cards.estimatedCards / 8) * 100)}%"></div>
          <span class="cards-card__estimate-value">${cards.estimatedCards}</span>
        </div>
        <div class="cards-card__estimate-labels">
          <span>Cartões estimados</span>
          <span class="cards-card__suggestion">${suggestedLine}</span>
        </div>
      </div>

      <div class="cards-card__stats-grid">
        <div class="cards-card__stat">
          <span class="cards-card__stat-label">Liga média</span>
          <span class="cards-card__stat-value">${cards.leagueAvgCards}/jogo</span>
        </div>
        <div class="cards-card__stat">
          <span class="cards-card__stat-label">Ataque comb.</span>
          <span class="cards-card__stat-value">${cards.stats.combinedAttack} golos</span>
        </div>
        <div class="cards-card__stat">
          <span class="cards-card__stat-label">Def. fraca</span>
          <span class="cards-card__stat-value">${cards.stats.combinedConceded} sofr.</span>
        </div>
        <div class="cards-card__stat">
          <span class="cards-card__stat-label">Equilíbrio</span>
          <span class="cards-card__stat-value">${cards.stats.totalDiff < 15 ? '&#10003; Sim' : '&#10007; Não'}</span>
        </div>
      </div>

      <div class="cards-card__form">
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${home.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(homeForm)}</div>
        </div>
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${away.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(awayForm)}</div>
        </div>
      </div>

      ${cards.factors.length > 0 ? `
        <div class="cards-card__factors">
          ${cards.factors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="cards-card__factor ${isWarning ? 'cards-card__factor--warning' : ''}">
              ${isWarning ? '' : '&#10003; '}${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${(cards.learningFactors && cards.learningFactors.length > 0) ? `
        <div class="cards-card__learning">
          <div class="cards-card__learning-title">&#9889; Aprendizagem</div>
          ${cards.learningFactors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="cards-card__learning-item ${isWarning ? 'cards-card__learning-item--warning' : 'cards-card__learning-item--boost'}">
              ${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${Bankroll.renderBadge(Bankroll.getCardsStake(cards.score))}
    `;

    return card;
  },

  init() {
    document.getElementById('btn-cards')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
