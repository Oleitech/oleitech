const Analysis = {

  analyze(prediction) {
    if (!prediction) return [];
    const patterns = [];

    const btts = this.detectBTTS(prediction);
    if (btts) patterns.push(btts);

    const over = this.detectOver25(prediction);
    if (over) patterns.push(over);

    const hc = this.detectHandicap(prediction);
    if (hc) patterns.push(hc);

    const fh = this.detectFirstHalf(prediction);
    if (fh) patterns.push(fh);

    const winner = this.detectWinner(prediction);
    if (winner) patterns.push(winner);

    return patterns;
  },

  // ===================== BTTS DEEP ANALYSIS =====================
  // Multi-factor scoring system for Both Teams to Score prediction

  analyzeBTTS(prediction) {
    if (!prediction) return null;

    const teams = prediction.teams;
    const h2h = prediction.h2h || [];
    const comp = this.getComparison(prediction);
    const leagueId = prediction.league?.id;

    // === Factor 1: Goals Scored (both teams attack) ===
    const homeGoalsFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const awayGoalsFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const homeGoalsAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayGoalsAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    let score = 0;
    const factors = [];

    // Home team likely to score (they attack well OR opponent concedes a lot)
    const homeExpectedScoring = (homeGoalsFor + awayGoalsAgainst) / 2;
    const awayExpectedScoring = (awayGoalsFor + homeGoalsAgainst) / 2;

    if (homeExpectedScoring >= 1.8) { score += 15; factors.push(`Casa esperado: ${homeExpectedScoring.toFixed(1)} golos`); }
    else if (homeExpectedScoring >= 1.4) { score += 10; }
    else if (homeExpectedScoring >= 1.1) { score += 5; }

    if (awayExpectedScoring >= 1.8) { score += 15; factors.push(`Fora esperado: ${awayExpectedScoring.toFixed(1)} golos`); }
    else if (awayExpectedScoring >= 1.4) { score += 10; }
    else if (awayExpectedScoring >= 1.1) { score += 5; }

    // === Factor 2: Both teams concede (defensive weakness) ===
    // Key BTTS indicator: both teams have leaky defenses
    if (homeGoalsAgainst >= 1.5 && awayGoalsAgainst >= 1.5) {
      score += 15;
      factors.push(`Ambos sofrem bastante (${homeGoalsAgainst}/${awayGoalsAgainst})`);
    } else if (homeGoalsAgainst >= 1.2 && awayGoalsAgainst >= 1.2) {
      score += 10;
    } else if (homeGoalsAgainst >= 1.0 && awayGoalsAgainst >= 1.0) {
      score += 5;
    }

    // Penalty: one team barely concedes (clean sheet machine)
    if (homeGoalsAgainst < 0.8 || awayGoalsAgainst < 0.8) {
      score -= 10;
      factors.push('⚠ Uma equipa sofre poucos golos');
    }

    // === Factor 3: Both teams score regularly ===
    if (homeGoalsFor >= 1.5 && awayGoalsFor >= 1.5) {
      score += 12;
      factors.push(`Ambos marcam bem (${homeGoalsFor}/${awayGoalsFor} por jogo)`);
    } else if (homeGoalsFor >= 1.2 && awayGoalsFor >= 1.2) {
      score += 8;
    } else if (homeGoalsFor >= 1.0 && awayGoalsFor >= 1.0) {
      score += 4;
    }

    // Penalty: one team barely scores
    if (homeGoalsFor < 0.8 || awayGoalsFor < 0.8) {
      score -= 12;
      factors.push('⚠ Uma equipa marca poucos golos');
    }

    // === Factor 4: H2H BTTS Rate ===
    if (h2h.length >= 3) {
      const h2hBtts = this.calculateH2HBTTS(h2h);
      if (h2hBtts.rate >= 80) {
        score += 15;
        factors.push(`H2H: BTTS em ${h2hBtts.count}/${h2hBtts.total} jogos (${h2hBtts.rate}%)`);
      } else if (h2hBtts.rate >= 60) {
        score += 10;
        factors.push(`H2H: BTTS em ${h2hBtts.count}/${h2hBtts.total} jogos (${h2hBtts.rate}%)`);
      } else if (h2hBtts.rate >= 40) {
        score += 3;
      } else if (h2hBtts.rate < 30 && h2hBtts.total >= 3) {
        score -= 5;
        factors.push(`⚠ H2H baixo: BTTS em apenas ${h2hBtts.count}/${h2hBtts.total}`);
      }
    }

    // === Factor 5: Recent Form ===
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);

    // Teams winning/drawing = scoring regularly
    const homeScoring = homeForm.wins + homeForm.draws;
    const awayScoring = awayForm.wins + awayForm.draws;

    if (homeScoring >= 4 && awayScoring >= 4) {
      score += 8;
      factors.push('Ambos em boa forma ofensiva');
    } else if (homeScoring >= 3 && awayScoring >= 3) {
      score += 5;
    }

    // Teams losing a lot = conceding regularly (good for BTTS from opponent's side)
    if (homeForm.losses >= 2 && awayForm.losses >= 2) {
      score += 5;
      factors.push('Ambos a perder regularmente (defesas vulneráveis)');
    }

    // === Factor 6: League BTTS Factor ===
    const leagueData = LEAGUES[leagueId];
    if (leagueData?.bttsRate) {
      const leagueBonus = Math.round((leagueData.bttsRate - 50) * 0.6);
      score += Math.max(0, leagueBonus);
      if (leagueData.bttsRate >= 58) {
        factors.push(`Liga forte para BTTS (${leagueData.bttsRate}% histórico)`);
      }
    }

    // === Factor 7: Comparison data ===
    // When both teams have similar attack strength, BTTS is more likely
    const attDiff = Math.abs(comp.homeAtt - comp.awayAtt);
    if (attDiff < 15 && comp.homeAtt >= 45 && comp.awayAtt >= 45) {
      score += 5;
      factors.push('Ataques equilibrados');
    }

    // Both teams with good attack comparison
    if (comp.homeAtt >= 55 && comp.awayAtt >= 55) {
      score += 5;
    }

    // === Factor 8: Not a heavy favorite match ===
    // Heavy favorites often keep clean sheets
    const totalDiff = Math.abs(comp.homeTotal - comp.awayTotal);
    if (totalDiff > 30) {
      score -= 8;
      factors.push('⚠ Jogo muito desequilibrado');
    } else if (totalDiff < 15) {
      score += 4;
      factors.push('Jogo equilibrado (bom para BTTS)');
    }

    // === Factor 9: Learning from historical results ===
    let learningFactors = [];
    if (typeof Learning !== 'undefined' && Learning.ready) {
      const leagueName = leagueData?.name || '';
      const adj = Learning.getBTTSAdjustment(score, leagueName);
      score += adj.delta;
      learningFactors = adj.factors;
    }

    // === Calculate confidence ===
    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    if (score < THRESHOLDS.BTTS_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.BTTS_FIRE ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.BTTS_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.BTTS_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.BTTS.key,
      label: PATTERNS.BTTS.label,
      shortLabel: PATTERNS.BTTS.shortLabel,
      confidence,
      confidencePercent: score + '%',
      score,
      factors,
      stats: {
        homeGoalsFor,
        homeGoalsAgainst,
        awayGoalsFor,
        awayGoalsAgainst,
        homeExpectedScoring: homeExpectedScoring.toFixed(2),
        awayExpectedScoring: awayExpectedScoring.toFixed(2),
        h2hBtts: h2h.length >= 3 ? this.calculateH2HBTTS(h2h) : null,
        leagueBttsRate: leagueData?.bttsRate || null,
        homeForm: homeForm.str,
        awayForm: awayForm.str
      },
      detail: factors.filter(f => !f.startsWith('⚠')).slice(0, 2).join(' · '),
      learningFactors,
      risk: (typeof Learning !== 'undefined' && Learning.ready) ? Learning.getBTTSRisk(score) : null
    };
  },

  calculateH2HBTTS(h2hMatches) {
    const relevant = h2hMatches.slice(0, 8); // Last 8 meetings
    let bttsCount = 0;
    relevant.forEach(m => {
      if (m.goals.home > 0 && m.goals.away > 0) bttsCount++;
    });
    return {
      count: bttsCount,
      total: relevant.length,
      rate: Math.round((bttsCount / relevant.length) * 100)
    };
  },

  parseForm(formStr) {
    if (!formStr) return { wins: 0, draws: 0, losses: 0, total: 0, str: '' };
    const chars = formStr.replace(/[^WDL]/g, '').split('');
    return {
      wins: chars.filter(c => c === 'W').length,
      draws: chars.filter(c => c === 'D').length,
      losses: chars.filter(c => c === 'L').length,
      total: chars.length,
      str: chars.join('')
    };
  },

  getComparison(prediction) {
    const comp = prediction.comparison || {};
    const parse = (v) => parseInt((v || '0%').replace('%', ''));
    return {
      homeForm: parse(comp.form?.home),
      awayForm: parse(comp.form?.away),
      homeAtt: parse(comp.att?.home),
      awayAtt: parse(comp.att?.away),
      homeDef: parse(comp.def?.home),
      awayDef: parse(comp.def?.away),
      homePoisson: parse(comp.poisson_distribution?.home),
      awayPoisson: parse(comp.poisson_distribution?.away),
      homeH2H: parse(comp.h2h?.home),
      awayH2H: parse(comp.h2h?.away),
      homeGoals: parse(comp.goals?.home),
      awayGoals: parse(comp.goals?.away),
      homeTotal: parse(comp.total?.home),
      awayTotal: parse(comp.total?.away),
    };
  },

  // ===================== ORIGINAL PATTERN DETECTORS =====================
  // Kept for the main fixtures analysis

  detectBTTS(prediction) {
    const result = this.analyzeBTTS(prediction);
    if (!result) return null;
    // Return simplified version for fixture cards
    return {
      key: result.key,
      label: result.label,
      shortLabel: result.shortLabel,
      confidence: result.confidence,
      confidencePercent: result.confidencePercent,
      detail: result.detail
    };
  },

  detectOver25(prediction) {
    const teams = prediction.teams;
    const homeFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const homeAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const awayAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    const avgGoals = (homeFor + homeAgainst + awayFor + awayAgainst) / 2;
    let score = 0;

    if (avgGoals >= THRESHOLDS.GOALS_AVG_HIGH) score += 40;
    else if (avgGoals >= THRESHOLDS.GOALS_AVG_MEDIUM) score += 20;

    if (homeFor >= 1.5) score += 15;
    if (awayFor >= 1.5) score += 15;
    if (homeAgainst >= 1.3) score += 10;
    if (awayAgainst >= 1.3) score += 10;

    const comp = this.getComparison(prediction);
    if (comp.homeGoals > 50) score += 5;
    if (comp.awayGoals > 50) score += 5;

    if (score < THRESHOLDS.OVER25_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.OVER25_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.OVER25_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.OVER25.key,
      label: PATTERNS.OVER25.label,
      shortLabel: PATTERNS.OVER25.shortLabel,
      confidence,
      confidencePercent: score + '%',
      detail: `Média golos combinada: ${avgGoals.toFixed(1)} por jogo.`
    };
  },

  detectHandicap(prediction) {
    const comp = this.getComparison(prediction);
    const teams = prediction.teams;
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);

    let dominantSide = null;
    let score = 0;
    let teamName = '';

    if (comp.homeTotal >= THRESHOLDS.HOME_DOMINANCE) {
      dominantSide = 'home';
      teamName = teams?.home?.name || 'Casa';
      score += comp.homeTotal - 50;
      if (homeForm.wins >= THRESHOLDS.FORM_STRONG) score += 15;
      if (comp.homeAtt > 60) score += 10;
      if (comp.homeDef > 55) score += 5;
      if (awayForm.losses >= 3) score += 10;
    } else if (comp.awayTotal >= THRESHOLDS.HOME_DOMINANCE) {
      dominantSide = 'away';
      teamName = teams?.away?.name || 'Fora';
      score += comp.awayTotal - 50;
      if (awayForm.wins >= THRESHOLDS.FORM_STRONG) score += 15;
      if (comp.awayAtt > 60) score += 10;
      if (comp.awayDef > 55) score += 5;
      if (homeForm.losses >= 3) score += 10;
    }

    if (!dominantSide || score < 25) return null;

    const confidence = score >= 40 ? CONFIDENCE.HIGH :
                       score >= 25 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.HANDICAP.key,
      label: `HC -1 ${teamName}`,
      shortLabel: PATTERNS.HANDICAP.shortLabel,
      confidence,
      confidencePercent: score + '%',
      detail: `${teamName} domina: forma ${dominantSide === 'home' ? comp.homeTotal : comp.awayTotal}%, ataque ${dominantSide === 'home' ? comp.homeAtt : comp.awayAtt}%.`
    };
  },

  detectFirstHalf(prediction) {
    const comp = this.getComparison(prediction);
    const teams = prediction.teams;

    let side = null;
    let score = 0;
    let teamName = '';

    const homeFor = parseFloat(teams?.home?.league?.goals?.for?.average?.home || 0);
    const awayFor = parseFloat(teams?.away?.league?.goals?.for?.average?.away || 0);

    if (comp.homeTotal >= 65 && homeFor > 1.5) {
      side = 'home';
      teamName = teams?.home?.name || 'Casa';
      score += Math.min(comp.homeTotal - 50, 30);
      if (homeFor > 2.0) score += 15;
      if (comp.homeAtt > 65) score += 10;
      const homeFormData = this.parseForm(teams?.home?.league?.form);
      if (homeFormData.wins >= THRESHOLDS.FORM_STRONG) score += 10;
    } else if (comp.awayTotal >= 65 && awayFor > 1.5) {
      side = 'away';
      teamName = teams?.away?.name || 'Fora';
      score += Math.min(comp.awayTotal - 50, 30);
      if (awayFor > 2.0) score += 15;
      if (comp.awayAtt > 65) score += 10;
      const awayFormData = this.parseForm(teams?.away?.league?.form);
      if (awayFormData.wins >= THRESHOLDS.FORM_STRONG) score += 10;
    }

    if (!side || score < 30) return null;

    const confidence = score >= 50 ? CONFIDENCE.HIGH :
                       score >= 30 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.FIRST_HALF.key,
      label: `V1P ${teamName}`,
      shortLabel: PATTERNS.FIRST_HALF.shortLabel,
      confidence,
      confidencePercent: score + '%',
      detail: `${teamName}: forte em casa/fora com média de ${side === 'home' ? homeFor : awayFor} golos.`
    };
  },

  detectWinner(prediction) {
    const advice = prediction.predictions;
    if (!advice || !advice.winner) return null;

    const comp = this.getComparison(prediction);
    const winnerId = advice.winner.id;
    const winnerName = advice.winner.name;
    const teams = prediction.teams;

    const isHome = winnerId === teams?.home?.id;
    const total = isHome ? comp.homeTotal : comp.awayTotal;

    if (total < 55) return null;

    let score = total - 40;
    const form = isHome
      ? this.parseForm(teams?.home?.league?.form)
      : this.parseForm(teams?.away?.league?.form);

    if (form.wins >= THRESHOLDS.FORM_GOOD) score += 10;
    if (form.wins >= THRESHOLDS.FORM_STRONG) score += 5;

    const confidence = score >= 35 ? CONFIDENCE.HIGH :
                       score >= 20 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    const patternDef = isHome ? PATTERNS.HOME_WIN : PATTERNS.AWAY_WIN;

    return {
      key: patternDef.key,
      label: `${winnerName}`,
      shortLabel: patternDef.shortLabel,
      confidence,
      confidencePercent: score + '%',
      detail: `${advice.winner.comment || ''} Comparação total: ${total}%.`
    };
  }
};
