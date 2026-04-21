const App = {
  selectedDate: 0,
  activeMarketFilter: 'all',
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
      over25: document.getElementById('over25-grid'),
      cards: document.getElementById('cards-grid'),
      corners: document.getElementById('corners-grid'),
    };
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
    Object.entries(cached.markets).forEach(([key, html]) => {
      const grid = document.getElementById(key === 'btts' ? 'top-picks-grid' : key + '-grid');
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
      title.innerHTML = '<span class="pulse" style="background:var(--green)"></span> Análise completa &middot; 4 mercados';
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

      // Init scanners — these just attach event listeners to (now non-existent) old buttons, safe to call
      try { Picks.init(); } catch(e) { console.warn('[TB] Picks.init:', e); }
      try { TopPicks.init(); } catch(e) { console.warn('[TB] TopPicks.init:', e); }
      try { Corners.init(); } catch(e) { console.warn('[TB] Corners.init:', e); }
      try { Cards.init(); } catch(e) { console.warn('[TB] Cards.init:', e); }
      try { Over25Scanner.init(); } catch(e) { console.warn('[TB] Over25Scanner.init:', e); }

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
              Scanner pronto &middot; 4 mercados unificados
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

      <div class="filters" id="market-filters">
        <button class="chip is-active" data-filter="all">Todos os mercados</button>
        <button class="chip" data-filter="btts">BTTS <span class="num" style="opacity:0.7;margin-left:4px" id="count-btts">0</span></button>
        <button class="chip" data-filter="over25">Over 2.5 <span class="num" style="opacity:0.7;margin-left:4px" id="count-over25">0</span></button>
        <button class="chip" data-filter="cards">Cartões <span class="num" style="opacity:0.7;margin-left:4px" id="count-cards">0</span></button>
        <button class="chip" data-filter="corners">Cantos <span class="num" style="opacity:0.7;margin-left:4px" id="count-corners">0</span></button>
      </div>

      <section id="section-btts" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-btts)"></span> Ambas marcam <span class="badge" id="badge-btts">0</span></div>
        </div>
        <div class="tips-grid" id="top-picks-grid"></div>
      </section>

      <section id="section-over25" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-over)"></span> Mais de 2.5 golos <span class="badge" id="badge-over25">0</span></div>
        </div>
        <div class="tips-grid" id="over25-grid"></div>
      </section>

      <section id="section-cards" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-cards)"></span> Cartões <span class="badge" id="badge-cards">0</span></div>
        </div>
        <div class="tips-grid" id="cards-grid"></div>
      </section>

      <section id="section-corners" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-corners)"></span> Cantos <span class="badge" id="badge-corners">0</span></div>
        </div>
        <div class="tips-grid" id="corners-grid"></div>
      </section>
    `;

    // Setup filter chips
    document.querySelectorAll('#market-filters .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#market-filters .chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        this.activeMarketFilter = chip.dataset.filter;
        this.applyMarketFilter();
      });
    });
  },

  applyMarketFilter() {
    const f = this.activeMarketFilter;
    ['btts', 'over25', 'cards', 'corners'].forEach(s => {
      const el = document.getElementById('section-' + s);
      if (!el) return;
      const grid = el.querySelector('.tips-grid');
      const hasCards = grid && grid.children.length > 0;
      if (f === 'all') {
        el.style.display = hasCards ? '' : 'none';
      } else {
        el.style.display = (s === f && hasCards) ? '' : 'none';
      }
    });
  },

  updateCounts() {
    const grids = {
      btts: document.getElementById('top-picks-grid'),
      over25: document.getElementById('over25-grid'),
      cards: document.getElementById('cards-grid'),
      corners: document.getElementById('corners-grid'),
    };
    let total = 0;
    Object.entries(grids).forEach(([key, grid]) => {
      const count = grid ? grid.children.length : 0;
      total += count;
      const countEl = document.getElementById('count-' + key);
      const badgeEl = document.getElementById('badge-' + key);
      if (countEl) countEl.textContent = count;
      if (badgeEl) badgeEl.textContent = count;
      const section = document.getElementById('section-' + key);
      if (section) {
        if (this.activeMarketFilter === 'all') {
          section.style.display = count > 0 ? '' : 'none';
        } else {
          section.style.display = (key === this.activeMarketFilter && count > 0) ? '' : 'none';
        }
      }
    });
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
      this.updateScanProgress('BTTS completo', 30);

      // Step 3: Over 2.5
      this.updateScanProgress('A analisar Over 2.5...', 35);
      const o25Fixtures = Over25Scanner.getFixtures(fixtures);
      console.log('[TB] Over 2.5 fixtures:', o25Fixtures.length);
      if (o25Fixtures.length > 0) {
        const grid = document.getElementById('over25-grid');
        if (grid) grid.innerHTML = '';
        Over25Scanner.analyzed = [];
        Over25Scanner.isAnalyzing = false;
        await Over25Scanner.analyze(o25Fixtures);
      }
      this.updateCounts();
      this.updateScanProgress('Over 2.5 completo', 55);

      // Step 4: Cards
      this.updateScanProgress('A analisar Cartões...', 60);
      const cardsFixtures = Cards.getCardsFixtures(fixtures);
      console.log('[TB] Cards fixtures:', cardsFixtures.length);
      if (cardsFixtures.length > 0) {
        const grid = document.getElementById('cards-grid');
        if (grid) grid.innerHTML = '';
        Cards.analyzed = [];
        Cards.isAnalyzing = false;
        await Cards.analyze(cardsFixtures);
      }
      this.updateCounts();
      this.updateScanProgress('Cartões completo', 80);

      // Step 5: Corners
      this.updateScanProgress('A analisar Cantos...', 85);
      const cornersFixtures = Corners.getCornersFixtures(fixtures);
      console.log('[TB] Corners fixtures:', cornersFixtures.length);
      if (cornersFixtures.length > 0) {
        const grid = document.getElementById('corners-grid');
        if (grid) grid.innerHTML = '';
        Corners.analyzed = [];
        Corners.isAnalyzing = false;
        await Corners.analyze(cornersFixtures);
      }

      // Step 6: Finalize
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
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
