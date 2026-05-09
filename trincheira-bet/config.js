const CONFIG = {
  API_KEY: '39b7cc96eec7d93794bce93477cfab56',
  API_HOST: 'v3.football.api-sports.io',
  WORKER_URL: 'https://trincheira-live.rodrigo-fcp1997.workers.dev',
  DAILY_LIMIT: 7500,
  CACHE_TTL_FIXTURES: 4 * 60 * 60 * 1000,
  CACHE_TTL_PREDICTIONS: 12 * 60 * 60 * 1000,
  CACHE_TTL_ODDS: 6 * 60 * 60 * 1000,
  CACHE_TTL_PLAYERS: 24 * 60 * 60 * 1000, // Player season stats refresh once per day
  // BTTS-focused leagues: Eredivisie, Austria, Belgium, Switzerland, Norway, Germany, Denmark,
  // 2.Bundesliga, Scotland, Czech, Sweden, Finland, Poland, Japan, Korea, MLS, France, Turkey,
  // Champions League, Europa League
  PRIORITY_LEAGUES: [88, 218, 144, 207, 103, 78, 119, 79, 179, 345, 113, 244, 106, 98, 292, 253, 61, 203, 2, 3]
};
