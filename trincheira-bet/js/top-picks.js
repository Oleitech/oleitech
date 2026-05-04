const TopPicks = {
  MAX_ANALYZE: 35,
  analyzed: [],
  isAnalyzing: false,

  // Get fixtures from BTTS-friendly leagues, sorted by league BTTS rate
  getBTTSFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        if (LEAGUE_PREGAME_BLACKLIST.has(f.league.id)) return false;
        // Accept all known leagues (priority 1-3) for BTTS scanning
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        // Sort by league BTTS rate (highest first)
        const rateA = LEAGUES[a.league.id]?.bttsRate || 0;
        const rateB = LEAGUES[b.league.id]?.bttsRate || 0;
        return rateB - rateA;
      });
  },

  show(fixtures) {
    const grid = document.getElementById('top-picks-grid');
    if (!grid) return;

    const bttsFixtures = this.getBTTSFixtures(fixtures);
    if (bttsFixtures.length === 0) return;

    grid.innerHTML = '';
    this.analyzed = [];

    // Analyze from cache first, then fetch missing
    const toFetch = Math.min(bttsFixtures.length, this.MAX_ANALYZE);
    this.showCachedResults(bttsFixtures.slice(0, toFetch));

    // Auto-analyze if no cached results
    if (this.analyzed.length === 0) {
      this.analyze(bttsFixtures);
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const bttsAnalysis = Analysis.analyzeBTTS(cached[0]);
        if (bttsAnalysis && bttsAnalysis.score >= THRESHOLDS.BTTS_MEDIUM) {
          results.push({
            fixture: f,
            prediction: cached[0],
            btts: bttsAnalysis,
            bttsOdds: null // Will be populated if odds are cached
          });
        }
      }
    });

    // Check cached odds
    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.bttsOdds = this.extractBTTSOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.btts.score - a.btts.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('top-picks-grid');
    if (grid) grid.innerHTML = '';

    const bttsFixtures = this.getBTTSFixtures(fixtures);
    const toAnalyze = bttsFixtures.slice(0, this.MAX_ANALYZE);

    // Update progress via App if available
    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }

      updateProgress(`BTTS ${done + 1}/${toAnalyze.length}`);

      const data = await API.getPrediction(f.fixture.id);
      done++;

      if (data && data.length > 0) {
        const bttsAnalysis = Analysis.analyzeBTTS(data[0]);
        if (bttsAnalysis && bttsAnalysis.score >= THRESHOLDS.BTTS_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], btts: bttsAnalysis, bttsOdds: null });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    const topCandidates = results.sort((a, b) => b.btts.score - a.btts.score).slice(0, 10);
    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`BTTS odds ${oddsCount + 1}/${topCandidates.length}`);
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;
      if (oddsData) r.bttsOdds = this.extractBTTSOdds(oddsData);
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => {
      const aHasOdds = a.bttsOdds && a.bttsOdds.yes >= THRESHOLDS.BTTS_MIN_ODDS;
      const bHasOdds = b.bttsOdds && b.bttsOdds.yes >= THRESHOLDS.BTTS_MIN_ODDS;
      if (aHasOdds && !bHasOdds) return -1;
      if (!aHasOdds && bHasOdds) return 1;
      return b.btts.score - a.btts.score;
    });

    this.analyzed = results;
    if (results.length > 0) this.renderResults(results);
    this.isAnalyzing = false;
  },

  extractBTTSOdds(oddsData) {
    // API-Football odds structure: response[].bookmakers[].bets[]
    // BTTS bet has id 8 or name "Both Teams Score"
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const bttsBet = bk.bets?.find(b =>
          b.id === 8 || b.name === 'Both Teams Score' || b.name === 'Both Teams to Score'
        );
        if (bttsBet && bttsBet.values) {
          const yesOdd = bttsBet.values.find(v => v.value === 'Yes');
          const noOdd = bttsBet.values.find(v => v.value === 'No');
          return {
            yes: parseFloat(yesOdd?.odd || 0),
            no: parseFloat(noOdd?.odd || 0),
            bookmaker: bk.name || 'Unknown'
          };
        }
      }
    }
    return null;
  },

  renderResults(results) {
    const grid = document.getElementById('top-picks-grid');
    grid.innerHTML = '';

    // Filter out odds below minimum if odds are available
    const filtered = results.filter(r => {
      if (r.bttsOdds && r.bttsOdds.yes > 0 && r.bttsOdds.yes < THRESHOLDS.BTTS_MIN_ODDS) {
        return false; // Skip low odds (juice bets)
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="top-picks__empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.BTTS_MIN_ODDS})
        </div>`;
      return;
    }

    // Show top 15
    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderBTTSCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderBTTSCard(result, rank) {
    const { fixture, prediction, btts, bttsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;
    const odds = bttsOdds?.yes || null;

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'btts', pick: 'Sim',
      odds, score: btts.score,
      factors: btts.factors,
      learningFactors: btts.learningFactors
    });
  },

  init() {
    document.getElementById('btn-analyze')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
