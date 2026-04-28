// ===================== BANKROLL MANAGEMENT =====================
// Stake recommendations based on confidence level
// Base stake: €10 (configurable)

const Bankroll = {
  bankroll: 159.01,  // Total available bankroll in €
  maxExposure: 0.75, // Max % of bankroll to risk per day (75%)

  // Base stake = 2% of bankroll (industry standard 1-3%)
  get baseStake() {
    return Math.round(this.bankroll * 0.02);
  },

  // Returns stake recommendation based on score/confidence
  getStake(score, thresholds) {
    const { FIRE, HIGH, MEDIUM } = thresholds;

    if (score >= FIRE + 10) {
      // Very rare, extremely high confidence
      return { multiplier: 3, label: '3x', level: 'max', emoji: '&#128176;' };
    }
    if (score >= FIRE) {
      return { multiplier: 2, label: '2x', level: 'high', emoji: '&#128293;' };
    }
    if (score >= HIGH) {
      return { multiplier: 1.5, label: '1.5x', level: 'medium-high', emoji: '&#11088;' };
    }
    if (score >= MEDIUM + 5) {
      return { multiplier: 1, label: '1x', level: 'medium', emoji: '&#9898;' };
    }
    // Just above threshold — conservative
    return { multiplier: 0.5, label: '0.5x', level: 'low', emoji: '&#9899;' };
  },

  // Get BTTS stake
  getBTTSStake(score) {
    return this.getStake(score, {
      FIRE: THRESHOLDS.BTTS_FIRE,
      HIGH: THRESHOLDS.BTTS_HIGH,
      MEDIUM: THRESHOLDS.BTTS_MEDIUM
    });
  },

  // Get Corners stake
  getCornersStake(score) {
    return this.getStake(score, {
      FIRE: THRESHOLDS.CORNERS_FIRE,
      HIGH: THRESHOLDS.CORNERS_HIGH,
      MEDIUM: THRESHOLDS.CORNERS_MEDIUM
    });
  },

  // Get Cards stake
  getCardsStake(score) {
    return this.getStake(score, {
      FIRE: THRESHOLDS.CARDS_FIRE,
      HIGH: THRESHOLDS.CARDS_HIGH,
      MEDIUM: THRESHOLDS.CARDS_MEDIUM
    });
  },

  // Get Over 2.5 stake
  getOver25Stake(score) {
    return this.getStake(score, {
      FIRE: THRESHOLDS.OVER25_DEEP_FIRE,
      HIGH: THRESHOLDS.OVER25_DEEP_HIGH,
      MEDIUM: THRESHOLDS.OVER25_DEEP_MEDIUM
    });
  },

  // Render the stake badge HTML
  renderBadge(stake) {
    const amount = (stake.multiplier * this.baseStake).toFixed(0);
    const colorMap = {
      'max': 'var(--green)',
      'high': 'var(--amber)',
      'medium-high': 'var(--blue)',
      'medium': 'var(--text-secondary)',
      'low': 'var(--text-muted)'
    };
    const bgMap = {
      'max': 'var(--green-dim)',
      'high': 'var(--amber-dim)',
      'medium-high': 'var(--blue-dim)',
      'medium': 'var(--bg-elevated)',
      'low': 'var(--bg-elevated)'
    };
    const color = colorMap[stake.level] || 'var(--text-secondary)';
    const bg = bgMap[stake.level] || 'var(--bg-elevated)';

    return `
      <div class="stake-badge" style="background:${bg};color:${color}">
        <span class="stake-badge__emoji">${stake.emoji}</span>
        <span class="stake-badge__label">Stake ${stake.label}</span>
        <span class="stake-badge__amount">${amount}&euro;</span>
      </div>
    `;
  },

  // Get max daily budget
  getMaxDaily() {
    return Math.round(this.bankroll * this.maxExposure);
  },

  // Update bankroll (call after daily P/L)
  updateBankroll(newAmount) {
    this.bankroll = newAmount;
  }
};
