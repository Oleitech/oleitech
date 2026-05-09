// Favoritos 1X2 com value — pre-game tip scanner.
// Filters fixtures where a clear pre-game favorite is priced in a value zone
// (odds 1.55-2.00). Below 1.55 the juice is too high; above 2.00 the market
// disagrees with the model and we lose conviction.

const Favorites1x2 = {
  MAX_ANALYZE: 35,
  MIN_ODDS: 1.55,
  MAX_ODDS: 2.00,
  MIN_SCORE: 70,
  STAKE_LABEL: '1 stake (€10)',
  analyzed: [],
  isAnalyzing: false,

  // Eligible leagues: priority 1-3 (skip exotic/unknown leagues)
  getEligibleFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        if (typeof LEAGUE_PREGAME_BLACKLIST !== 'undefined' && LEAGUE_PREGAME_BLACKLIST.has(f.league.id)) return false;
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      });
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('favorites-grid');
    if (grid) grid.innerHTML = '';

    const eligible = this.getEligibleFixtures(fixtures);
    const toAnalyze = eligible.slice(0, this.MAX_ANALYZE);

    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    // Step 1: pull odds first — odds tell us who the market thinks is favorite,
    // which is a much more reliable signal than predictions.percent (often
    // capped near 50% in API-Sports even for clear favorites).
    const candidates = [];
    let done = 0;
    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('Limite API perto — Favoritos parcial', 'info');
        break;
      }
      updateProgress(`Favoritos odds ${done + 1}/${toAnalyze.length}`);
      const oddsData = await API.getOdds(f.fixture.id);
      done++;
      const odds1x2 = this.extract1X2Odds(oddsData);
      if (odds1x2) {
        const fav = this.detectFavoriteFromOdds(odds1x2);
        if (fav) candidates.push({ fixture: f, odds: odds1x2, fav });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    // Step 2: predictions for top candidates to score conviction
    const results = [];
    let predCount = 0;
    for (const c of candidates) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`Favoritos pred ${predCount + 1}/${candidates.length}`);
      const predData = await API.getPrediction(c.fixture.fixture.id);
      predCount++;
      const prediction = predData?.[0] || null;
      const score = this.scoreFavorite(prediction, c.fav);
      if (score >= this.MIN_SCORE) {
        results.push({
          fixture: c.fixture,
          prediction,
          fav: c.fav,
          odds: c.odds,
          favOdd: c.fav.odd,
          score,
          factors: this.buildFactors(prediction, c.fav),
        });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.score - a.score);
    this.analyzed = results;
    this.renderResults(results);
    this.isAnalyzing = false;
  },

  // Identify favorite from 1X2 odds: the lowest odd in the value range, with
  // a meaningful gap over the next-lowest odd to confirm a clear favorite.
  detectFavoriteFromOdds(odds1x2) {
    const homeOdd = odds1x2.home;
    const awayOdd = odds1x2.away;
    if (!homeOdd || !awayOdd) return null;

    const homeIsLower = homeOdd < awayOdd;
    const favOdd = homeIsLower ? homeOdd : awayOdd;
    const dogOdd = homeIsLower ? awayOdd : homeOdd;

    if (favOdd < this.MIN_ODDS || favOdd > this.MAX_ODDS) return null;
    // Require a clear gap: dog odd must be >= fav + 0.50 (else the game is too tight)
    if (dogOdd < favOdd + 0.50) return null;

    return { isHome: homeIsLower, odd: favOdd, dogOdd, draw: odds1x2.draw };
  },

  extract1X2Odds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;
    for (const oddsEntry of oddsData) {
      const bookmakers = oddsEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const bet = bk.bets?.find(b =>
          b.id === 1 || b.name === 'Match Winner' || b.name === '1X2'
        );
        if (bet && bet.values) {
          const home = bet.values.find(v => v.value === 'Home' || v.value === '1');
          const draw = bet.values.find(v => v.value === 'Draw' || v.value === 'X');
          const away = bet.values.find(v => v.value === 'Away' || v.value === '2');
          if (home && away) {
            return {
              home: parseFloat(home.odd),
              draw: parseFloat(draw?.odd || 0),
              away: parseFloat(away.odd),
              bookmaker: bk.name || 'Unknown',
            };
          }
        }
      }
    }
    return null;
  },

  // Score 0-100. Confidence in the favorite winning. fav comes from odds; we
  // use predictions to add conviction (form, goal averages, agreement with
  // predictions.winner) but not as the primary gate.
  scoreFavorite(prediction, fav) {
    let score = 55;

    // Odd-implied probability anchor: a 1.55 odd means ~64% implied. A clear
    // favorite at this price is already meaningful.
    const implied = 1 / fav.odd;
    if (implied >= 0.62) score += 8;     // ≤1.61
    else if (implied >= 0.55) score += 5; // 1.62-1.81
    else score += 2;                      // 1.82-2.00

    // Gap over the underdog: bigger gap = less competitive game
    const gap = fav.dogOdd - fav.odd;
    if (gap >= 1.50) score += 10;
    else if (gap >= 1.00) score += 6;
    else if (gap >= 0.70) score += 3;

    // Home favorite small boost (home advantage)
    if (fav.isHome) score += 5;

    if (prediction) {
      const homePct = parseInt(prediction.predictions?.percent?.home) || 0;
      const awayPct = parseInt(prediction.predictions?.percent?.away) || 0;
      const favPct = fav.isHome ? homePct : awayPct;
      const dogPct = fav.isHome ? awayPct : homePct;

      // Predictions agreeing with odds = bonus; disagreeing = penalty
      if (favPct >= dogPct + 20) score += 12;
      else if (favPct >= dogPct + 10) score += 8;
      else if (favPct >= dogPct) score += 3;
      else if (dogPct > favPct + 10) score -= 10; // model disagrees → red flag

      // Winner.id agreement
      const winnerId = prediction.predictions?.winner?.id;
      const favTeamId = fav.isHome
        ? prediction.teams?.home?.id
        : prediction.teams?.away?.id;
      if (winnerId && favTeamId && winnerId === favTeamId) score += 5;

      // Form comparison
      const cmp = prediction.comparison || {};
      const formCmp = parseInt(fav.isHome ? cmp.form?.home : cmp.form?.away) || 0;
      if (formCmp >= 60) score += 5;
      else if (formCmp <= 40) score -= 3;

      // Goal-scoring profile (favorite expected to score, opponent leaks)
      const homeAvgFor = parseFloat(prediction.teams?.home?.league?.goals?.for?.average?.total || 0);
      const awayAvgFor = parseFloat(prediction.teams?.away?.league?.goals?.for?.average?.total || 0);
      const homeAvgAg = parseFloat(prediction.teams?.home?.league?.goals?.against?.average?.total || 0);
      const awayAvgAg = parseFloat(prediction.teams?.away?.league?.goals?.against?.average?.total || 0);
      const favFor = fav.isHome ? homeAvgFor : awayAvgFor;
      const oppAg = fav.isHome ? awayAvgAg : homeAvgAg;
      if (favFor >= 1.8 && oppAg >= 1.3) score += 6;
      else if (favFor >= 1.5 && oppAg >= 1.2) score += 3;
    }

    return Math.max(0, Math.min(95, score));
  },

  buildFactors(prediction, fav) {
    const factors = [];
    const implied = (1 / fav.odd * 100).toFixed(1);
    factors.push(`Odd ${fav.odd.toFixed(2)} (implícito ${implied}%)`);
    factors.push(`Adversário ${fav.dogOdd.toFixed(2)} (gap ${(fav.dogOdd - fav.odd).toFixed(2)})`);
    if (fav.isHome) factors.push('Vantagem casa');

    if (prediction) {
      const homePct = parseInt(prediction.predictions?.percent?.home) || 0;
      const awayPct = parseInt(prediction.predictions?.percent?.away) || 0;
      const favPct = fav.isHome ? homePct : awayPct;
      const dogPct = fav.isHome ? awayPct : homePct;
      if (favPct > 0) factors.push(`Modelo ${favPct}% vs ${dogPct}%`);

      const cmp = prediction.comparison || {};
      const formCmp = parseInt(fav.isHome ? cmp.form?.home : cmp.form?.away) || 0;
      if (formCmp >= 60) factors.push(`Forma comparada ${formCmp}%`);

      const oppAg = fav.isHome
        ? parseFloat(prediction.teams?.away?.league?.goals?.against?.average?.total || 0)
        : parseFloat(prediction.teams?.home?.league?.goals?.against?.average?.total || 0);
      if (oppAg >= 1.4) factors.push(`Oponente concede ${oppAg.toFixed(2)}/jogo`);
    }

    return factors;
  },

  renderResults(results) {
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (results.length === 0) {
      grid.innerHTML = `<div class="top-picks__empty">Sem favoritos no range ${this.MIN_ODDS}–${this.MAX_ODDS}</div>`;
      this.updateBadge(0);
      return;
    }

    results.slice(0, 12).forEach(r => grid.appendChild(this.renderCard(r)));
    this.updateBadge(Math.min(results.length, 12));
  },

  renderCard(result) {
    const { fixture, fav, favOdd, score, factors } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;
    const favName = fav.isHome ? home.name : away.name;

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'favorites',
      marketLabel: 'Favorito 1X2',
      pick: `${favName} ganha`,
      odds: favOdd, score, factors,
      stake: this.STAKE_LABEL,
    });
  },

  updateBadge(n) {
    const badge = document.getElementById('badge-favorites');
    if (badge) badge.textContent = n;
    const section = document.getElementById('section-favorites');
    if (section) section.style.display = n > 0 ? '' : 'none';
  },

  init() {
    // Init hook (no internal buttons; runScan in app.js drives this)
  }
};
