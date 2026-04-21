/**
 * LiveEngine — Strategy engine for live betting alerts.
 * Evaluates live matches against 5 data-driven strategies
 * and produces scored alert objects.
 */
const LiveEngine = {
  alertIdCounter: 0,

  /**
   * Main evaluation: run all strategies against live data.
   * Returns array of new/updated alert objects.
   */
  evaluate(fixtures, statsMap, eventsMap, oddsMap) {
    const alerts = [];

    for (const f of fixtures) {
      const fid = f.fixture.id;
      const status = f.fixture.status.short;
      const elapsed = f.fixture.status.elapsed || 0;
      const homeGoals = f.goals.home ?? 0;
      const awayGoals = f.goals.away ?? 0;
      const stats = statsMap[fid] || null;
      const events = eventsMap[fid] || null;
      const odds = oddsMap[fid] || null;

      // Strategy 1: Goals in 0-0 at HT
      if (homeGoals === 0 && awayGoals === 0 && (status === 'HT' || (status === '2H' && elapsed <= 70))) {
        const alert = this.evaluateGoals00(f, stats, elapsed);
        if (alert) alerts.push(alert);
      }

      // Strategy 2: Late Corners
      if (status === '2H' && elapsed >= LIVE_THRESHOLDS.CORNERS_MIN_ELAPSED) {
        const alert = this.evaluateLateCornersStrategy(f, stats, odds, elapsed);
        if (alert) alerts.push(alert);
      }

      // Strategy 3: Red Card Momentum
      if (events && LIVE_STATUSES.includes(status)) {
        const alert = this.evaluateRedCard(f, stats, events, elapsed);
        if (alert) alerts.push(alert);
      }

      // Strategy 4: BTTS Completion
      if ((homeGoals > 0) !== (awayGoals > 0) && LIVE_STATUSES.includes(status) && elapsed <= 80) {
        const alert = this.evaluateBTTSCompletion(f, stats, elapsed);
        if (alert) alerts.push(alert);
      }

      // Strategy 5: HT Draw Swing
      if (status === 'HT' || (status === '2H' && elapsed <= 55)) {
        if ((homeGoals === 0 && awayGoals === 0) || (homeGoals === 1 && awayGoals === 1)) {
          const alert = this.evaluateHTDrawSwing(f, stats, odds, elapsed);
          if (alert) alerts.push(alert);
        }
      }
    }

    return alerts;
  },

  // ======================== STRATEGY 1: GOALS IN 0-0 ========================

  evaluateGoals00(fixture, stats, elapsed) {
    const parsedStats = this._parseStats(stats);
    if (!parsedStats) return null;

    const { totalShots, shotsOnTarget, homeSoT, awaySoT, possession } = parsedStats;

    // Minimum attacking intent
    if (totalShots < LIVE_THRESHOLDS.GOALS_00_MIN_SHOTS &&
        shotsOnTarget < LIVE_THRESHOLDS.GOALS_00_MIN_SOT) return null;

    let confidence = 50;

    // Shot volume
    if (totalShots >= 12) confidence += 15;
    else if (totalShots >= 8) confidence += 8;

    // Shots on target
    if (shotsOnTarget >= 6) confidence += 10;
    else if (shotsOnTarget >= 4) confidence += 5;

    // Both teams attacking
    if (homeSoT >= 2 && awaySoT >= 2) confidence += 10;

    // Possession imbalance (one team pressing)
    if (possession.max >= 60) confidence += 8;

    // League attacking tendency
    const league = LEAGUES[fixture.league.id];
    if (league && league.avgCorners > 10) confidence += 5;

    // Timing bonus
    if (elapsed >= 55 && elapsed <= 65) confidence += 10;
    else if (elapsed >= 45 && elapsed < 55) confidence += 5;
    else if (elapsed > 70) confidence -= 10;

    confidence = Math.min(95, Math.max(0, confidence));
    if (confidence < LIVE_THRESHOLDS.GOALS_00_MIN_CONFIDENCE) return null;

    // Select market based on timing
    let market, pick;
    if (elapsed <= 55) {
      market = 'Over 1.5 Golos'; pick = 'Sim';
    } else if (elapsed <= 65) {
      market = 'Próximo Golo'; pick = 'Sim';
    } else {
      market = 'Pr��ximo Golo'; pick = 'Sim (valor alto)';
    }

    return this._createAlert('goals', fixture, confidence, market, pick, [
      `0-0 ${elapsed >= 45 ? 'ao intervalo' : 'aos ' + elapsed + "'"}`,
      `${totalShots} remates (${shotsOnTarget} enquadrados)`,
      possession.max >= 60 ? `Posse dominante: ${possession.max}%` : null,
      homeSoT >= 2 && awaySoT >= 2 ? 'Ambas equipas com remates enquadrados' : null,
      league ? `Liga: ${league.name} (avg ${league.avgCorners} cantos)` : null,
    ].filter(Boolean));
  },

  // ======================== STRATEGY 2: LATE CORNERS ========================

  evaluateLateCornersStrategy(fixture, stats, odds, elapsed) {
    const parsedStats = this._parseStats(stats);
    if (!parsedStats) return null;

    const currentCorners = parsedStats.corners?.total || 0;
    const league = LEAGUES[fixture.league.id];
    const avgCorners = league?.avgCorners || 9.5;

    // Estimate expected remaining corners
    const minutesPlayed = elapsed || 75;
    const cornersPerMin = currentCorners / Math.max(minutesPlayed, 1);
    const remainingMin = Math.max(90 - minutesPlayed, 1);
    const expectedRemaining = cornersPerMin * remainingMin;
    const projectedTotal = currentCorners + expectedRemaining;

    // Pick a target line that actually has value (needs 2-3 more corners, not just 1)
    // If only 1 needed, the bookmaker odds will be ~1.10 — no value
    const minGapForValue = 2;
    const targetLine = Math.floor(currentCorners + minGapForValue) + 0.5;

    // Gap: how many more corners needed to clear the line
    const gap = Math.ceil(targetLine - currentCorners);
    if (gap > LIVE_THRESHOLDS.CORNERS_MAX_GAP) return null;
    if (gap < 2) return null; // Too easy = no value in odds

    // Only alert if projected total clears the line
    if (projectedTotal < targetLine) return null;

    let confidence = 50;

    // How much does projection exceed the line
    const projectionMargin = projectedTotal - targetLine;
    if (projectionMargin >= 2) confidence += 15;
    else if (projectionMargin >= 1) confidence += 10;
    else confidence += 5;

    // One team losing (chasing)
    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;
    if (homeGoals !== awayGoals) confidence += 10;

    // Corner rate above league average
    const matchRate = (currentCorners / minutesPlayed) * 90;
    if (matchRate > avgCorners) confidence += 10;

    // High shot count (attacking play)
    if (parsedStats.totalShots >= 20) confidence += 8;

    // League tendency
    if (league && avgCorners > 10) confidence += 5;

    // Late game (80+ min — desperate play)
    if (elapsed >= 80) confidence += 5;

    // Penalize defensive match
    if (parsedStats.totalShots < 10) confidence -= 15;

    confidence = Math.min(90, Math.max(0, confidence));
    if (confidence < LIVE_THRESHOLDS.CORNERS_MIN_CONFIDENCE) return null;

    return this._createAlert('corners', fixture, confidence,
      `Over ${targetLine} Cantos`, 'Sim', [
        `${currentCorners} cantos aos ${elapsed}' — faltam ${gap}`,
        `Projeção: ${projectedTotal.toFixed(1)} cantos (linha ${targetLine})`,
        `Ritmo: ${(cornersPerMin * 90).toFixed(1)} cantos/jogo`,
        homeGoals !== awayGoals ? 'Equipa a perder vai pressionar' : null,
        matchRate > avgCorners ? `Acima da média da liga (${avgCorners})` : null,
      ].filter(Boolean));
  },

  // ======================== STRATEGY 3: RED CARD MOMENTUM ========================

  evaluateRedCard(fixture, stats, events, elapsed) {
    if (!events) return null;

    // Find recent red card
    const redCards = (Array.isArray(events) ? events : events?.events || [])
      .filter(e => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card'));

    if (redCards.length === 0) return null;

    // Find the most recent red card
    const latestRed = redCards[redCards.length - 1];
    const redMinute = latestRed.time?.elapsed || 0;
    const timeSinceRed = elapsed - redMinute;

    // Only alert within window
    if (timeSinceRed > LIVE_THRESHOLDS.RED_CARD_WINDOW_MIN || timeSinceRed < 0) return null;
    if (elapsed > 88) return null; // too late

    // Determine which team has advantage
    const redTeamIsHome = latestRed.team?.id === fixture.teams.home.id;
    const advantageTeam = redTeamIsHome ? fixture.teams.away.name : fixture.teams.home.name;
    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;

    let confidence = 60;

    // Advantage team is winning or drawing (they'll push)
    const advTeamLeading = redTeamIsHome ? awayGoals >= homeGoals : homeGoals >= awayGoals;
    if (advTeamLeading) confidence += 15;

    // Red card team is away (home team with advantage is stronger)
    if (!redTeamIsHome) confidence += 5;

    // League aggressiveness
    const league = LEAGUES[fixture.league.id];
    if (league && league.avgCards > 4.5) confidence += 8;

    // Already winning by 2+ → game is settled
    const goalDiff = Math.abs(homeGoals - awayGoals);
    if (goalDiff >= 2) confidence -= 10;

    // Fresh red card (within 5 min) → higher impact
    if (timeSinceRed <= 5) confidence += 5;

    confidence = Math.min(90, Math.max(0, confidence));
    if (confidence < LIVE_THRESHOLDS.RED_CARD_MIN_CONFIDENCE) return null;

    return this._createAlert('redcard', fixture, confidence,
      'Próximo Golo / Over Golos', advantageTeam, [
        `Cartão vermelho aos ${redMinute}' (há ${timeSinceRed} min)`,
        `${advantageTeam} com vantagem numérica`,
        advTeamLeading ? 'Equipa com vantagem vai pressionar' : 'Equipa com homem a mais pode virar',
        league ? `Liga agressiva (avg ${league.avgCards} cartões)` : null,
      ].filter(Boolean));
  },

  // ======================== STRATEGY 4: BTTS COMPLETION ========================

  evaluateBTTSCompletion(fixture, stats, elapsed) {
    const preMatch = this.getPreMatchData(fixture.fixture.id);
    if (!preMatch || !preMatch.bttsScore) return null;
    if (preMatch.bttsScore < LIVE_THRESHOLDS.BTTS_COMP_MIN_PREMATCH) return null;

    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;

    // Only one team has scored
    const scoringTeam = homeGoals > 0 ? 'home' : 'away';
    const nonScoringTeam = scoringTeam === 'home' ? 'away' : 'home';
    const nonScoringName = fixture.teams[nonScoringTeam].name;

    let confidence = 55;

    // Pre-match BTTS score bonus
    confidence += Math.floor((preMatch.bttsScore - 70) * 0.5);

    // Timing: more time = more chance
    if (elapsed < 60) confidence += 8;
    else if (elapsed < 70) confidence += 5;
    else if (elapsed > 80) confidence -= 10;

    // Stats: non-scoring team showing intent
    const parsedStats = this._parseStats(stats);
    if (parsedStats) {
      const nonScorerSoT = nonScoringTeam === 'home' ? parsedStats.homeSoT : parsedStats.awaySoT;
      const nonScorerPoss = nonScoringTeam === 'home' ? parsedStats.possession.home : parsedStats.possession.away;

      if (nonScorerSoT >= 3) confidence += 10;
      else if (nonScorerSoT >= 1) confidence += 5;
      if (nonScorerPoss >= 45) confidence += 8;
      if (nonScorerSoT === 0) confidence -= 10;
    }

    confidence = Math.min(90, Math.max(0, confidence));
    if (confidence < LIVE_THRESHOLDS.BTTS_COMP_MIN_CONFIDENCE) return null;

    return this._createAlert('btts', fixture, confidence,
      'Ambas Marcam', 'Sim', [
        `Pré-match BTTS score: ${preMatch.bttsScore}`,
        `${nonScoringName} ainda não marcou`,
        elapsed < 70 ? 'Tempo suficiente para empatar' : 'Tempo a esgotar — odds altas',
        parsedStats ? `${nonScoringName}: ${nonScoringTeam === 'home' ? parsedStats.homeSoT : parsedStats.awaySoT} remates enquadrados` : null,
      ].filter(Boolean));
  },

  // ======================== STRATEGY 5: HT DRAW SWING ========================

  evaluateHTDrawSwing(fixture, stats, odds, elapsed) {
    // Need to determine if there's a strong favorite
    const preMatch = this.getPreMatchData(fixture.fixture.id);
    const league = LEAGUES[fixture.league.id];

    // Without pre-match data or league info, skip
    if (!preMatch && !league) return null;

    let confidence = 50;
    let favoriteTeam = null;
    let favoriteLabel = '';

    // Check pre-match data for favorite
    if (preMatch) {
      if (preMatch.bttsScore >= 75 || preMatch.over25Score >= 75) {
        confidence += 8; // High-scoring match expected
      }
    }

    // Use stats to determine who's dominating
    const parsedStats = this._parseStats(stats);
    if (!parsedStats) return null;

    const homeDominates = parsedStats.possession.home >= 55 && parsedStats.homeSoT >= parsedStats.awaySoT;
    const awayDominates = parsedStats.possession.away >= 55 && parsedStats.awaySoT >= parsedStats.homeSoT;

    if (homeDominates) {
      favoriteTeam = 'home';
      favoriteLabel = fixture.teams.home.name;
      confidence += 15;
    } else if (awayDominates) {
      favoriteTeam = 'away';
      favoriteLabel = fixture.teams.away.name;
      confidence += 15;
    } else {
      return null; // No clear favorite
    }

    // Shot volume from favorite
    const favSoT = favoriteTeam === 'home' ? parsedStats.homeSoT : parsedStats.awaySoT;
    if (favSoT >= 4) confidence += 10;
    else if (favSoT >= 2) confidence += 5;

    // Home advantage for favorite
    if (favoriteTeam === 'home') confidence += 5;

    // Attacking league
    if (league && league.bttsRate >= 55) confidence += 5;

    // Score context
    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;
    if (homeGoals === 1 && awayGoals === 1) {
      // 1-1 is more volatile — underdog might have momentum
      confidence -= 5;
    }

    confidence = Math.min(85, Math.max(0, confidence));
    if (confidence < LIVE_THRESHOLDS.HT_SWING_MIN_CONFIDENCE) return null;

    return this._createAlert('swing', fixture, confidence,
      `Resultado 2ª Parte`, favoriteLabel, [
        `${favoriteLabel} domina: ${parsedStats.possession[favoriteTeam]}% posse`,
        `${favSoT} remates enquadrados do favorito`,
        `Score atual: ${homeGoals}-${awayGoals}`,
        favoriteTeam === 'home' ? 'Vantagem casa na 2ª parte' : null,
        league ? `Liga atacante: ${league.name}` : null,
      ].filter(Boolean));
  },

  // ======================== HELPERS ========================

  /** Get pre-match analysis data from localStorage */
  getPreMatchData(fixtureId) {
    const map = Cache.get('prematch_live');
    return map?.[fixtureId] || null;
  },

  /** Parse stats response into usable format */
  _parseStats(stats) {
    if (!stats) return null;

    // stats can be an array of 2 team stat objects
    const teamStats = Array.isArray(stats) ? stats : stats?.statistics || stats;
    if (!Array.isArray(teamStats) || teamStats.length < 2) return null;

    const getStat = (teamIdx, type) => {
      const team = teamStats[teamIdx];
      const statArr = team?.statistics || team?.stat || [];
      const found = statArr.find(s => s.type === type);
      return found ? parseInt(found.value) || 0 : 0;
    };

    const getStatPct = (teamIdx, type) => {
      const team = teamStats[teamIdx];
      const statArr = team?.statistics || team?.stat || [];
      const found = statArr.find(s => s.type === type);
      if (!found || !found.value) return 0;
      return parseInt(String(found.value).replace('%', '')) || 0;
    };

    const homeShots = getStat(0, 'Total Shots');
    const awayShots = getStat(1, 'Total Shots');
    const homeSoT = getStat(0, 'Shots on Goal');
    const awaySoT = getStat(1, 'Shots on Goal');
    const homePoss = getStatPct(0, 'Ball Possession');
    const awayPoss = getStatPct(1, 'Ball Possession');
    const homeCorners = getStat(0, 'Corner Kicks');
    const awayCorners = getStat(1, 'Corner Kicks');

    return {
      totalShots: homeShots + awayShots,
      shotsOnTarget: homeSoT + awaySoT,
      homeSoT,
      awaySoT,
      possession: {
        home: homePoss,
        away: awayPoss,
        max: Math.max(homePoss, awayPoss),
      },
      corners: {
        home: homeCorners,
        away: awayCorners,
        total: homeCorners + awayCorners,
      },
    };
  },

  /** Create a standardized alert object */
  _createAlert(strategy, fixture, confidence, market, pick, factors) {
    return {
      id: `${strategy}_${fixture.fixture.id}`,
      strategy,
      fixtureId: fixture.fixture.id,
      fixture,
      confidence: Math.round(confidence),
      market,
      pick,
      factors,
      timestamp: Date.now(),
      dismissed: false,
      expired: false,
    };
  },

  /** Merge new alerts with existing, dedup and update */
  mergeAlerts(existing, incoming) {
    const merged = [...existing];

    for (const alert of incoming) {
      const idx = merged.findIndex(a => a.id === alert.id && !a.dismissed);
      if (idx >= 0) {
        // Update confidence if changed significantly
        if (Math.abs(merged[idx].confidence - alert.confidence) >= 5) {
          merged[idx] = { ...alert, timestamp: merged[idx].timestamp }; // keep original timestamp
        }
        // Update factors regardless
        merged[idx].factors = alert.factors;
      } else if (!existing.some(a => a.id === alert.id && a.dismissed)) {
        // New alert (not previously dismissed)
        alert._isNew = true;
        merged.push(alert);
      }
    }

    return merged;
  },

  /** Expire alerts when conditions no longer apply */
  expireAlerts(alerts, liveFixtures) {
    const liveIds = new Set(liveFixtures.map(f => f.fixture.id));

    return alerts.map(alert => {
      if (alert.expired || alert.dismissed) return alert;

      const fixture = liveFixtures.find(f => f.fixture.id === alert.fixtureId);

      // Match ended
      if (!fixture || FINISHED_STATUSES.includes(fixture.fixture.status.short)) {
        return { ...alert, expired: true };
      }

      const homeGoals = fixture.goals.home ?? 0;
      const awayGoals = fixture.goals.away ?? 0;

      // Strategy 1: goal scored in 0-0 game
      if (alert.strategy === 'goals' && (homeGoals > 0 || awayGoals > 0)) {
        return { ...alert, expired: true };
      }

      // Strategy 4: both teams scored (BTTS hit)
      if (alert.strategy === 'btts' && homeGoals > 0 && awayGoals > 0) {
        return { ...alert, expired: true };
      }

      // Strategy 3: red card window passed
      if (alert.strategy === 'redcard') {
        const elapsed = fixture.fixture.status.elapsed || 0;
        const alertAge = (Date.now() - alert.timestamp) / 60000;
        if (alertAge > LIVE_THRESHOLDS.RED_CARD_WINDOW_MIN) {
          return { ...alert, expired: true };
        }
      }

      return alert;
    });
  },

  /** Determine which fixtures need detailed stats fetching */
  getFixturesToFetchDetails(fixtures) {
    const toFetch = [];

    for (const f of fixtures) {
      const status = f.fixture.status.short;
      const elapsed = f.fixture.status.elapsed || 0;
      const homeGoals = f.goals.home ?? 0;
      const awayGoals = f.goals.away ?? 0;

      let needed = false;

      // Strategy 1 & 5: 0-0 or 1-1 at HT or early 2H
      if ((homeGoals === 0 && awayGoals === 0) && (status === 'HT' || status === '2H')) needed = true;
      if ((homeGoals === 1 && awayGoals === 1) && (status === 'HT' || (status === '2H' && elapsed <= 55))) needed = true;

      // Strategy 2: Late game
      if (status === '2H' && elapsed >= LIVE_THRESHOLDS.CORNERS_MIN_ELAPSED) needed = true;

      // Strategy 4: One team scored, pre-match BTTS was high
      if ((homeGoals > 0) !== (awayGoals > 0) && elapsed <= 80) {
        const preMatch = this.getPreMatchData(f.fixture.id);
        if (preMatch && preMatch.bttsScore >= LIVE_THRESHOLDS.BTTS_COMP_MIN_PREMATCH) needed = true;
      }

      if (needed) toFetch.push(f.fixture.id);

      // Cap at MAX_DETAIL_FETCHES
      if (toFetch.length >= LIVE_THRESHOLDS.MAX_DETAIL_FETCHES) break;
    }

    return toFetch;
  }
};
