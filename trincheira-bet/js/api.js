const API = {
  BASE: 'https://v3.football.api-sports.io',

  async fetch(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const cacheKey = `${endpoint}_${qs}`;

    // Check cache first
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    // Check rate limit
    const remaining = Cache.getRemainingRequests();
    if (remaining <= 0) {
      UI.showToast('Limite diário de requests atingido (100/dia)', 'error');
      return null;
    }

    try {
      const url = `${this.BASE}/${endpoint}?${qs}`;
      const res = await fetch(url, {
        headers: { 'x-apisports-key': CONFIG.API_KEY }
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      Cache.incrementRequestCount();
      UI.updateRequestCounter();

      // Determine TTL based on endpoint
      let ttl = CONFIG.CACHE_TTL_FIXTURES;
      if (endpoint === 'predictions') ttl = CONFIG.CACHE_TTL_PREDICTIONS;
      if (endpoint === 'odds') ttl = CONFIG.CACHE_TTL_ODDS;
      if (endpoint === 'players') ttl = CONFIG.CACHE_TTL_PLAYERS;

      // Cache the response
      if (json.response && json.response.length > 0) {
        Cache.set(cacheKey, json.response, ttl);
      }

      return json.response || [];
    } catch (err) {
      console.error('API fetch error:', err);
      UI.showToast('Erro ao conectar à API', 'error');
      return null;
    }
  },

  async getFixtures(date) {
    return this.fetch('fixtures', { date });
  },

  async getPrediction(fixtureId) {
    return this.fetch('predictions', { fixture: fixtureId });
  },

  async getOdds(fixtureId) {
    return this.fetch('odds', { fixture: fixtureId });
  },

  async getH2H(team1Id, team2Id, last = 10) {
    return this.fetch('fixtures/headtohead', { h2h: `${team1Id}-${team2Id}`, last });
  },

  // Players + season stats. Cached aggressively (changes only after each match day).
  async getPlayers(teamId, season) {
    return this.fetch('players', { team: teamId, season });
  }
};
