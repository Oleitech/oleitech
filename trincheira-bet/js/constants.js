// ===================== BTTS-FOCUSED LEAGUES =====================
// Ranked by historical BTTS percentage (both teams score)
// Priority 1 = Top BTTS leagues (60%+), Priority 2 = Strong (54-60%), Priority 3 = Solid (50-55%)

const LEAGUES = {
  // === TIER 1: Elite BTTS Leagues (60%+) ===
  // bttsRate = historical BTTS %, avgCorners = average corners per game (2024/25 data)
  // avgCards = average yellow+red cards per game (2024/25 data)
  88:  { name: 'Eredivisie', country: 'Netherlands', flag: 'NL', priority: 1, bttsRate: 65, avgCorners: 11.2, avgCards: 4.2 },
  218: { name: 'Bundesliga', country: 'Austria', flag: 'AT', priority: 1, bttsRate: 62, avgCorners: 9.6, avgCards: 4.5 },
  144: { name: 'Pro League', country: 'Belgium', flag: 'BE', priority: 1, bttsRate: 61, avgCorners: 10.4, avgCards: 4.3 },
  207: { name: 'Super League', country: 'Switzerland', flag: 'CH', priority: 1, bttsRate: 60, avgCorners: 10.1, avgCards: 4.1 },
  103: { name: 'Eliteserien', country: 'Norway', flag: 'NO', priority: 1, bttsRate: 60, avgCorners: 9.5, avgCards: 3.8 },
  78:  { name: 'Bundesliga', country: 'Germany', flag: 'DE', priority: 1, bttsRate: 60, avgCorners: 9.5, avgCards: 3.9 },
  119: { name: 'Superliga', country: 'Denmark', flag: 'DK', priority: 1, bttsRate: 59, avgCorners: 9.4, avgCards: 3.7 },
  164: { name: 'Úrvalsdeild', country: 'Iceland', flag: 'IS', priority: 1, bttsRate: 78, avgCorners: 9.2, avgCards: 3.5 },
  262: { name: 'Liga MX', country: 'Mexico', flag: 'MX', priority: 1, bttsRate: 66, avgCorners: 9.8, avgCards: 5.2 },
  80:  { name: '3. Liga', country: 'Germany', flag: 'DE', priority: 1, bttsRate: 66, avgCorners: 9.4, avgCards: 4.0 },
  307: { name: 'Pro League', country: 'Saudi Arabia', flag: 'SA', priority: 1, bttsRate: 64, avgCorners: 9.2, avgCards: 4.8 },
  114: { name: 'Superettan', country: 'Sweden', flag: 'SE', priority: 1, bttsRate: 64, avgCorners: 9.0, avgCards: 3.6 },
  104: { name: '1. Division', country: 'Norway', flag: 'NO', priority: 1, bttsRate: 62, avgCorners: 9.0, avgCards: 3.7 },
  245: { name: 'Ykkönen', country: 'Finland', flag: 'FI', priority: 1, bttsRate: 64, avgCorners: 8.8, avgCards: 3.4 },

  // === TIER 2: Very Strong BTTS Leagues (54-60%) ===
  79:  { name: '2. Bundesliga', country: 'Germany', flag: 'DE', priority: 2, bttsRate: 57, avgCorners: 9.3, avgCards: 4.1 },
  179: { name: 'Premiership', country: 'Scotland', flag: 'GB', priority: 2, bttsRate: 57, avgCorners: 10.2, avgCards: 3.8 },
  345: { name: 'First League', country: 'Czech Republic', flag: 'CZ', priority: 2, bttsRate: 57, avgCorners: 9.3, avgCards: 4.3 },
  113: { name: 'Allsvenskan', country: 'Sweden', flag: 'SE', priority: 2, bttsRate: 57, avgCorners: 9.4, avgCards: 3.6 },
  244: { name: 'Veikkausliiga', country: 'Finland', flag: 'FI', priority: 2, bttsRate: 56, avgCorners: 9.2, avgCards: 3.4 },
  106: { name: 'Ekstraklasa', country: 'Poland', flag: 'PL', priority: 2, bttsRate: 56, avgCorners: 9.5, avgCards: 4.4 },
  98:  { name: 'J1 League', country: 'Japan', flag: 'JP', priority: 2, bttsRate: 56, avgCorners: 9.6, avgCards: 3.3 },
  292: { name: 'K League 1', country: 'South Korea', flag: 'KR', priority: 2, bttsRate: 55, avgCorners: 9.4, avgCards: 3.5 },
  253: { name: 'MLS', country: 'USA', flag: 'US', priority: 2, bttsRate: 55, avgCorners: 9.5, avgCards: 3.8 },
  61:  { name: 'Ligue 1', country: 'France', flag: 'FR', priority: 2, bttsRate: 54, avgCorners: 9.0, avgCards: 4.0 },
  203: { name: 'Süper Lig', country: 'Turkey', flag: 'TR', priority: 2, bttsRate: 54, avgCorners: 9.8, avgCards: 5.4 },
  89:  { name: 'Eerste Divisie', country: 'Netherlands', flag: 'NL', priority: 2, bttsRate: 54, avgCorners: 10.0, avgCards: 4.0 },
  145: { name: 'Challenger Pro League', country: 'Belgium', flag: 'BE', priority: 2, bttsRate: 54, avgCorners: 9.5, avgCards: 4.1 },
  208: { name: 'Challenge League', country: 'Switzerland', flag: 'CH', priority: 2, bttsRate: 56, avgCorners: 9.3, avgCards: 4.0 },
  120: { name: '1. Division', country: 'Denmark', flag: 'DK', priority: 2, bttsRate: 54, avgCorners: 9.1, avgCards: 3.6 },
  239: { name: 'Primera A', country: 'Colombia', flag: 'CO', priority: 2, bttsRate: 54, avgCorners: 9.0, avgCards: 4.9 },

  // === TIER 3: Solid BTTS Leagues (50-55%) ===
  39:  { name: 'Premier League', country: 'England', flag: 'GB', priority: 3, bttsRate: 53, avgCorners: 9.2, avgCards: 3.5 },
  188: { name: 'A-League', country: 'Australia', flag: 'AU', priority: 3, bttsRate: 54, avgCorners: 10.2, avgCards: 4.0 },
  318: { name: 'First Division', country: 'Cyprus', flag: 'CY', priority: 3, bttsRate: 54, avgCorners: 9.3, avgCards: 4.6 },
  172: { name: 'First League', country: 'Bulgaria', flag: 'BG', priority: 3, bttsRate: 53, avgCorners: 9.1, avgCards: 4.3 },
  210: { name: 'HNL', country: 'Croatia', flag: 'HR', priority: 3, bttsRate: 52, avgCorners: 9.1, avgCards: 4.5 },
  94:  { name: 'Liga Portugal', country: 'Portugal', flag: 'PT', priority: 3, bttsRate: 52, avgCorners: 9.4, avgCards: 4.8 },
  135: { name: 'Serie A', country: 'Italy', flag: 'IT', priority: 3, bttsRate: 52, avgCorners: 8.7, avgCards: 4.6 },
  140: { name: 'La Liga', country: 'Spain', flag: 'ES', priority: 3, bttsRate: 51, avgCorners: 9.7, avgCards: 5.0 },
  71:  { name: 'Brasileirão', country: 'Brazil', flag: 'BR', priority: 3, bttsRate: 51, avgCorners: 9.9, avgCards: 4.7 },
  169: { name: 'Super League', country: 'China', flag: 'CN', priority: 3, bttsRate: 52, avgCorners: 9.3, avgCards: 3.8 },
  128: { name: 'Primera División', country: 'Argentina', flag: 'AR', priority: 3, bttsRate: 51, avgCorners: 9.2, avgCards: 5.1 },
  197: { name: 'Super League', country: 'Greece', flag: 'GR', priority: 3, bttsRate: 51, avgCorners: 9.0, avgCards: 4.5 },

  // === European Competitions ===
  2:   { name: 'Champions League', country: 'Europe', flag: 'EU', priority: 2, bttsRate: 55, avgCorners: 10.0, avgCards: 3.8 },
  3:   { name: 'Europa League', country: 'Europe', flag: 'EU', priority: 2, bttsRate: 54, avgCorners: 9.6, avgCards: 4.0 },
  848: { name: 'Conference League', country: 'Europe', flag: 'EU', priority: 3, bttsRate: 53, avgCorners: 9.4, avgCards: 3.9 },

  // === Other leagues (lower BTTS but included for coverage) ===
  40:  { name: 'Championship', country: 'England', flag: 'GB', priority: 4, bttsRate: 50, avgCorners: 10.2, avgCards: 3.6 },
  96:  { name: 'Liga Portugal 2', country: 'Portugal', flag: 'PT', priority: 4, bttsRate: 49, avgCorners: 9.1, avgCards: 4.5 },
};

// League IDs sorted by BTTS rate for scanning priority
const BTTS_LEAGUE_IDS = Object.entries(LEAGUES)
  .sort((a, b) => b[1].bttsRate - a[1].bttsRate)
  .map(([id]) => parseInt(id));

// Pre-game blacklist — leagues to skip in BTTS / Over 2.5 scanners.
// Calibrated from cumulative results 12/04 → 03/05/2026: these leagues had
// ≥0/3 hit rate in recent BTTS+O2.5 weekend rounds (end-of-season fatigue,
// dead games, low-stakes matches). Re-evaluate after 30 days of new data.
const LEAGUE_PREGAME_BLACKLIST = new Set([
  88,  // Eredivisie (Netherlands)
  218, // Bundesliga (Austria)
  144, // Pro League (Belgium)
  80,  // 3. Liga (Germany)
]);

const PATTERNS = {
  BTTS: {
    key: 'btts',
    label: 'Ambas Marcam',
    shortLabel: 'BTTS',
    color: 'green'
  },
  OVER25: {
    key: 'over25',
    label: 'Over 2.5',
    shortLabel: 'O2.5',
    color: 'green'
  },
  HANDICAP: {
    key: 'handicap',
    label: 'Handicap -1',
    shortLabel: 'HC-1',
    color: 'blue'
  },
  FIRST_HALF: {
    key: 'firsthalf',
    label: 'Vitória 1ª Parte',
    shortLabel: 'V1P',
    color: 'purple'
  },
  HOME_WIN: {
    key: 'homewin',
    label: 'Vitória Casa',
    shortLabel: '1',
    color: 'blue'
  },
  AWAY_WIN: {
    key: 'awaywin',
    label: 'Vitória Fora',
    shortLabel: '2',
    color: 'purple'
  },
  DRAW: {
    key: 'draw',
    label: 'Empate',
    shortLabel: 'X',
    color: 'amber'
  },
  CARDS: {
    key: 'cards',
    label: 'Cartões',
    shortLabel: 'CRT',
    color: 'red'
  },
  OVER25_DEEP: {
    key: 'over25deep',
    label: 'Over 2.5',
    shortLabel: 'O2.5',
    color: 'purple'
  }
};

const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const THRESHOLDS = {
  // BTTS thresholds (enhanced)
  BTTS_FIRE: 82,         // 🔥 Top tier
  BTTS_HIGH: 75,
  BTTS_MEDIUM: 70,
  BTTS_MIN_ODDS: 1.40,   // Minimum BTTS odds to show

  // Corners thresholds
  CORNERS_FIRE: 82,
  CORNERS_HIGH: 75,
  CORNERS_MEDIUM: 70,
  CORNERS_MIN_ODDS: 1.40,
  CORNERS_DEFAULT_LINE: 9.5,  // Standard over/under line

  // Cards thresholds
  CARDS_FIRE: 80,
  CARDS_HIGH: 72,
  CARDS_MEDIUM: 65,
  CARDS_MIN_ODDS: 1.40,
  CARDS_DEFAULT_LINE: 3.5,

  // Over 2.5 Goals Deep Scanner thresholds
  OVER25_DEEP_FIRE: 80,
  OVER25_DEEP_HIGH: 72,
  OVER25_DEEP_MEDIUM: 65,
  OVER25_DEEP_MIN_ODDS: 1.40,

  // Other pattern thresholds
  OVER25_HIGH: 65,
  OVER25_MEDIUM: 50,
  FORM_STRONG: 4,
  FORM_GOOD: 3,
  HOME_DOMINANCE: 65,
  GOALS_AVG_HIGH: 3.0,
  GOALS_AVG_MEDIUM: 2.3,
};

const STATUS_MAP = {
  'TBD': 'Por definir',
  'NS': 'Não iniciado',
  '1H': '1ª Parte',
  'HT': 'Intervalo',
  '2H': '2ª Parte',
  'ET': 'Prolongamento',
  'P': 'Penáltis',
  'FT': 'Terminado',
  'AET': 'Após Prolongamento',
  'PEN': 'Após Penáltis',
  'BT': 'Intervalo Extra',
  'SUSP': 'Suspenso',
  'INT': 'Interrompido',
  'PST': 'Adiado',
  'CANC': 'Cancelado',
  'ABD': 'Abandonado',
  'AWD': 'Decisão Técnica',
  'WO': 'W.O.',
  'LIVE': 'Em Jogo'
};

const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

// ===================== LIVE BETTING THRESHOLDS =====================
const LIVE_THRESHOLDS = {
  // Strategy 1: Goals in 0-0 at HT
  GOALS_00_MIN_CONFIDENCE: 65,
  GOALS_00_MIN_SHOTS: 8,
  GOALS_00_MIN_SOT: 4,

  // Strategy 2: Late Corners
  CORNERS_MIN_CONFIDENCE: 60,
  CORNERS_MIN_ELAPSED: 70,
  CORNERS_MAX_GAP: 3,

  // Strategy 3: Red Card Momentum
  RED_CARD_MIN_CONFIDENCE: 60,
  RED_CARD_WINDOW_MIN: 15,

  // Strategy 4: BTTS Completion
  BTTS_COMP_MIN_CONFIDENCE: 65,
  BTTS_COMP_MIN_PREMATCH: 70,

  // Strategy 5: HT Draw Swing
  HT_SWING_MIN_CONFIDENCE: 60,
  HT_SWING_FAVORITE_MAX_ODDS: 1.60,

  // Polling & general
  POLL_INTERVAL: 45000,
  ALERT_EXPIRY_BUFFER: 300000,
  MAX_DETAIL_FETCHES: 10,
};
