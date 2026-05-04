const Over25Scanner = {
  MAX_ANALYZE: 35,
  analyzed: [],
  isAnalyzing: false,

  getFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        if (LEAGUE_PREGAME_BLACKLIST.has(f.league.id)) return false;
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        const rateA = LEAGUES[a.league.id]?.bttsRate || 0;
        const rateB = LEAGUES[b.league.id]?.bttsRate || 0;
        return rateB - rateA;
      });
  },

  show(fixtures) {
    const grid = document.getElementById('over25-grid');
    if (!grid) return;

    const over25Fixtures = this.getFixtures(fixtures);
    if (over25Fixtures.length === 0) return;

    grid.innerHTML = '';
    this.analyzed = [];

    const toFetch = Math.min(over25Fixtures.length, this.MAX_ANALYZE);
    this.showCachedResults(over25Fixtures.slice(0, toFetch));

    if (this.analyzed.length === 0) {
      this.analyze(over25Fixtures);
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const analysis = Analysis.analyzeOver25Deep(cached[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER25_DEEP_MEDIUM) {
          results.push({ fixture: f, prediction: cached[0], over25: analysis, goalsOdds: null });
        }
      }
    });

    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.goalsOdds = this.extractGoalsOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.over25.score - a.over25.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  extractGoalsOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const goalsBet = bk.bets?.find(b =>
          b.id === 5 || b.name === 'Goals Over/Under' || b.name === 'Over/Under'
        );
        if (goalsBet && goalsBet.values) {
          const overVal = goalsBet.values.find(v => v.value === 'Over 2.5');
          const underVal = goalsBet.values.find(v => v.value === 'Under 2.5');
          if (overVal) {
            return {
              line: 2.5,
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

    const grid = document.getElementById('over25-grid');
    if (grid) grid.innerHTML = '';

    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    const over25Fixtures = this.getFixtures(fixtures);
    const toAnalyze = over25Fixtures.slice(0, this.MAX_ANALYZE);

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }
      updateProgress(`Over 2.5 ${done + 1}/${toAnalyze.length}`);
      const data = await API.getPrediction(f.fixture.id);
      done++;
      if (data && data.length > 0) {
        const analysis = Analysis.analyzeOver25Deep(data[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER25_DEEP_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], over25: analysis, goalsOdds: null });
        }
      }
      await new Promise(r => setTimeout(r, 120));
    }

    const topCandidates = results.sort((a, b) => b.over25.score - a.over25.score).slice(0, 10);
    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`Over 2.5 odds ${oddsCount + 1}/${topCandidates.length}`);
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;
      if (oddsData) r.goalsOdds = this.extractGoalsOdds(oddsData);
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => {
      const aHasOdds = a.goalsOdds && a.goalsOdds.over >= THRESHOLDS.OVER25_DEEP_MIN_ODDS;
      const bHasOdds = b.goalsOdds && b.goalsOdds.over >= THRESHOLDS.OVER25_DEEP_MIN_ODDS;
      if (aHasOdds && !bHasOdds) return -1;
      if (!aHasOdds && bHasOdds) return 1;
      return b.over25.score - a.over25.score;
    });

    this.analyzed = results;
    if (results.length > 0) this.renderResults(results);
    this.isAnalyzing = false;
  },

  renderResults(results) {
    const grid = document.getElementById('over25-grid');
    grid.innerHTML = '';

    const filtered = results.filter(r => {
      if (r.goalsOdds && r.goalsOdds.over > 0 && r.goalsOdds.over < THRESHOLDS.OVER25_DEEP_MIN_ODDS) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="over25s-empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.OVER25_DEEP_MIN_ODDS})
        </div>`;
      return;
    }

    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderCard(result, rank) {
    const { fixture, prediction, over25, goalsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;
    const odds = goalsOdds?.over || null;
    const stake = Bankroll.getOver25Stake(over25.score);

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'over25', pick: 'Over 2.5',
      odds, score: over25.score,
      factors: over25.factors,
      learningFactors: over25.learningFactors,
      stake
    });
  },

  init() {
    document.getElementById('btn-over25')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
