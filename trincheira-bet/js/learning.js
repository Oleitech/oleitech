// ===================== LEARNING ENGINE =====================
// Reads historical results and provides score adjustments
// that improve tip accuracy over time.

const Learning = {
  data: [],
  ready: false,

  insights: {
    btts: {
      byBracket: {},
      byLeague: {},
      overallRate: 0,
      totalTips: 0,
      totalDays: 0
    },
    corners: {
      overallRate: 0,
      totalTips: 0
    },
    cards: {
      overallRate: 0,
      totalTips: 0
    },
    over25: {
      overallRate: 0,
      totalTips: 0
    }
  },

  async init() {
    await this.loadData();
    this.computeInsights();
    this.ready = true;
  },

  async loadData() {
    try {
      const res = await fetch('resultados/data/index.json');
      if (!res.ok) return;
      const index = await res.json();

      for (const file of index.files) {
        try {
          const r = await fetch('resultados/data/' + file);
          if (r.ok) this.data.push(await r.json());
        } catch { /* skip */ }
      }
    } catch {
      // Fallback: use History seedData if available
      if (typeof History !== 'undefined' && History.data.length > 0) {
        this.data = [...History.data];
      }
    }
  },

  computeInsights() {
    const brackets = {};
    const leagues = {};
    let totalBtts = 0, greenBtts = 0;

    for (const day of this.data) {
      for (const tip of (day.btts?.tips || [])) {
        totalBtts++;
        if (tip.btts_hit) greenBtts++;

        // Confidence bracket (50-59, 60-69, 70-79, 80-89, 90-100)
        const conf = tip.confidence || 0;
        const bracketMin = Math.floor(conf / 10) * 10;
        const key = `${bracketMin}-${bracketMin + 9}`;
        if (!brackets[key]) brackets[key] = { total: 0, green: 0, rate: 0 };
        brackets[key].total++;
        if (tip.btts_hit) brackets[key].green++;

        // League
        const league = tip.league || 'Unknown';
        if (!leagues[league]) leagues[league] = { total: 0, green: 0, rate: 0 };
        leagues[league].total++;
        if (tip.btts_hit) leagues[league].green++;
      }
    }

    // Calculate rates
    for (const stats of Object.values(brackets)) {
      stats.rate = stats.total > 0 ? Math.round((stats.green / stats.total) * 100) : 0;
    }
    for (const stats of Object.values(leagues)) {
      stats.rate = stats.total > 0 ? Math.round((stats.green / stats.total) * 100) : 0;
    }

    this.insights.btts = {
      byBracket: brackets,
      byLeague: leagues,
      overallRate: totalBtts > 0 ? Math.round((greenBtts / totalBtts) * 100) : 0,
      totalTips: totalBtts,
      totalDays: this.data.length
    };

    // Corners
    let totalCorners = 0, greenCorners = 0;
    for (const day of this.data) {
      for (const tip of (day.corners?.tips || [])) {
        totalCorners++;
        if (tip.hit) greenCorners++;
      }
    }
    this.insights.corners = {
      overallRate: totalCorners > 0 ? Math.round((greenCorners / totalCorners) * 100) : 0,
      totalTips: totalCorners
    };

    // Cards
    let totalCards = 0, greenCards = 0;
    for (const day of this.data) {
      for (const tip of (day.cards?.tips || [])) {
        totalCards++;
        if (tip.hit) greenCards++;
      }
    }
    this.insights.cards = {
      overallRate: totalCards > 0 ? Math.round((greenCards / totalCards) * 100) : 0,
      totalTips: totalCards
    };

    // Over 2.5
    let totalOver25 = 0, greenOver25 = 0;
    for (const day of this.data) {
      for (const tip of (day.over25?.tips || [])) {
        totalOver25++;
        if (tip.hit) greenOver25++;
      }
    }
    this.insights.over25 = {
      overallRate: totalOver25 > 0 ? Math.round((greenOver25 / totalOver25) * 100) : 0,
      totalTips: totalOver25
    };
  },

  // ===================== BTTS ADJUSTMENTS =====================

  // Returns a score adjustment (-5 to +5) based on historical data.
  // Small adjustments that grow as we accumulate more data.
  getBTTSAdjustment(score, leagueName) {
    if (!this.ready || this.insights.btts.totalDays < 2) return { delta: 0, factors: [] };

    let delta = 0;
    const factors = [];
    const days = this.insights.btts.totalDays;

    // Weight: more data = stronger adjustments (capped at 1.0 after 14 days)
    const weight = Math.min(1.0, days / 14);

    // 1. League adjustment — boost/penalize leagues based on actual hit rate
    const leagueStats = this.insights.btts.byLeague[leagueName];
    if (leagueStats && leagueStats.total >= 2) {
      if (leagueStats.rate >= 80) {
        const bonus = Math.round(4 * weight);
        delta += bonus;
        factors.push(`Liga ${leagueName}: ${leagueStats.green}/${leagueStats.total} (${leagueStats.rate}%) historico`);
      } else if (leagueStats.rate <= 33) {
        const penalty = Math.round(-4 * weight);
        delta += penalty;
        factors.push(`\u26A0 Liga ${leagueName}: apenas ${leagueStats.green}/${leagueStats.total} (${leagueStats.rate}%) historico`);
      }
    }

    // 2. Confidence bracket adjustment
    const bracketMin = Math.floor(score / 10) * 10;
    const bracketKey = `${bracketMin}-${bracketMin + 9}`;
    const bracketStats = this.insights.btts.byBracket[bracketKey];
    if (bracketStats && bracketStats.total >= 2) {
      if (bracketStats.rate >= 80) {
        const bonus = Math.round(3 * weight);
        delta += bonus;
        factors.push(`Faixa ${bracketKey}: ${bracketStats.green}/${bracketStats.total} (${bracketStats.rate}%) historico`);
      } else if (bracketStats.rate <= 40) {
        const penalty = Math.round(-3 * weight);
        delta += penalty;
        factors.push(`\u26A0 Faixa ${bracketKey}: apenas ${bracketStats.green}/${bracketStats.total} (${bracketStats.rate}%) historico`);
      }
    }

    // Cap total adjustment
    delta = Math.max(-8, Math.min(8, delta));

    return { delta, factors };
  },

  // Returns risk info for a given BTTS score
  getBTTSRisk(score) {
    if (!this.ready || this.insights.btts.totalDays < 2) return null;

    const bracketMin = Math.floor(score / 10) * 10;
    const bracketKey = `${bracketMin}-${bracketMin + 9}`;
    const stats = this.insights.btts.byBracket[bracketKey];

    if (!stats || stats.total < 2) return null;

    if (stats.rate <= 40) {
      return {
        level: 'high',
        label: `Risco alto \u2014 ${bracketKey} acerta ${stats.rate}% (${stats.green}/${stats.total})`
      };
    }
    if (stats.rate <= 55) {
      return {
        level: 'medium',
        label: `Risco medio \u2014 ${bracketKey} acerta ${stats.rate}% (${stats.green}/${stats.total})`
      };
    }
    if (stats.rate >= 80) {
      return {
        level: 'low',
        label: `Zona forte \u2014 ${bracketKey} acerta ${stats.rate}% (${stats.green}/${stats.total})`
      };
    }

    return null;
  },

  // ===================== CORNERS ADJUSTMENTS =====================

  getCornersAdjustment() {
    if (!this.ready || this.insights.corners.totalTips < 3) return { delta: 0, factors: [] };

    const rate = this.insights.corners.overallRate;
    const factors = [];
    let delta = 0;

    if (rate >= 75) {
      delta = 2;
      factors.push(`Cantos historico: ${rate}% acerto`);
    } else if (rate <= 40) {
      delta = -2;
      factors.push(`\u26A0 Cantos historico: ${rate}% acerto`);
    }

    return { delta, factors };
  },

  // ===================== CARDS ADJUSTMENTS =====================

  getCardsAdjustment() {
    if (!this.ready || this.insights.cards.totalTips < 3) return { delta: 0, factors: [] };

    const rate = this.insights.cards.overallRate;
    const factors = [];
    let delta = 0;

    if (rate >= 75) {
      delta = 2;
      factors.push(`Cartões histórico: ${rate}% acerto`);
    } else if (rate <= 40) {
      delta = -2;
      factors.push(`\u26A0 Cartões histórico: ${rate}% acerto`);
    }

    return { delta, factors };
  },

  // ===================== OVER 2.5 ADJUSTMENTS =====================

  getOver25Adjustment() {
    if (!this.ready || this.insights.over25.totalTips < 3) return { delta: 0, factors: [] };

    const rate = this.insights.over25.overallRate;
    const factors = [];
    let delta = 0;

    if (rate >= 75) {
      delta = 2;
      factors.push(`Over 2.5 histórico: ${rate}% acerto`);
    } else if (rate <= 40) {
      delta = -2;
      factors.push(`\u26A0 Over 2.5 histórico: ${rate}% acerto`);
    }

    return { delta, factors };
  },

  // ===================== UI HELPERS =====================

  // Get a summary line for display in the app header or history
  getSummaryLine() {
    if (!this.ready || this.insights.btts.totalDays === 0) return '';

    const b = this.insights.btts;
    const c = this.insights.corners;
    const cr = this.insights.cards;
    const o25 = this.insights.over25;
    const parts = [`${b.totalDays} dias`];
    if (b.totalTips > 0) parts.push(`BTTS ${b.overallRate}%`);
    if (c.totalTips > 0) parts.push(`Cantos ${c.overallRate}%`);
    if (cr.totalTips > 0) parts.push(`Cartões ${cr.overallRate}%`);
    if (o25.totalTips > 0) parts.push(`O2.5 ${o25.overallRate}%`);
    return parts.join(' \u00B7 ');
  }
};
