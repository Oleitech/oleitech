const App = {
  selectedDate: 0,
  scanning: false,
  scannersReady: false,

  getCacheKey() {
    return 'tb_tips_' + UI.getDateStr(0);
  },

  getCachedTips() {
    try {
      const raw = localStorage.getItem(this.getCacheKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expiresAt && Date.now() > data.expiresAt) {
        localStorage.removeItem(this.getCacheKey());
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },

  saveTipsToCache() {
    const grids = {
      btts: document.getElementById('top-picks-grid'),
      favorites: document.getElementById('favorites-grid'),
      scorers: document.getElementById('scorers-grid'),
    };
    // Don't cache if no tips were generated
    const totalCards = Object.values(grids).reduce((sum, g) => sum + (g ? g.children.length : 0), 0);
    if (totalCards === 0) return;

    const cached = { markets: {}, fixtureCount: 0, expiresAt: 0 };
    Object.entries(grids).forEach(([key, grid]) => {
      cached.markets[key] = grid ? grid.innerHTML : '';
    });
    const statFixtures = document.getElementById('stat-fixtures');
    cached.fixtureCount = statFixtures ? parseInt(statFixtures.textContent) || 0 : 0;
    const now = new Date();
    cached.expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime();
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify(cached));
    } catch (e) {
      console.warn('Failed to save tips cache:', e);
    }
  },

  restoreFromCache(cached) {
    // Check if cache has actual content (not empty grids from failed scan)
    const hasContent = Object.values(cached.markets).some(html => html && html.trim().length > 10);
    if (!hasContent) {
      localStorage.removeItem(this.getCacheKey());
      return;
    }
    Object.entries(cached.markets).forEach(([key, html]) => {
      const gridId = key === 'btts' ? 'top-picks-grid' : key + '-grid';
      const grid = document.getElementById(gridId);
      if (grid && html) grid.innerHTML = html;
    });
    const statFixtures = document.getElementById('stat-fixtures');
    if (statFixtures && cached.fixtureCount) statFixtures.textContent = cached.fixtureCount;
    this.updateCounts();
    this.setButtonAnalyzed();
  },

  setButtonAnalyzed() {
    const btn = document.getElementById('btn-scan-all');
    if (btn) {
      btn.innerHTML = Layout.icon('bolt') + ' Analisado';
      btn.classList.remove('btn--primary');
      btn.classList.add('btn--ghost');
      btn.style.borderColor = 'var(--green)';
      btn.style.color = 'var(--green)';
      btn.disabled = false;
    }
    const title = document.querySelector('.scanner-title');
    if (title) {
      title.innerHTML = '<span class="pulse" style="background:var(--green)"></span> Análise completa &middot; BTTS + Favoritos + Marcadores';
    }
  },

  purgeOldTipsCache() {
    const todayKey = this.getCacheKey();
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tb_tips_') && key !== todayKey) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  },

  async init() {
    try {
      console.log('[TB] Initializing...');
      const { bankroll, totalPL } = await Layout.loadBankrollData();
      const main = Layout.init('tips', bankroll, totalPL);
      if (!main) { console.error('[TB] Layout.init failed'); return; }

      this.buildTipsPage(main);
      this.attachScanButton();

      Cache.purge();
      this.purgeOldTipsCache();

      await Learning.init();
      console.log('[TB] Learning ready');

      // Init BTTS scanner
      try { Picks.init(); } catch(e) { console.warn('[TB] Picks.init:', e); }
      try { TopPicks.init(); } catch(e) { console.warn('[TB] TopPicks.init:', e); }
      try { Favorites1x2.init(); } catch(e) { console.warn('[TB] Favorites1x2.init:', e); }
      try { Scorers.init(); } catch(e) { console.warn('[TB] Scorers.init:', e); }

      this.scannersReady = true;
      console.log('[TB] Scanners ready');

      // Restore cached tips if available
      const cached = this.getCachedTips();
      if (cached) {
        console.log('[TB] Restoring from cache');
        this.restoreFromCache(cached);
      } else {
        console.log('[TB] No cache — waiting for user to click Scan');
      }
    } catch (e) {
      console.error('[TB] Init failed:', e);
    }
  },

  // Attach scan button separately to guarantee it works
  attachScanButton() {
    const btn = document.getElementById('btn-scan-all');
    if (!btn) { console.error('[TB] btn-scan-all not found!'); return; }
    btn.addEventListener('click', async () => {
      console.log('[TB] Scan button clicked, scanning:', this.scanning, 'ready:', this.scannersReady);
      if (this.scanning) return;
      if (!this.scannersReady) {
        console.warn('[TB] Scanners not ready yet');
        return;
      }
      await this.runScan();
    });
    console.log('[TB] Scan button attached');
  },

  buildTipsPage(main) {
    const today = new Date();
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dateStr = `${dayNames[today.getDay()]}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    main.innerHTML += `
      <header class="topbar">
        <div>
          <h1>Tips de hoje</h1>
          <div class="subtitle" id="tips-subtitle">${dateStr}</div>
        </div>
        <div class="topbar-actions">
          <button class="btn btn--primary" id="btn-scan-all">
            ${Layout.icon('bolt')} Scan hoje
          </button>
        </div>
      </header>

      <div class="scanner" id="scanner-card">
        <div class="scanner-row">
          <div style="width:100%">
            <div class="scanner-title">
              <span class="pulse"></span>
              Scanner pronto &middot; BTTS + Favoritos 1X2 + Marcadores
            </div>
            <div class="scanner-stats" style="margin-top:8px">
              <span><span class="k">Jogos analisados</span><span class="v num" id="stat-fixtures">—</span></span>
              <span><span class="k">Tips geradas</span><span class="v num" id="stat-tips">0</span></span>
            </div>
            <div id="scan-progress-wrap" style="display:none;margin-top:12px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-2)" id="scan-progress-text">A iniciar...</span>
              </div>
              <div style="height:4px;background:var(--bg-inset);border-radius:2px;overflow:hidden">
                <div id="scan-progress-fill" style="height:100%;background:var(--accent);border-radius:2px;width:0%;transition:width 0.3s ease"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="section-btts">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-btts)"></span> Ambas marcam (BTTS) <span class="badge" id="badge-btts">0</span></div>
        </div>
        <div class="tips-grid" id="top-picks-grid"></div>
      </section>

      <section id="section-favorites" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--accent)"></span> Favoritos 1X2 (odds 1.55–2.00) <span class="badge" id="badge-favorites">0</span></div>
        </div>
        <div class="tips-grid" id="favorites-grid"></div>
      </section>

      <section id="section-scorers" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--amber)"></span> Marcadores (Anytime Scorer) <span class="badge" id="badge-scorers">0</span></div>
        </div>
        <div class="tips-grid" id="scorers-grid"></div>
      </section>
    `;

  },

  updateCounts() {
    const buckets = [
      { gridId: 'top-picks-grid', badgeId: 'badge-btts', sectionId: 'section-btts' },
      { gridId: 'favorites-grid', badgeId: 'badge-favorites', sectionId: 'section-favorites' },
      { gridId: 'scorers-grid', badgeId: 'badge-scorers', sectionId: 'section-scorers' },
    ];
    let total = 0;
    for (const b of buckets) {
      const grid = document.getElementById(b.gridId);
      const n = grid ? grid.children.length : 0;
      total += n;
      const badge = document.getElementById(b.badgeId);
      if (badge) badge.textContent = n;
      const section = document.getElementById(b.sectionId);
      if (section) section.style.display = n > 0 ? '' : 'none';
    }
    const statTips = document.getElementById('stat-tips');
    if (statTips) statTips.textContent = total;
  },

  updateScanProgress(text, pct) {
    const textEl = document.getElementById('scan-progress-text');
    const fillEl = document.getElementById('scan-progress-fill');
    if (textEl) textEl.textContent = text;
    if (fillEl && pct != null) fillEl.style.width = pct + '%';
  },

  async runScan() {
    this.scanning = true;
    console.log('[TB] runScan started');

    const btn = document.getElementById('btn-scan-all');
    if (btn) {
      btn.innerHTML = Layout.icon('refresh') + ' A analisar...';
      btn.classList.add('btn--primary');
      btn.classList.remove('btn--ghost');
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.disabled = true;
    }

    // Show progress
    const progressWrap = document.getElementById('scan-progress-wrap');
    if (progressWrap) progressWrap.style.display = '';
    this.updateScanProgress('A carregar jogos...', 5);

    try {
      // Step 1: Load fixtures
      const dateStr = UI.getDateStr(0);
      await Fixtures.load(dateStr);

      const fixtures = Fixtures.fixturesData;
      const statFixtures = document.getElementById('stat-fixtures');
      if (statFixtures) statFixtures.textContent = fixtures ? fixtures.length : 0;

      if (!fixtures || fixtures.length === 0) {
        this.updateScanProgress('Sem jogos disponíveis hoje', 100);
        this.scanning = false;
        if (btn) { btn.innerHTML = Layout.icon('bolt') + ' Scan hoje'; btn.disabled = false; }
        return;
      }

      console.log('[TB] Fixtures loaded:', fixtures.length);

      // Step 2: BTTS
      this.updateScanProgress('A analisar BTTS...', 10);
      const bttsFixtures = TopPicks.getBTTSFixtures(fixtures);
      console.log('[TB] BTTS fixtures:', bttsFixtures.length);
      if (bttsFixtures.length > 0) {
        const grid = document.getElementById('top-picks-grid');
        if (grid) grid.innerHTML = '';
        TopPicks.analyzed = [];
        TopPicks.isAnalyzing = false;
        await TopPicks.analyze(bttsFixtures);
      }
      this.updateCounts();
      this.updateScanProgress('BTTS completo', 40);

      // Step 3: Favoritos 1X2
      this.updateScanProgress('A analisar Favoritos 1X2...', 45);
      Favorites1x2.analyzed = [];
      Favorites1x2.isAnalyzing = false;
      await Favorites1x2.analyze(fixtures);
      this.updateCounts();
      this.updateScanProgress('Favoritos completo', 70);

      // Step 4: Marcadores (only top-5 + PT/NL/BE)
      this.updateScanProgress('A analisar Marcadores...', 75);
      Scorers.analyzed = [];
      Scorers.isAnalyzing = false;
      await Scorers.analyze(fixtures);
      this.updateCounts();
      this.updateScanProgress('Marcadores completo', 90);

      // Step 6: Save pre-match data for live engine
      this.savePreMatchDataForLive();

      // Step 7: Finalize
      this.updateScanProgress('Completo!', 100);
      this.updateCounts();
      this.saveTipsToCache();
      this.setButtonAnalyzed();
      console.log('[TB] Scan complete');

      // Hide progress after a moment
      setTimeout(() => {
        if (progressWrap) progressWrap.style.display = 'none';
      }, 1500);

    } catch (e) {
      console.error('[TB] Scan failed:', e);
      this.updateScanProgress('Erro: ' + e.message, 0);
      if (btn) { btn.innerHTML = Layout.icon('bolt') + ' Scan hoje'; btn.disabled = false; }
    }

    this.scanning = false;
  },

  /** Save pre-match analysis data for the live engine to use */
  savePreMatchDataForLive() {
    const map = {};

    // BTTS scores
    if (TopPicks.analyzed && TopPicks.analyzed.length) {
      TopPicks.analyzed.forEach(r => {
        const fid = r.fixture.fixture.id;
        if (!map[fid]) map[fid] = {};
        map[fid].bttsScore = r.btts?.score || 0;
      });
    }

    if (Object.keys(map).length > 0) {
      // Expire at end of today
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const ttl = midnight - now;
      Cache.set('prematch_live', map, ttl);
      console.log('[TB] Pre-match data saved for live engine:', Object.keys(map).length, 'fixtures');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
