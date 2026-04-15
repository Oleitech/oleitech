// ===================== BTTS-FOCUSED LEAGUES =====================
// Ranked by historical BTTS percentage (both teams score)
// Priority 1 = Top BTTS leagues (60%+), Priority 2 = Strong (54-60%), Priority 3 = Solid (50-55%)

const LEAGUES = {
  // === TIER 1: Elite BTTS Leagues (60%+) ===
  // bttsRate = historical BTTS %, avgCorners = average corners per game (2024/25 data)
  88:  { name: 'Eredivisie', country: 'Netherlands', flag: 'NL', priority: 1, bttsRate: 65, avgCorners: 11.2 },
  218: { name: 'Bundesliga', country: 'Austria', flag: 'AT', priority: 1, bttsRate: 62, avgCorners: 9.6 },
  144: { name: 'Pro League', country: 'Belgium', flag: 'BE', priority: 1, bttsRate: 61, avgCorners: 10.4 },
  207: { name: 'Super League', country: 'Switzerland', flag: 'CH', priority: 1, bttsRate: 60, avgCorners: 10.1 },
  103: { name: 'Eliteserien', country: 'Norway', flag: 'NO', priority: 1, bttsRate: 60, avgCorners: 9.5 },
  78:  { name: 'Bundesliga', country: 'Germany', flag: 'DE', priority: 1, bttsRate: 60, avgCorners: 9.5 },
  119: { name: 'Superliga', country: 'Denmark', flag: 'DK', priority: 1, bttsRate: 59, avgCorners: 9.4 },
  164: { name: 'Úrvalsdeild', country: 'Iceland', flag: 'IS', priority: 1, bttsRate: 78, avgCorners: 9.2 },
  262: { name: 'Liga MX', country: 'Mexico', flag: 'MX', priority: 1, bttsRate: 66, avgCorners: 9.8 },
  80:  { name: '3. Liga', country: 'Germany', flag: 'DE', priority: 1, bttsRate: 66, avgCorners: 9.4 },
  307: { name: 'Pro League', country: 'Saudi Arabia', flag: 'SA', priority: 1, bttsRate: 64, avgCorners: 9.2 },
  114: { name: 'Superettan', country: 'Sweden', flag: 'SE', priority: 1, bttsRate: 64, avgCorners: 9.0 },
  104: { name: '1. Division', country: 'Norway', flag: 'NO', priority: 1, bttsRate: 62, avgCorners: 9.0 },
  245: { name: 'Ykkönen', country: 'Finland', flag: 'FI', priority: 1, bttsRate: 64, avgCorners: 8.8 },

  // === TIER 2: Very Strong BTTS Leagues (54-60%) ===
  79:  { name: '2. Bundesliga', country: 'Germany', flag: 'DE', priority: 2, bttsRate: 57, avgCorners: 9.3 },
  179: { name: 'Premiership', country: 'Scotland', flag: 'GB', priority: 2, bttsRate: 57, avgCorners: 10.2 },
  345: { name: 'First League', country: 'Czech Republic', flag: 'CZ', priority: 2, bttsRate: 57, avgCorners: 9.3 },
  113: { name: 'Allsvenskan', country: 'Sweden', flag: 'SE', priority: 2, bttsRate: 57, avgCorners: 9.4 },
  244: { name: 'Veikkausliiga', country: 'Finland', flag: 'FI', priority: 2, bttsRate: 56, avgCorners: 9.2 },
  106: { name: 'Ekstraklasa', country: 'Poland', flag: 'PL', priority: 2, bttsRate: 56, avgCorners: 9.5 },
  98:  { name: 'J1 League', country: 'Japan', flag: 'JP', priority: 2, bttsRate: 56, avgCorners: 9.6 },
  292: { name: 'K League 1', country: 'South Korea', flag: 'KR', priority: 2, bttsRate: 55, avgCorners: 9.4 },
  253: { name: 'MLS', country: 'USA', flag: 'US', priority: 2, bttsRate: 55, avgCorners: 9.5 },
  61:  { name: 'Ligue 1', country: 'France', flag: 'FR', priority: 2, bttsRate: 54, avgCorners: 9.0 },
  203: { name: 'Süper Lig', country: 'Turkey', flag: 'TR', priority: 2, bttsRate: 54, avgCorners: 9.8 },

  // === TIER 3: Solid BTTS Leagues (50-55%) ===
  39:  { name: 'Premier League', country: 'England', flag: 'GB', priority: 3, bttsRate: 53, avgCorners: 9.2 },
  188: { name: 'A-League', country: 'Australia', flag: 'AU', priority: 3, bttsRate: 54, avgCorners: 10.2 },
  318: { name: 'First Division', country: 'Cyprus', flag: 'CY', priority: 3, bttsRate: 54, avgCorners: 9.3 },
  172: { name: 'First League', country: 'Bulgaria', flag: 'BG', priority: 3, bttsRate: 53, avgCorners: 9.1 },
  210: { name: 'HNL', country: 'Croatia', flag: 'HR', priority: 3, bttsRate: 52, avgCorners: 9.1 },
  94:  { name: 'Liga Portugal', country: 'Portugal', flag: 'PT', priority: 3, bttsRate: 52, avgCorners: 9.4 },
  135: { name: 'Serie A', country: 'Italy', flag: 'IT', priority: 3, bttsRate: 52, avgCorners: 8.7 },
  140: { name: 'La Liga', country: 'Spain', flag: 'ES', priority: 3, bttsRate: 51, avgCorners: 9.7 },
  71:  { name: 'Brasileirão', country: 'Brazil', flag: 'BR', priority: 3, bttsRate: 51, avgCorners: 9.9 },
  169: { name: 'Super League', country: 'China', flag: 'CN', priority: 3, bttsRate: 52, avgCorners: 9.3 },
  128: { name: 'Primera División', country: 'Argentina', flag: 'AR', priority: 3, bttsRate: 51, avgCorners: 9.2 },
  197: { name: 'Super League', country: 'Greece', flag: 'GR', priority: 3, bttsRate: 51, avgCorners: 9.0 },

  // === European Competitions ===
  2:   { name: 'Champions League', country: 'Europe', flag: 'EU', priority: 2, bttsRate: 55, avgCorners: 10.0 },
  3:   { name: 'Europa League', country: 'Europe', flag: 'EU', priority: 2, bttsRate: 54, avgCorners: 9.6 },
  848: { name: 'Conference League', country: 'Europe', flag: 'EU', priority: 3, bttsRate: 53, avgCorners: 9.4 },

  // === Other leagues (lower BTTS but included for coverage) ===
  40:  { name: 'Championship', country: 'England', flag: 'GB', priority: 4, bttsRate: 50, avgCorners: 10.2 },
  96:  { name: 'Liga Portugal 2', country: 'Portugal', flag: 'PT', priority: 4, bttsRate: 49, avgCorners: 9.1 },
};

// League IDs sorted by BTTS rate for scanning priority
const BTTS_LEAGUE_IDS = Object.entries(LEAGUES)
  .sort((a, b) => b[1].bttsRate - a[1].bttsRate)
  .map(([id]) => parseInt(id));

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
  BTTS_HIGH: 70,
  BTTS_MEDIUM: 55,
  BTTS_MIN_ODDS: 1.40,   // Minimum BTTS odds to show

  // Corners thresholds
  CORNERS_FIRE: 82,
  CORNERS_HIGH: 68,
  CORNERS_MEDIUM: 55,
  CORNERS_MIN_ODDS: 1.40,
  CORNERS_DEFAULT_LINE: 9.5,  // Standard over/under line

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
