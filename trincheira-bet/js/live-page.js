/**
 * LivePage — Page controller for live betting alerts.
 * Handles polling orchestration, rendering, and user interactions.
 */
const LivePage = {
  alerts: [],
  liveFixtures: [],
  statsCache: {},
  eventsCache: {},
  oddsCache: {},
  lastUpdate: null,
  activeFilter: 'all',

  async init() {
    // Load bankroll data
    const { bankroll, totalPL } = await Layout.loadBankrollData();

    // Build layout
    const main = Layout.init('live', bankroll, totalPL);
    if (!main) return;

    // Build page structure
    main.innerHTML += this.buildPageHTML();

    // Wire events
    this.wireEvents();

    // Init learning engine for league data
    if (typeof Learning !== 'undefined' && Learning.init) {
      Learning.init().catch(() => {});
    }

    // First poll
    await this.poll();
  },

  buildPageHTML() {
    return `
      <div class="topbar">
        <div class="topbar-left">
          <h1 class="topbar-title">Apostas Ao Vivo</h1>
        </div>
        <div class="topbar-actions">
          <button class="btn btn--ghost" id="live-refresh-btn">
            ${Layout.icon('refresh', 'icon')}Atualizar
          </button>
        </div>
      </div>

      <div class="live-status" id="live-status">
        <div class="live-status__item">
          <span class="live-status__dot live-status__dot--off" id="live-dot"></span>
          <span id="live-match-count">0 jogos ao vivo</span>
        </div>
        <div class="live-status__item">
          <span id="live-alert-count">0 alertas</span>
        </div>
        <div class="live-status__item">
          <span id="live-last-update">—</span>
        </div>
      </div>

      <div class="filters" id="live-filters">
        <button class="chip is-active" data-filter="all">Todas</button>
        <button class="chip" data-filter="goals">Golos</button>
        <button class="chip" data-filter="corners">Cantos</button>
        <button class="chip" data-filter="redcard">Cartões</button>
        <button class="chip" data-filter="btts">BTTS</button>
        <button class="chip" data-filter="swing">Resultado</button>
      </div>

      <div class="live-alerts" id="live-alerts"></div>

      <div class="live-matches" id="live-matches">
        <div class="live-matches__title">Jogos em Direto</div>
        <div id="live-matches-list"></div>
      </div>
    `;
  },

  wireEvents() {
    // Refresh button
    document.getElementById('live-refresh-btn')?.addEventListener('click', () => this.poll());

    // Filter chips
    document.getElementById('live-filters')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#live-filters .chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      this.activeFilter = chip.dataset.filter;
      this.renderAlerts();
    });

    // Delegate dismiss clicks
    document.getElementById('live-alerts')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.live-alert__dismiss');
      if (!btn) return;
      const alertId = btn.dataset.alertId;
      const alert = this.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.dismissed = true;
        this.renderAlerts();
      }
    });

  },

  async poll() {
    // Visual feedback: dot goes green while fetching
    const dot = document.getElementById('live-dot');
    if (dot) dot.classList.remove('live-status__dot--off');

    try {
      // 1. Fetch all live matches
      this.liveFixtures = await LiveAPI.fetchLiveMatches();

      // 2. Determine which matches need detail fetching
      const toFetch = LiveEngine.getFixturesToFetchDetails(this.liveFixtures);

      // 3. Fetch stats and events for interesting matches
      const fetchPromises = toFetch.map(async (fid) => {
        const [stats, events] = await Promise.all([
          LiveAPI.fetchStats(fid),
          LiveAPI.fetchEvents(fid),
        ]);
        if (stats) this.statsCache[fid] = stats;
        if (events) this.eventsCache[fid] = events;
      });
      await Promise.all(fetchPromises);

      // 4. Run strategy engine
      const incoming = LiveEngine.evaluate(
        this.liveFixtures, this.statsCache, this.eventsCache, this.oddsCache
      );

      // 5. Merge and expire alerts
      this.alerts = LiveEngine.mergeAlerts(this.alerts, incoming);
      this.alerts = LiveEngine.expireAlerts(this.alerts, this.liveFixtures);

      // 6. Notify new alerts
      const newAlerts = incoming.filter(a => a._isNew);
      newAlerts.forEach(a => {
        delete a._isNew;
        this.notifyAlert(a);
      });

      // 7. Update UI
      this.lastUpdate = new Date();
      this.updateStatus();
      this.renderAlerts();
      this.renderMatches();

    } catch (err) {
      console.error('[Live] Poll error:', err);
    } finally {
      // Dot back to off after fetch
      if (dot) setTimeout(() => dot.classList.add('live-status__dot--off'), 1500);
    }
  },

  updateStatus() {
    const countEl = document.getElementById('live-match-count');
    const alertEl = document.getElementById('live-alert-count');
    const timeEl = document.getElementById('live-last-update');

    const activeAlerts = this.alerts.filter(a => !a.dismissed && !a.expired);

    if (countEl) countEl.textContent = `${this.liveFixtures.length} jogos ao vivo`;
    if (alertEl) alertEl.textContent = `${activeAlerts.length} alertas`;
    if (timeEl && this.lastUpdate) {
      timeEl.textContent = `Atualiz.: ${this.lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  },

  renderAlerts() {
    const container = document.getElementById('live-alerts');
    if (!container) return;

    let alerts = this.alerts.filter(a => !a.dismissed && !a.expired);

    // Apply filter
    if (this.activeFilter !== 'all') {
      alerts = alerts.filter(a => a.strategy === this.activeFilter);
    }

    // Sort by confidence (highest first)
    alerts.sort((a, b) => b.confidence - a.confidence);

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="live-empty">
          <div class="live-empty__icon">&#9917;</div>
          <div class="live-empty__text">Sem alertas no momento</div>
          <div class="live-empty__sub">${this.liveFixtures.length > 0
            ? 'A monitorizar ' + this.liveFixtures.length + ' jogos — alertas aparecem quando as condições são detetadas'
            : 'Sem jogos ao vivo de momento. Os alertas aparecem automaticamente.'
          }</div>
        </div>
      `;
      return;
    }

    container.innerHTML = alerts.map(a => this.renderAlertCard(a)).join('');
  },

  renderAlertCard(alert) {
    const f = alert.fixture;
    const elapsed = f.fixture.status.elapsed || 0;
    const status = STATUS_MAP[f.fixture.status.short] || f.fixture.status.short;
    const isNew = (Date.now() - alert.timestamp) < 60000;

    const strategyLabels = {
      goals: 'Golos 0-0',
      corners: 'Cantos Tardios',
      redcard: 'Cartão Vermelho',
      btts: 'BTTS Live',
      swing: 'Favorito 2H',
    };

    const homeGoals = f.goals.home ?? 0;
    const awayGoals = f.goals.away ?? 0;

    return `
      <article class="live-alert live-alert--${alert.strategy} ${isNew ? 'live-alert--new' : ''}">
        <div class="live-alert__header">
          <span class="live-alert__strategy live-alert__strategy--${alert.strategy}">
            ${strategyLabels[alert.strategy] || alert.strategy}
          </span>
          <span class="live-alert__elapsed">
            <span class="pulse-dot"></span>
            ${elapsed}'
          </span>
        </div>

        <div class="live-alert__match">
          <span class="live-alert__team">${f.teams.home.name}</span>
          <span class="live-alert__score">${homeGoals} - ${awayGoals}</span>
          <span class="live-alert__team">${f.teams.away.name}</span>
        </div>

        <div class="live-alert__market">
          <span class="live-alert__market-label">${alert.market}</span>
          <span class="live-alert__market-pick">${alert.pick}</span>
        </div>

        <ul class="live-alert__factors">
          ${alert.factors.map(f => `<li>${f}</li>`).join('')}
        </ul>

        <div class="live-alert__footer">
          <div class="live-alert__conf">
            ${Layout.renderConfRing(alert.confidence, 36)}
            <span style="font-size:12px;color:var(--text-3)">Confiança</span>
          </div>
          <button class="live-alert__dismiss" data-alert-id="${alert.id}">Dispensar</button>
        </div>
      </article>
    `;
  },

  renderMatches() {
    const container = document.getElementById('live-matches-list');
    if (!container) return;

    if (this.liveFixtures.length === 0) {
      container.innerHTML = `
        <div class="live-empty">
          <div class="live-empty__text">Sem jogos ao vivo</div>
          <div class="live-empty__sub">Os jogos aparecem automaticamente quando iniciam.</div>
        </div>
      `;
      return;
    }

    // Group by league
    const groups = {};
    this.liveFixtures.forEach(f => {
      const lid = f.league.id;
      if (!groups[lid]) groups[lid] = { league: f.league, matches: [] };
      groups[lid].matches.push(f);
    });

    const alertedIds = new Set(
      this.alerts.filter(a => !a.dismissed && !a.expired).map(a => a.fixtureId)
    );

    let html = '';
    Object.values(groups).forEach(group => {
      group.matches.forEach(f => {
        const isAlerted = alertedIds.has(f.fixture.id);
        const elapsed = f.fixture.status.elapsed || '';
        const status = f.fixture.status.short;
        const flag = LEAGUES[f.league.id]?.flag || '⚽';
        const homeGoals = f.goals.home ?? 0;
        const awayGoals = f.goals.away ?? 0;

        html += `
          <div class="live-match-row ${isAlerted ? 'live-match-row--alerted' : ''}">
            <span class="live-match-row__flag">${flag}</span>
            <span class="live-match-row__teams">${f.teams.home.name} vs ${f.teams.away.name}</span>
            <span class="live-match-row__score">${homeGoals} - ${awayGoals}</span>
            <span class="live-match-row__status">${elapsed ? elapsed + "'" : STATUS_MAP[status] || status}</span>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  },

  notifyAlert(alert) {
    const strategyLabels = {
      goals: 'Golos', corners: 'Cantos', redcard: 'Cartão Vermelho',
      btts: 'BTTS', swing: 'Favorito',
    };
    const label = strategyLabels[alert.strategy] || alert.strategy;
    const home = alert.fixture.teams.home.name;
    const away = alert.fixture.teams.away.name;

    // Toast notification
    UI.showToast(`${label}: ${home} vs ${away} — ${alert.market}`, 'success');

    // Browser notification (if permitted)
    if (Notification.permission === 'granted') {
      new Notification(`Trincheira Live — ${label}`, {
        body: `${home} vs ${away}\n${alert.market}: ${alert.pick}`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚽</text></svg>',
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  LivePage.init();
});
