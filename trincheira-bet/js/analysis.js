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

  detectBTTS(prediction) {
    const teams = prediction.teams;
    const homeForm = this.parseForm(teams?.home?.league?.form);
    const awayForm = this.parseForm(teams?.away?.league?.form);

    // Use goals data
    const homeGoalsFor = teams?.home?.league?.goals?.for?.average?.total || 0;
    const homeGoalsAgainst = teams?.home?.league?.goals?.against?.average?.total || 0;
    const awayGoalsFor = teams?.away?.league?.goals?.for?.average?.total || 0;
    const awayGoalsAgainst = teams?.away?.league?.goals?.against?.average?.total || 0;

    // Both teams score if both attack well and both concede
    const homeScores = parseFloat(homeGoalsFor) > 1.0 || parseFloat(awayGoalsAgainst) > 1.2;
    const awayScores = parseFloat(awayGoalsFor) > 1.0 || parseFloat(homeGoalsAgainst) > 1.2;

    // Calculate BTTS confidence from form and goals
    let score = 0;
    if (homeScores) score += 25;
    if (awayScores) score += 25;
    if (parseFloat(homeGoalsFor) > 1.3) score += 10;
    if (parseFloat(awayGoalsFor) > 1.3) score += 10;
    if (parseFloat(homeGoalsAgainst) > 1.3) score += 10;
    if (parseFloat(awayGoalsAgainst) > 1.3) score += 10;

    // Streak bonus: both teams scoring regularly
    if (homeForm.wins + homeForm.draws >= 3) score += 5;
    if (awayForm.wins + awayForm.draws >= 3) score += 5;

    if (score < THRESHOLDS.BTTS_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.BTTS_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.BTTS_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    return {
      key: PATTERNS.BTTS.key,
      label: PATTERNS.BTTS.label,
      shortLabel: PATTERNS.BTTS.shortLabel,
      confidence,
      confidencePercent: score + '%',
      detail: `Casa marca ~${homeGoalsFor}/jogo, sofre ~${homeGoalsAgainst}. Fora marca ~${awayGoalsFor}/jogo, sofre ~${awayGoalsAgainst}.`
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

    // Check comparison goals %
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

    // Check which team dominates
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

    // Use poisson + goals data to estimate 1st half dominance
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
