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

  // ===================== CARDS DEEP ANALYSIS =====================
  // Multi-factor scoring for Over/Under Cards prediction

  analyzeCards(prediction, fixture) {
    if (!prediction) return null;

    const teams = prediction.teams;
    const comp = this.getComparison(prediction);
    const h2h = prediction.h2h || [];
    const leagueId = fixture?.league?.id || prediction.league?.id;
    const leagueData = LEAGUES[leagueId];

    const homeGoalsFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const homeGoalsAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayGoalsFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const awayGoalsAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    let score = 0;
    const factors = [];

    // === Factor 1: League average cards ===
    const leagueAvgCards = leagueData?.avgCards || 4.0;
    if (leagueAvgCards >= 5.0) {
      score += 20;
      factors.push(`Liga alta em cartões (${leagueAvgCards}/jogo)`);
    } else if (leagueAvgCards >= 4.5) {
      score += 15;
      factors.push(`Liga acima da média em cartões (${leagueAvgCards}/jogo)`);
    } else if (leagueAvgCards >= 4.0) {
      score += 10;
      factors.push(`Liga média em cartões (${leagueAvgCards}/jogo)`);
    } else if (leagueAvgCards >= 3.5) {
      score += 5;
    } else {
      score -= 3;
    }

    // === Factor 2: Match competitiveness (close matches = more fouls = more cards) ===
    const totalDiff = Math.abs(comp.homeTotal - comp.awayTotal);
    if (totalDiff < 10) {
      score += 15;
      factors.push('Jogo muito equilibrado (mais disputas = mais cartões)');
    } else if (totalDiff < 20) {
      score += 10;
      factors.push('Jogo competitivo');
    } else if (totalDiff < 30) {
      score += 5;
    } else if (totalDiff > 35) {
      score -= 3;
    }

    // === Factor 3: Defensive intensity (teams that concede = pressure = fouls) ===
    const combinedConceded = (homeGoalsAgainst + awayGoalsAgainst) / 2;
    if (combinedConceded >= 1.5) {
      score += 12;
      factors.push(`Defesas pressionadas (${combinedConceded.toFixed(1)} sofridos/jogo)`);
    } else if (combinedConceded >= 1.0) {
      score += 8;
    } else if (combinedConceded >= 0.8) {
      score += 4;
    }

    // === Factor 4: Both teams attack well (attacking play = tactical fouls) ===
    const combinedAttack = (homeGoalsFor + awayGoalsFor) / 2;
    if (combinedAttack >= 1.6) {
      score += 12;
      factors.push(`Ambas ofensivas (${combinedAttack.toFixed(1)} golos/jogo)`);
    } else if (combinedAttack >= 1.2) {
      score += 8;
    } else if (combinedAttack >= 0.9) {
      score += 4;
    }

    // === Factor 5: Form — teams losing = frustrated = more fouls ===
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);

    if (homeForm.losses >= 2 || awayForm.losses >= 2) {
      score += 10;
      factors.push('Equipas com derrotas recentes (frustração = faltas)');
    }
    if (homeForm.losses >= 3 && awayForm.losses >= 3) {
      score += 5;
    }

    // === Factor 6: Derby / rivalry indicator (high-scoring H2H with close results) ===
    if (h2h.length >= 3) {
      const h2hGoals = this.calculateH2HGoals(h2h);
      const h2hClose = h2h.slice(0, 5).filter(m => Math.abs((m.goals.home || 0) - (m.goals.away || 0)) <= 1).length;
      if (h2hClose >= 3) {
        score += 12;
        factors.push(`H2H disputado: ${h2hClose}/${Math.min(h2h.length, 5)} jogos decididos por ≤1 golo`);
      } else if (h2hClose >= 2) {
        score += 5;
      }
      if (h2hGoals.avgGoals >= 3.0) {
        score += 8;
        factors.push(`H2H intenso: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      } else if (h2hGoals.avgGoals >= 2.0) {
        score += 3;
      }
    }

    // === Factor 7: Both defenses strong in comparison (tight marking = more fouls) ===
    if (comp.homeDef >= 50 && comp.awayDef >= 50) {
      score += 10;
      factors.push('Ambas equipas defensivamente sólidas (marcação apertada)');
    } else if (comp.homeDef >= 45 || comp.awayDef >= 45) {
      score += 5;
    }

    // === Factor 8: South American / Mediterranean leagues bonus ===
    const hotLeagues = ['AR', 'BR', 'CO', 'MX', 'TR', 'PT', 'ES', 'IT', 'GR', 'CY', 'SA'];
    if (hotLeagues.includes(leagueData?.flag)) {
      score += 8;
      factors.push('Liga com histórico alto de cartões');
    }

    // === Factor 9: Learning ===
    let learningFactors = [];
    if (typeof Learning !== 'undefined' && Learning.ready) {
      const adj = Learning.getCardsAdjustment();
      score += adj.delta;
      learningFactors = adj.factors;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < THRESHOLDS.CARDS_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.CARDS_FIRE ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.CARDS_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.CARDS_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    const cardBonus = (combinedAttack - 1.2) * 0.5 + (totalDiff < 15 ? 0.5 : 0);
    const estimatedCards = Math.max(2.5, leagueAvgCards + cardBonus).toFixed(1);

    return {
      score,
      confidence,
      factors,
      learningFactors,
      estimatedCards: parseFloat(estimatedCards),
      leagueAvgCards,
      stats: {
        homeGoalsFor,
        homeGoalsAgainst,
        awayGoalsFor,
        awayGoalsAgainst,
        combinedAttack: combinedAttack.toFixed(1),
        combinedConceded: combinedConceded.toFixed(1),
        homeForm: homeForm.str,
        awayForm: awayForm.str,
        totalDiff
      }
    };
  },

  // ===================== OVER 1.5 GOALS DEEP ANALYSIS =====================

  analyzeOver15(prediction) {
    if (!prediction) return null;

    const teams = prediction.teams;
    const comp = this.getComparison(prediction);
    const h2h = prediction.h2h || [];
    const leagueId = prediction.league?.id;
    const leagueData = LEAGUES[leagueId];

    const homeGoalsFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const homeGoalsAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayGoalsFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const awayGoalsAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    const totalExpected = homeGoalsFor + awayGoalsFor;
    const avgGoals = (homeGoalsFor + homeGoalsAgainst + awayGoalsFor + awayGoalsAgainst) / 2;

    let score = 0;
    const factors = [];

    // === Factor 1: Combined goals expected ===
    if (totalExpected >= 3.5) {
      score += 20;
      factors.push(`Golos combinados esperados: ${totalExpected.toFixed(1)}`);
    } else if (totalExpected >= 2.8) {
      score += 16;
      factors.push(`Golos combinados: ${totalExpected.toFixed(1)}`);
    } else if (totalExpected >= 2.2) {
      score += 12;
      factors.push(`Golos combinados: ${totalExpected.toFixed(1)}`);
    } else if (totalExpected >= 1.8) {
      score += 6;
    } else {
      score -= 8;
    }

    // === Factor 2: Both teams score regularly (even one scoring is enough for O1.5) ===
    if (homeGoalsFor >= 1.5 && awayGoalsFor >= 1.0) {
      score += 15;
      factors.push(`Casa marca ${homeGoalsFor}/jogo + fora contribui`);
    } else if (homeGoalsFor >= 1.0 && awayGoalsFor >= 1.5) {
      score += 15;
      factors.push(`Fora marca ${awayGoalsFor}/jogo + casa contribui`);
    } else if (homeGoalsFor >= 1.2 || awayGoalsFor >= 1.2) {
      score += 10;
    } else if (homeGoalsFor >= 0.9 || awayGoalsFor >= 0.9) {
      score += 5;
    }

    // === Factor 3: Leaky defenses (goals will happen) ===
    if (homeGoalsAgainst >= 1.3 && awayGoalsAgainst >= 1.3) {
      score += 15;
      factors.push(`Defesas permeáveis (${homeGoalsAgainst}/${awayGoalsAgainst} sofridos)`);
    } else if (homeGoalsAgainst >= 1.0 && awayGoalsAgainst >= 1.0) {
      score += 10;
    } else if (homeGoalsAgainst >= 1.0 || awayGoalsAgainst >= 1.0) {
      score += 6;
    }

    // Penalty: both teams are very defensive
    if (homeGoalsFor < 0.7 && awayGoalsFor < 0.7) {
      score -= 15;
      factors.push('⚠ Ambas equipas marcam muito pouco');
    }

    // === Factor 4: H2H goals ===
    if (h2h.length >= 3) {
      const h2hGoals = this.calculateH2HGoals(h2h);
      if (h2hGoals.avgGoals >= 3.0) {
        score += 12;
        factors.push(`H2H: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      } else if (h2hGoals.avgGoals >= 2.0) {
        score += 8;
        factors.push(`H2H: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      } else if (h2hGoals.avgGoals < 1.5) {
        score -= 5;
        factors.push(`⚠ H2H baixo: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      }
    }

    // === Factor 5: Form — scoring form ===
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);
    if (homeForm.wins >= 3 || awayForm.wins >= 3) {
      score += 10;
      factors.push('Equipa em boa forma ofensiva');
    } else if (homeForm.wins >= 2 || awayForm.wins >= 2) {
      score += 5;
    }

    // === Factor 6: Attack comparison ===
    if (comp.homeAtt >= 50 && comp.awayAtt >= 50) {
      score += 10;
      factors.push('Ambos ataques acima da média');
    } else if (comp.homeAtt >= 55 || comp.awayAtt >= 55) {
      score += 7;
    } else if (comp.homeAtt >= 45 || comp.awayAtt >= 45) {
      score += 3;
    }

    // === Factor 7: League general goalscoring ===
    if (leagueData?.bttsRate >= 58) {
      score += 8;
      factors.push(`Liga ofensiva (BTTS ${leagueData.bttsRate}%)`);
    } else if (leagueData?.bttsRate >= 52) {
      score += 4;
    }

    // === Factor 8: Learning ===
    let learningFactors = [];
    if (typeof Learning !== 'undefined' && Learning.ready) {
      const adj = Learning.getOver15Adjustment();
      score += adj.delta;
      learningFactors = adj.factors;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < THRESHOLDS.OVER15_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.OVER15_FIRE ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.OVER15_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.OVER15_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.OVER15.key,
      label: PATTERNS.OVER15.label,
      shortLabel: PATTERNS.OVER15.shortLabel,
      confidence,
      confidencePercent: score + '%',
      score,
      factors,
      learningFactors,
      estimatedGoals: avgGoals.toFixed(1),
      stats: {
        homeGoalsFor,
        homeGoalsAgainst,
        awayGoalsFor,
        awayGoalsAgainst,
        totalExpected: totalExpected.toFixed(1),
        homeForm: homeForm.str,
        awayForm: awayForm.str
      }
    };
  },

  // ===================== OVER 2.5 GOALS DEEP ANALYSIS =====================

  analyzeOver25Deep(prediction) {
    if (!prediction) return null;

    const teams = prediction.teams;
    const comp = this.getComparison(prediction);
    const h2h = prediction.h2h || [];
    const leagueId = prediction.league?.id;
    const leagueData = LEAGUES[leagueId];

    const homeGoalsFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const homeGoalsAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayGoalsFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const awayGoalsAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    const avgGoals = (homeGoalsFor + homeGoalsAgainst + awayGoalsFor + awayGoalsAgainst) / 2;
    const totalExpected = homeGoalsFor + awayGoalsFor;

    let score = 0;
    const factors = [];

    // === Factor 1: Average goals per game ===
    if (avgGoals >= 3.5) {
      score += 20;
      factors.push(`Média combinada: ${avgGoals.toFixed(1)} golos/jogo`);
    } else if (avgGoals >= 3.0) {
      score += 16;
      factors.push(`Média combinada: ${avgGoals.toFixed(1)} golos/jogo`);
    } else if (avgGoals >= 2.5) {
      score += 12;
      factors.push(`Média combinada: ${avgGoals.toFixed(1)} golos/jogo`);
    } else if (avgGoals >= 2.0) {
      score += 5;
    } else {
      score -= 8;
      factors.push('⚠ Média de golos muito baixa');
    }

    // === Factor 2: Both teams score well ===
    if (homeGoalsFor >= 1.8 && awayGoalsFor >= 1.5) {
      score += 15;
      factors.push(`Casa: ${homeGoalsFor}/jogo, Fora: ${awayGoalsFor}/jogo`);
    } else if (homeGoalsFor >= 1.5 && awayGoalsFor >= 1.2) {
      score += 12;
      factors.push(`Casa: ${homeGoalsFor}/jogo, Fora: ${awayGoalsFor}/jogo`);
    } else if (homeGoalsFor >= 1.2 && awayGoalsFor >= 1.0) {
      score += 8;
    } else if (homeGoalsFor >= 1.0 || awayGoalsFor >= 1.0) {
      score += 4;
    }

    // === Factor 3: Both defenses leak ===
    if (homeGoalsAgainst >= 1.5 && awayGoalsAgainst >= 1.5) {
      score += 15;
      factors.push(`Ambos sofrem bastante (${homeGoalsAgainst}/${awayGoalsAgainst})`);
    } else if (homeGoalsAgainst >= 1.2 && awayGoalsAgainst >= 1.2) {
      score += 10;
    } else if (homeGoalsAgainst >= 1.0 && awayGoalsAgainst >= 1.0) {
      score += 6;
    } else if (homeGoalsAgainst >= 1.0 || awayGoalsAgainst >= 1.0) {
      score += 3;
    }

    // Penalty: one team barely concedes
    if (homeGoalsAgainst < 0.7 || awayGoalsAgainst < 0.7) {
      score -= 6;
      factors.push('⚠ Uma equipa muito sólida defensivamente');
    }

    // === Factor 4: H2H ===
    if (h2h.length >= 3) {
      const h2hGoals = this.calculateH2HGoals(h2h);
      if (h2hGoals.avgGoals >= 3.5) {
        score += 12;
        factors.push(`H2H alto: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo (${h2hGoals.total} jogos)`);
      } else if (h2hGoals.avgGoals >= 2.5) {
        score += 8;
        factors.push(`H2H: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      } else if (h2hGoals.avgGoals < 2.0) {
        score -= 5;
        factors.push(`⚠ H2H baixo: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      }
    }

    // === Factor 5: Attack comparison ===
    if (comp.homeAtt >= 55 && comp.awayAtt >= 55) {
      score += 10;
      factors.push('Ambos ataques fortes na comparação');
    } else if (comp.homeAtt >= 50 || comp.awayAtt >= 50) {
      score += 5;
    }
    if (comp.homeGoals > 55 || comp.awayGoals > 55) {
      score += 5;
    }

    // === Factor 6: Form ===
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);
    if (homeForm.wins >= 3 && awayForm.wins >= 3) {
      score += 10;
      factors.push('Ambas equipas em boa forma');
    } else if (homeForm.wins >= 3 || awayForm.wins >= 3) {
      score += 5;
    } else if (homeForm.wins >= 2 || awayForm.wins >= 2) {
      score += 3;
    }

    // === Factor 7: League factor ===
    if (leagueData?.bttsRate >= 60) {
      score += 8;
      factors.push(`Liga ofensiva (BTTS ${leagueData.bttsRate}%)`);
    } else if (leagueData?.bttsRate >= 53) {
      score += 4;
    }

    // === Factor 8: Not too one-sided ===
    const totalDiff = Math.abs(comp.homeTotal - comp.awayTotal);
    if (totalDiff < 15) {
      score += 8;
      factors.push('Jogo equilibrado');
    } else if (totalDiff < 25) {
      score += 4;
    } else if (totalDiff > 35) {
      score -= 3;
    }

    // === Factor 9: Learning ===
    let learningFactors = [];
    if (typeof Learning !== 'undefined' && Learning.ready) {
      const adj = Learning.getOver25Adjustment();
      score += adj.delta;
      learningFactors = adj.factors;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < THRESHOLDS.OVER25_DEEP_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.OVER25_DEEP_FIRE ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.OVER25_DEEP_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.OVER25_DEEP_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.OVER25_DEEP.key,
      label: PATTERNS.OVER25_DEEP.label,
      shortLabel: PATTERNS.OVER25_DEEP.shortLabel,
      confidence,
      confidencePercent: score + '%',
      score,
      factors,
      learningFactors,
      estimatedGoals: avgGoals.toFixed(1),
      stats: {
        homeGoalsFor,
        homeGoalsAgainst,
        awayGoalsFor,
        awayGoalsAgainst,
        totalExpected: totalExpected.toFixed(1),
        avgGoals: avgGoals.toFixed(1),
        homeForm: homeForm.str,
        awayForm: awayForm.str,
        totalDiff
      }
    };
  },

  calculateH2HGoals(h2hMatches) {
    const relevant = h2hMatches.slice(0, 6);
    let totalGoals = 0;
    relevant.forEach(m => {
      totalGoals += (m.goals.home || 0) + (m.goals.away || 0);
    });
    return {
      avgGoals: totalGoals / relevant.length,
      total: relevant.length
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
