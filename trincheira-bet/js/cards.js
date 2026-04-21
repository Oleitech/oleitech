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
    const grid = document.getElementById('cards-grid');
    if (!grid) return;

    const cardsFixtures = this.getCardsFixtures(fixtures);
    if (cardsFixtures.length === 0) return;

    grid.innerHTML = '';
    this.analyzed = [];

    const toFetch = Math.min(cardsFixtures.length, this.MAX_ANALYZE);
    this.showCachedResults(cardsFixtures.slice(0, toFetch));

    if (this.analyzed.length === 0) {
      this.analyze(cardsFixtures);
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
    if (grid) grid.innerHTML = '';

    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    const cardsFixtures = this.getCardsFixtures(fixtures);
    const toAnalyze = cardsFixtures.slice(0, this.MAX_ANALYZE);

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }
      updateProgress(`Cartões ${done + 1}/${toAnalyze.length}`);
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

    const topCandidates = results.sort((a, b) => b.cards.score - a.cards.score).slice(0, 8);
    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`Cartões odds ${oddsCount + 1}/${topCandidates.length}`);
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;
      if (oddsData) r.cardsOdds = this.extractCardsOdds(oddsData);
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.cards.score - a.cards.score);
    this.analyzed = results;
    if (results.length > 0) this.renderResults(results);
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
    const odds = cardsOdds?.over || null;
    const suggestedLine = cards.estimatedCards >= 5 ? 'Over 4.5' :
                          cards.estimatedCards >= 4.2 ? 'Over 3.5' :
                          cards.estimatedCards >= 3.5 ? 'Over 2.5' : 'Over 1.5';
    const stake = Bankroll.getCardsStake(cards.score);

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'cards', pick: suggestedLine,
      odds, score: cards.score,
      factors: cards.factors,
      learningFactors: cards.learningFactors,
      stake
    });
  },

  init() {
    document.getElementById('btn-cards')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
