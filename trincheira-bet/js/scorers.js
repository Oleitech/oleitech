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
  MIN_GOALS_PER_GAME: 0.30,
  MIN_MINUTES_PCT: 55,    // Must have played at least 55% of available minutes
  MIN_GAMES: 12,          // Sample-size guard (across competitions, summed)
  MIN_ODDS: 1.80,
  MAX_ODDS: 3.50,
  MIN_SCORE: 65,
  MAX_PER_FIXTURE: 2,     // Top 2 candidates per fixture
  STAKE_LABEL: '0.5 stake (€5)',
  analyzed: [],
  isAnalyzing: false,
  PLAYER_PAGES: 4,        // /players paginates ~20 per page; 4 covers most squads

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

    // Pull players (paginated, all pages) + odds + predictions in parallel
    const [homePlayers, awayPlayers, oddsData, predictionData] = await Promise.all([
      this.fetchAllTeamPlayers(homeId),
      this.fetchAllTeamPlayers(awayId),
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

  // /players?team=X&season=Y is paginated; we need to fetch all pages to see
  // a full squad. Each player can also have multiple `statistics` entries
  // (one per competition) — those must be summed for a full season picture.
  async fetchAllTeamPlayers(teamId) {
    const all = [];
    for (let p = 1; p <= this.PLAYER_PAGES; p++) {
      if (Cache.getRemainingRequests() <= 2) break;
      const resp = await API.fetch('players', { team: teamId, season: this.SEASON, page: p });
      if (!Array.isArray(resp) || resp.length === 0) break;
      all.push(...resp);
      // If page returned fewer than 20 items, we've hit the last page
      if (resp.length < 20) break;
    }
    return all;
  },

  // Sum a player's stats across ALL competitions in the season
  summarizePlayer(entry) {
    const stats = entry.statistics || [];
    let goals = 0, games = 0, minutes = 0, lineups = 0;
    let position = '';
    for (const s of stats) {
      goals += s.goals?.total || 0;
      games += s.games?.appearences || 0;
      minutes += s.games?.minutes || 0;
      lineups += s.games?.lineups || 0;
      if (!position && s.games?.position) position = s.games.position;
    }
    return { goals, games, minutes, lineups, position };
  },

  evaluateTeamPlayers(playersResp, team, scorerOddsMap, fixture) {
    const out = [];
    for (const entry of playersResp) {
      const player = entry.player;
      if (!player) continue;

      const summary = this.summarizePlayer(entry);
      const { goals, games, minutes, lineups, position } = summary;

      if (position !== 'Attacker' && position !== 'Midfielder') continue;

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

  // API-Sports bet IDs for goal-scorer markets:
  //   92  → "Anytime Goal Scorer" (combined home + away)
  //   231 → "Home Anytime Goal Scorer"
  //   218 → "Away Anytime Goal Scorer"
  // Different bookmakers expose different IDs; we accept all three.
  extractAnytimeScorerOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;
    for (const oddsEntry of oddsData) {
      const bookmakers = oddsEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const matchedBets = (bk.bets || []).filter(b =>
          b.id === 92 || b.id === 231 || b.id === 218 ||
          /anytime\s+(goal\s+)?scorer/i.test(b.name || '') ||
          (b.name || '').toLowerCase() === 'goalscorer'
        );
        if (matchedBets.length === 0) continue;
        const collected = [];
        for (const bet of matchedBets) {
          for (const v of (bet.values || [])) {
            const odd = parseFloat(v.odd);
            if (odd > 1.05) {
              collected.push({ player: v.value, odd, bookmaker: bk.name || 'Unknown' });
            }
          }
        }
        if (collected.length > 0) return collected;
      }
    }
    return null;
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
