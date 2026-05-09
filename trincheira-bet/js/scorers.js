// Marcadores (Anytime Goalscorer) — pre-game tip scanner.
// Scans top-5 European leagues + Liga Portugal + Eredivisie + Pro League BE
// for in-form attackers facing leaky defences with value odds.

const Scorers = {
  // League IDs eligible for goalscorer scanning. API-Sports only returns
  // anytime-scorer odds for these reliably.
  ELIGIBLE_LEAGUES: new Set([39, 140, 78, 135, 61, 94, 88, 144]),
  // 39 Premier League, 140 La Liga, 78 Bundesliga, 135 Serie A, 61 Ligue 1,
  // 94 Liga Portugal, 88 Eredivisie, 144 Pro League BE
  SEASON: 2025, // 2025/26 European season; bump in Aug each year
  MIN_GOALS_PER_GAME: 0.40,
  MIN_MINUTES_PCT: 60,    // Must have played at least 60% of available minutes
  MIN_GAMES: 8,           // Sample-size guard
  MIN_ODDS: 1.80,
  MAX_ODDS: 3.50,
  MIN_SCORE: 70,
  MAX_PER_FIXTURE: 1,     // Top 1 candidate per fixture
  STAKE_LABEL: '0.5 stake (€5)',
  analyzed: [],
  isAnalyzing: false,

  getEligibleFixtures(fixtures) {
    return fixtures.filter(f => {
      const status = f.fixture.status.short;
      if (status !== 'NS' && status !== 'TBD') return false;
      return this.ELIGIBLE_LEAGUES.has(f.league.id);
    });
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('scorers-grid');
    if (grid) grid.innerHTML = '';

    const eligible = this.getEligibleFixtures(fixtures);
    if (eligible.length === 0) {
      this.isAnalyzing = false;
      this.renderResults([]);
      return;
    }

    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    const results = [];
    let done = 0;

    for (const f of eligible) {
      if (Cache.getRemainingRequests() <= 6) {
        UI.showToast('Limite API perto — Marcadores parcial', 'info');
        break;
      }
      updateProgress(`Marcadores ${done + 1}/${eligible.length}`);
      const fixtureCandidates = await this.analyzeFixture(f);
      results.push(...fixtureCandidates);
      done++;
      await new Promise(r => setTimeout(r, 150));
    }

    results.sort((a, b) => b.score - a.score);
    this.analyzed = results;
    this.renderResults(results);
    this.isAnalyzing = false;
  },

  async analyzeFixture(fixture) {
    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;

    // Pull players + odds + predictions in parallel (cacheable)
    const [homePlayers, awayPlayers, oddsData, predictionData] = await Promise.all([
      API.getPlayers(homeId, this.SEASON),
      API.getPlayers(awayId, this.SEASON),
      API.getOdds(fixture.fixture.id),
      API.getPrediction(fixture.fixture.id),
    ]);

    const prediction = predictionData?.[0];
    if (!prediction) return [];

    const oppDefHome = parseFloat(prediction.teams?.away?.league?.goals?.against?.average?.total || 0);
    const oppDefAway = parseFloat(prediction.teams?.home?.league?.goals?.against?.average?.total || 0);

    const scorerOdds = this.extractAnytimeScorerOdds(oddsData);
    if (!scorerOdds || scorerOdds.length === 0) return [];

    const scorerOddsByLowercase = new Map();
    scorerOdds.forEach(s => scorerOddsByLowercase.set(this.normalize(s.player), s));

    const candidates = [];
    const homeIsFav = this.isFavorite(prediction, true);
    const awayIsFav = this.isFavorite(prediction, false);

    for (const team of [
      { players: homePlayers, isHome: true, oppDef: oppDefHome, isFav: homeIsFav, teamName: fixture.teams.home.name },
      { players: awayPlayers, isHome: false, oppDef: oppDefAway, isFav: awayIsFav, teamName: fixture.teams.away.name },
    ]) {
      if (!Array.isArray(team.players)) continue;
      const teamCandidates = this.evaluateTeamPlayers(team.players, team, scorerOddsByLowercase, fixture);
      candidates.push(...teamCandidates);
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, this.MAX_PER_FIXTURE);
  },

  evaluateTeamPlayers(playersResp, team, scorerOddsMap, fixture) {
    const out = [];
    for (const entry of playersResp) {
      const player = entry.player;
      const stats = (entry.statistics || [])[0];
      if (!player || !stats) continue;

      const position = stats.games?.position;
      if (position !== 'Attacker' && position !== 'Midfielder') continue;

      const goals = stats.goals?.total || 0;
      const games = stats.games?.appearences || 0;
      const minutes = stats.games?.minutes || 0;
      const lineups = stats.games?.lineups || 0;

      if (games < this.MIN_GAMES) continue;
      const goalsPerGame = goals / games;
      if (goalsPerGame < this.MIN_GOALS_PER_GAME) continue;

      // Minutes saturation: must be a regular starter
      const maxMinutes = games * 90;
      const minutesPct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
      if (minutesPct < this.MIN_MINUTES_PCT) continue;

      // Find odds
      const oddEntry = this.matchPlayerOdds(player, scorerOddsMap);
      if (!oddEntry) continue;
      const odd = oddEntry.odd;
      if (odd < this.MIN_ODDS || odd > this.MAX_ODDS) continue;

      // Score
      let score = 50;
      if (goalsPerGame >= 0.70) score += 18;
      else if (goalsPerGame >= 0.55) score += 12;
      else if (goalsPerGame >= 0.45) score += 6;
      else score += 2;

      if (position === 'Attacker') score += 6;
      if (lineups / Math.max(games, 1) >= 0.85) score += 5; // Always starts

      if (team.oppDef >= 1.5) score += 10;
      else if (team.oppDef >= 1.3) score += 6;
      else if (team.oppDef >= 1.1) score += 2;

      if (team.isFav) score += 8;
      if (team.isHome) score += 3;

      // Odds value: anytime-scorer fair odd around 1/(g/g * 1.4) for a starter facing avg defence.
      // Reward when actual odd is meaningfully higher than the implied fair line.
      const fairOdd = 1 / (goalsPerGame * 1.3 + (team.oppDef - 1.0) * 0.10);
      if (fairOdd > 0 && odd >= fairOdd + 0.30) score += 8;
      else if (fairOdd > 0 && odd >= fairOdd + 0.10) score += 4;

      if (score < this.MIN_SCORE) continue;

      out.push({
        fixture,
        player,
        team: team.teamName,
        isHome: team.isHome,
        goals, games, goalsPerGame, minutesPct, position,
        oppDef: team.oppDef,
        isFav: team.isFav,
        odd,
        bookmaker: oddEntry.bookmaker,
        score: Math.min(95, score),
        factors: this.buildFactors(player, goalsPerGame, position, team, odd),
      });
    }
    return out;
  },

  isFavorite(prediction, isHome) {
    const homePct = parseInt(prediction.predictions?.percent?.home) || 0;
    const awayPct = parseInt(prediction.predictions?.percent?.away) || 0;
    if (isHome) return homePct >= 50 || homePct >= awayPct + 10;
    return awayPct >= 50 || awayPct >= homePct + 10;
  },

  normalize(name) {
    return (name || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/[^\w\s]/g, '')
      .trim();
  },

  matchPlayerOdds(player, oddsMap) {
    const candidates = [
      player.name,
      `${player.firstname || ''} ${player.lastname || ''}`,
      player.lastname,
    ].map(n => this.normalize(n)).filter(Boolean);

    for (const c of candidates) {
      if (oddsMap.has(c)) return oddsMap.get(c);
    }
    // Loose match: any odds key includes the lastname
    if (player.lastname) {
      const ln = this.normalize(player.lastname);
      for (const [key, val] of oddsMap) {
        if (ln && key.includes(ln)) return val;
      }
    }
    return null;
  },

  extractAnytimeScorerOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;
    const all = [];
    for (const oddsEntry of oddsData) {
      const bookmakers = oddsEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const bet = bk.bets?.find(b =>
          b.id === 36 || b.id === 38 ||
          /anytime\s+(goal)?scorer/i.test(b.name || '') ||
          (b.name || '').toLowerCase() === 'goalscorer'
        );
        if (bet && bet.values) {
          for (const v of bet.values) {
            const odd = parseFloat(v.odd);
            if (odd > 1.05) {
              all.push({ player: v.value, odd, bookmaker: bk.name || 'Unknown' });
            }
          }
          // Use first bookmaker that has the market (skip duplicates from others)
          if (all.length > 0) return all;
        }
      }
    }
    return all.length > 0 ? all : null;
  },

  buildFactors(player, gpg, position, team, odd) {
    const factors = [
      `${gpg.toFixed(2)} golos/jogo (${position === 'Attacker' ? 'avançado' : 'médio ofensivo'})`,
    ];
    if (team.isFav) factors.push('Equipa favorita');
    if (team.oppDef >= 1.4) factors.push(`Oponente concede ${team.oppDef.toFixed(2)}/jogo`);
    factors.push(`Odd ${odd.toFixed(2)}`);
    return factors;
  },

  renderResults(results) {
    const grid = document.getElementById('scorers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (results.length === 0) {
      grid.innerHTML = `<div class="top-picks__empty">Sem marcadores qualificados hoje (top-5 + PT/NL/BE)</div>`;
      this.updateBadge(0);
      return;
    }

    results.slice(0, 10).forEach(r => grid.appendChild(this.renderCard(r)));
    this.updateBadge(Math.min(results.length, 10));
  },

  renderCard(result) {
    const { fixture, player, team, odd, score, factors } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'scorers',
      marketLabel: 'Marcador',
      pick: `${player.name} marca`,
      odds: odd, score, factors,
      stake: this.STAKE_LABEL,
    });
  },

  updateBadge(n) {
    const badge = document.getElementById('badge-scorers');
    if (badge) badge.textContent = n;
    const section = document.getElementById('section-scorers');
    if (section) section.style.display = n > 0 ? '' : 'none';
  },

  init() {
    // Init hook
  }
};
