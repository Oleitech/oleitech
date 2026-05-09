// Favoritos 1X2 com value — pre-game tip scanner.
// Filters fixtures where a clear pre-game favorite is priced in a value zone
// (odds 1.55-2.00). Below 1.55 the juice is too high; above 2.00 the market
// disagrees with the model and we lose conviction.

const Favorites1x2 = {
  MAX_ANALYZE: 35,
  MIN_FAV_PCT: 60,        // pre-game predictions percent for the favorite
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

    const candidates = [];
    let done = 0;

    // Step 1: predictions to find favorites
    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('Limite API perto — Favoritos parcial', 'info');
        break;
      }
      updateProgress(`Favoritos ${done + 1}/${toAnalyze.length}`);
      const data = await API.getPrediction(f.fixture.id);
      done++;
      if (data && data.length > 0) {
        const fav = this.detectFavorite(data[0]);
        if (fav) candidates.push({ fixture: f, prediction: data[0], fav });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    // Step 2: odds for top candidates (sorted by favorite percent)
    candidates.sort((a, b) => b.fav.pct - a.fav.pct);
    const top = candidates.slice(0, 20);
    let oddsCount = 0;
    const results = [];
    for (const c of top) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`Odds favoritos ${oddsCount + 1}/${top.length}`);
      const oddsData = await API.getOdds(c.fixture.fixture.id);
      oddsCount++;
      const odds1x2 = this.extract1X2Odds(oddsData);
      if (odds1x2) {
        const favOdd = c.fav.isHome ? odds1x2.home : odds1x2.away;
        if (favOdd >= this.MIN_ODDS && favOdd <= this.MAX_ODDS) {
          const score = this.scoreFavorite(c.prediction, c.fav, favOdd);
          if (score >= this.MIN_SCORE) {
            results.push({
              fixture: c.fixture,
              prediction: c.prediction,
              fav: c.fav,
              odds: odds1x2,
              favOdd,
              score,
              factors: this.buildFactors(c.prediction, c.fav, favOdd),
            });
          }
        }
      }
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.score - a.score);
    this.analyzed = results;
    this.renderResults(results);
    this.isAnalyzing = false;
  },

  detectFavorite(prediction) {
    const homePct = parseInt(prediction.predictions?.percent?.home) || 0;
    const awayPct = parseInt(prediction.predictions?.percent?.away) || 0;
    const winnerId = prediction.predictions?.winner?.id;

    let isHome = null;
    if (homePct >= this.MIN_FAV_PCT && homePct >= awayPct + 10) isHome = true;
    else if (awayPct >= this.MIN_FAV_PCT && awayPct >= homePct + 10) isHome = false;
    if (isHome === null) return null;

    const pct = isHome ? homePct : awayPct;
    return { isHome, pct, winnerId };
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

  // Score 0-100. Confidence in the favorite winning.
  scoreFavorite(prediction, fav, favOdd) {
    let score = 50;
    // Pre-game probability is the strongest signal
    if (fav.pct >= 75) score += 20;
    else if (fav.pct >= 70) score += 14;
    else if (fav.pct >= 65) score += 8;
    else score += 3;

    // Odds value: sweet spot ~1.65-1.85 (between 60-66% implied probability)
    const implied = 1 / favOdd;
    const edge = (fav.pct / 100) - implied;
    if (edge >= 0.10) score += 15;
    else if (edge >= 0.05) score += 8;
    else if (edge >= 0.02) score += 3;

    // Home favorite small boost (home advantage)
    if (fav.isHome) score += 5;

    // Form check: predictions.h2h or comparison fields when present
    const cmp = prediction.comparison || {};
    const formCmp = parseInt(fav.isHome ? cmp.form?.home : cmp.form?.away) || 0;
    if (formCmp >= 60) score += 5;
    else if (formCmp <= 40) score -= 5;

    // Goal-scoring difference (favorite expected to score)
    const homeAvgFor = parseFloat(prediction.teams?.home?.league?.goals?.for?.average?.total || 0);
    const awayAvgFor = parseFloat(prediction.teams?.away?.league?.goals?.for?.average?.total || 0);
    const homeAvgAg = parseFloat(prediction.teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayAvgAg = parseFloat(prediction.teams?.away?.league?.goals?.against?.average?.total || 0);
    const favFor = fav.isHome ? homeAvgFor : awayAvgFor;
    const oppAg = fav.isHome ? awayAvgAg : homeAvgAg;
    if (favFor >= 1.8 && oppAg >= 1.3) score += 6;
    else if (favFor >= 1.5 && oppAg >= 1.2) score += 3;

    return Math.max(0, Math.min(95, score));
  },

  buildFactors(prediction, fav, favOdd) {
    const factors = [`Favorito pré-jogo ${fav.pct}%`];
    const implied = (1 / favOdd * 100).toFixed(1);
    factors.push(`Odd ${favOdd.toFixed(2)} (implícito ${implied}%, edge ${(fav.pct - parseFloat(implied)).toFixed(1)}pp)`);
    if (fav.isHome) factors.push('Vantagem casa');

    const cmp = prediction.comparison || {};
    const formCmp = parseInt(fav.isHome ? cmp.form?.home : cmp.form?.away) || 0;
    if (formCmp >= 60) factors.push(`Forma comparada: ${formCmp}%`);

    const oppAg = fav.isHome
      ? parseFloat(prediction.teams?.away?.league?.goals?.against?.average?.total || 0)
      : parseFloat(prediction.teams?.home?.league?.goals?.against?.average?.total || 0);
    if (oppAg >= 1.4) factors.push(`Oponente concede ${oppAg.toFixed(2)}/jogo`);

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
