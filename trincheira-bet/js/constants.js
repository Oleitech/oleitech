const LEAGUES = {
  // Portugal
  94: { name: 'Liga Portugal', country: 'Portugal', flag: 'PT', priority: 1 },
  96: { name: 'Liga Portugal 2', country: 'Portugal', flag: 'PT', priority: 3 },
  // England
  39: { name: 'Premier League', country: 'England', flag: 'GB', priority: 1 },
  40: { name: 'Championship', country: 'England', flag: 'GB', priority: 3 },
  // Spain
  140: { name: 'La Liga', country: 'Spain', flag: 'ES', priority: 1 },
  // Italy
  135: { name: 'Serie A', country: 'Italy', flag: 'IT', priority: 1 },
  // Germany
  78: { name: 'Bundesliga', country: 'Germany', flag: 'DE', priority: 1 },
  79: { name: '2. Bundesliga', country: 'Germany', flag: 'DE', priority: 3 },
  // France
  61: { name: 'Ligue 1', country: 'France', flag: 'FR', priority: 1 },
  // Europe
  2: { name: 'Champions League', country: 'Europe', flag: 'EU', priority: 1 },
  3: { name: 'Europa League', country: 'Europe', flag: 'EU', priority: 1 },
  848: { name: 'Conference League', country: 'Europe', flag: 'EU', priority: 2 },
  // Netherlands
  88: { name: 'Eredivisie', country: 'Netherlands', flag: 'NL', priority: 2 },
  // Belgium
  144: { name: 'Pro League', country: 'Belgium', flag: 'BE', priority: 2 },
  // Turkey
  203: { name: 'Süper Lig', country: 'Turkey', flag: 'TR', priority: 2 },
  // Scotland
  179: { name: 'Premiership', country: 'Scotland', flag: 'GB', priority: 3 },
  // Austria
  218: { name: 'Bundesliga', country: 'Austria', flag: 'AT', priority: 3 },
  // Switzerland
  207: { name: 'Super League', country: 'Switzerland', flag: 'CH', priority: 3 },
  // Norway
  103: { name: 'Eliteserien', country: 'Norway', flag: 'NO', priority: 3 },
  // Sweden
  113: { name: 'Allsvenskan', country: 'Sweden', flag: 'SE', priority: 3 },
  // Denmark
  119: { name: 'Superliga', country: 'Denmark', flag: 'DK', priority: 3 },
  // Brazil
  71: { name: 'Brasileirão', country: 'Brazil', flag: 'BR', priority: 2 },
  // Ireland
  106: { name: 'Premier Division', country: 'Ireland', flag: 'IE', priority: 3 },
  // Finland
  244: { name: 'Veikkausliiga', country: 'Finland', flag: 'FI', priority: 3 },
  // Greece
  197: { name: 'Super League', country: 'Greece', flag: 'GR', priority: 3 },
};

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
  BTTS_HIGH: 70,
  BTTS_MEDIUM: 55,
  OVER25_HIGH: 65,
  OVER25_MEDIUM: 50,
  FORM_STRONG: 4,         // 4+ wins in last 5
  FORM_GOOD: 3,           // 3 wins in last 5
  HOME_DOMINANCE: 65,     // comparison % for home
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
