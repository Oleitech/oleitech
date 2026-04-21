/**
 * LiveAPI — Fetch layer for Cloudflare Worker endpoints.
 * Handles polling, local cache fallback, and error resilience.
 */
const LiveAPI = {
  pollTimer: null,
  consecutiveErrors: 0,
  MAX_ERRORS_BEFORE_TOAST: 3,
  LOCAL_CACHE_TTL: 20000, // 20s local fallback

  get workerURL() {
    return CONFIG.WORKER_URL;
  },

  async _fetch(path) {
    const url = this.workerURL + path;
    const cacheKey = 'live_' + path.replace(/[^a-z0-9]/gi, '_');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      this.consecutiveErrors = 0;

      // Cache locally as fallback
      Cache.set(cacheKey, data, this.LOCAL_CACHE_TTL);

      return data;
    } catch (err) {
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= this.MAX_ERRORS_BEFORE_TOAST) {
        UI.showToast('Erro na conexão live', 'error');
        this.consecutiveErrors = 0; // reset to avoid spam
      }

      // Return local cache if available
      const cached = Cache.get(cacheKey);
      if (cached) return cached;

      return null;
    }
  },

  /** Get all live matches */
  async fetchLiveMatches() {
    const data = await this._fetch('/live');
    return data?.response || [];
  },

  /** Get live statistics for a fixture */
  async fetchStats(fixtureId) {
    const data = await this._fetch(`/live/stats/${fixtureId}`);
    return data?.response || null;
  },

  /** Get live events (goals, cards, subs) for a fixture */
  async fetchEvents(fixtureId) {
    const data = await this._fetch(`/live/events/${fixtureId}`);
    return data?.response || null;
  },

  /** Get live odds for a fixture */
  async fetchOdds(fixtureId) {
    const data = await this._fetch(`/live/odds/${fixtureId}`);
    return data?.response || null;
  },

  /** Batch fetch fixtures by IDs (max 20) */
  async fetchBatch(fixtureIds) {
    if (!fixtureIds.length) return [];
    const ids = fixtureIds.slice(0, 20).join('-');
    const data = await this._fetch(`/live/batch?ids=${ids}`);
    return data?.response || [];
  },

  /** Start auto-polling at configured interval */
  startPolling(callback) {
    this.stopPolling();
    // Run immediately
    callback();
    this.pollTimer = setInterval(callback, LIVE_THRESHOLDS.POLL_INTERVAL);
  },

  /** Stop auto-polling */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  /** Check if polling is active */
  isPolling() {
    return this.pollTimer !== null;
  }
};
