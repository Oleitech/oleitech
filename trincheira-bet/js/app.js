const App = {
  GRIDS: {
    btts: { gridId: 'top-picks-grid', badgeId: 'badge-btts', sectionId: 'section-btts' },
    favorites: { gridId: 'favorites-grid', badgeId: 'badge-favorites', sectionId: 'section-favorites' },
    scorers: { gridId: 'scorers-grid', badgeId: 'badge-scorers', sectionId: 'section-scorers' },
    corners: { gridId: 'corners-grid', badgeId: 'badge-corners', sectionId: 'section-corners' },
    nba: { gridId: 'nba-grid', badgeId: 'badge-nba', sectionId: 'section-nba' },
    tennis: { gridId: 'tennis-grid', badgeId: 'badge-tennis', sectionId: 'section-tennis' },
  },

  // Data local, nao UTC: UI.getDateStr usa toISOString, por isso entre a
  // meia-noite e a 1h (WEST) devolvia ontem e pediamos as tips erradas.
  getLocalDateStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  getTodayPath() {
    return `tips/${this.getLocalDateStr(0)}.json`;
  },

  async init() {
    try {
      console.log('[TB] Initializing...');
      const { bankroll, totalPL } = await Layout.loadBankrollData();
      const main = Layout.init('tips', bankroll, totalPL);
      if (!main) { console.error('[TB] Layout.init failed'); return; }

      this.buildTipsPage(main);
      Cache.purge();

      await this.loadCuratedTips();
    } catch (e) {
      console.error('[TB] Init failed:', e);
    }
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
      </header>

      <div id="tips-status" class="scanner" style="display:none">
        <div class="scanner-row">
          <div style="width:100%">
            <div class="scanner-title" id="tips-status-title"></div>
            <div class="scanner-stats" style="margin-top:8px">
              <span><span class="k">Tips publicadas</span><span class="v num" id="stat-tips">0</span></span>
              <span><span class="k">Atualizado</span><span class="v" id="stat-updated">—</span></span>
            </div>
            <div id="tips-notes" style="margin-top:10px;font-size:13px;color:var(--text-2);line-height:1.5;display:none"></div>
          </div>
        </div>
      </div>

      <section id="section-acca" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--green)"></span> Acumulador do dia <span class="badge badge--green" id="badge-acca"></span></div>
        </div>
        <div id="acca-container"></div>
      </section>

      <section id="section-btts" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-btts)"></span> Ambas marcam (BTTS) <span class="badge" id="badge-btts">0</span></div>
        </div>
        <div class="tips-grid" id="top-picks-grid"></div>
      </section>

      <section id="section-favorites" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--accent)"></span> Favoritos 1X2 <span class="badge" id="badge-favorites">0</span></div>
        </div>
        <div class="tips-grid" id="favorites-grid"></div>
      </section>

      <section id="section-scorers" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--amber)"></span> Marcadores (Anytime Scorer) <span class="badge" id="badge-scorers">0</span></div>
        </div>
        <div class="tips-grid" id="scorers-grid"></div>
      </section>

      <section id="section-corners" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-corners)"></span> Cantos (Pré-jogo) <span class="badge" id="badge-corners">0</span></div>
        </div>
        <div class="tips-grid" id="corners-grid"></div>
      </section>

      <section id="section-nba" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--amber)"></span> NBA &middot; Totais / Spreads <span class="badge" id="badge-nba">0</span></div>
        </div>
        <div class="tips-grid" id="nba-grid"></div>
      </section>

      <section id="section-tennis" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-cards)"></span> Tennis &middot; Match / Games <span class="badge" id="badge-tennis">0</span></div>
        </div>
        <div class="tips-grid" id="tennis-grid"></div>
      </section>
    `;
  },

  async loadCuratedTips() {
    this.showStatus('A carregar tips curadas...', 'loading');
    let payload;
    try {
      const res = await fetch(this.getTodayPath(), { cache: 'no-store' });
      if (res.status === 404) {
        this.showStatus('Ainda sem tips publicadas para hoje.', 'empty');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = await res.json();
    } catch (e) {
      console.warn('[TB] Failed to load curated tips:', e);
      this.showStatus('Sem tips publicadas para hoje.', 'empty');
      return;
    }

    const tips = Array.isArray(payload?.tips) ? payload.tips : [];
    const accas = Array.isArray(payload?.accumulators) ? payload.accumulators : [];
    if (tips.length === 0 && accas.length === 0) {
      this.showStatus('Dia sem tips — nenhum jogo cumpriu os critérios.', 'empty');
      return;
    }
    this.renderTips(tips);
    this.renderAccumulators(accas);
    this.savePreMatchDataForLive(tips);
    this.updateMeta(payload, tips.length, accas.length);
  },

  showStatus(text, kind) {
    const wrap = document.getElementById('tips-status');
    const title = document.getElementById('tips-status-title');
    if (!wrap || !title) return;
    wrap.style.display = '';
    const dotColor = kind === 'empty' ? 'var(--text-4)' : kind === 'loading' ? 'var(--amber)' : 'var(--green)';
    title.innerHTML = `<span class="pulse" style="background:${dotColor}"></span> ${text}`;
  },

  renderTips(tips) {
    Object.values(this.GRIDS).forEach(g => {
      const grid = document.getElementById(g.gridId);
      if (grid) grid.innerHTML = '';
    });

    tips.forEach(tip => {
      // Sport-based routing: NBA/Tennis tips go to their sport grid regardless
      // of market sub-type. Football routes by market sub-type (btts/favs/etc).
      const cfgKey = tip.sport === 'nba' ? 'nba'
        : tip.sport === 'tennis' ? 'tennis'
        : tip.market;
      const cfg = this.GRIDS[cfgKey];
      if (!cfg) {
        console.warn('[TB] Unknown market/sport in tip:', tip.sport, tip.market);
        return;
      }
      const grid = document.getElementById(cfg.gridId);
      if (!grid) return;
      const card = this.buildCard(tip);
      if (card) grid.appendChild(card);
    });

    this.updateCounts();
  },

  buildCard(tip) {
    const kickoff = tip.kickoff ? new Date(tip.kickoff) : null;
    const time = kickoff ? kickoff.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    return UI.renderTipCard({
      home: tip.home?.name,
      away: tip.away?.name,
      homeLogo: tip.home?.logo,
      awayLogo: tip.away?.logo,
      league: tip.league,
      time,
      marketKey: tip.market,
      pick: tip.pick,
      odds: typeof tip.odds === 'number' ? tip.odds : null,
      score: typeof tip.score === 'number' ? tip.score : 70,
      factors: tip.factors || [],
      stake: tip.stake,
      tese: tip.tese,
      sources: tip.sources || [],
      sport: tip.sport,
    });
  },

  renderAccumulators(accumulators) {
    const section = document.getElementById('section-acca');
    const container = document.getElementById('acca-container');
    const badge = document.getElementById('badge-acca');
    if (!section || !container) return;

    const list = Array.isArray(accumulators) ? accumulators.filter(a => Array.isArray(a.selections) && a.selections.length >= 2) : [];
    if (list.length === 0) {
      section.style.display = 'none';
      return;
    }

    container.innerHTML = '';
    list.forEach(acca => {
      const card = UI.renderAccaCard(acca);
      if (card) container.appendChild(card);
    });

    if (badge) badge.textContent = list.length > 1 ? `${list.length}` : `@ ${list[0].combined_odds?.toFixed(2) ?? '—'}`;
    section.style.display = '';
  },

  updateCounts() {
    let total = 0;
    Object.values(this.GRIDS).forEach(cfg => {
      const grid = document.getElementById(cfg.gridId);
      const n = grid ? grid.children.length : 0;
      total += n;
      const badge = document.getElementById(cfg.badgeId);
      if (badge) badge.textContent = n;
      const section = document.getElementById(cfg.sectionId);
      if (section) section.style.display = n > 0 ? '' : 'none';
    });
    const statTips = document.getElementById('stat-tips');
    if (statTips) statTips.textContent = total;
  },

  updateMeta(payload, count, accaCount = 0) {
    const parts = [];
    if (count > 0) parts.push(`${count} ${count === 1 ? 'aposta' : 'apostas'}`);
    if (accaCount > 0) parts.push(`${accaCount} ${accaCount === 1 ? 'acumulador' : 'acumuladores'}`);
    const label = parts.length ? parts.join(' · ') : 'sem apostas';
    this.showStatus(`Tips publicadas · ${label}`, 'ready');
    const statUpdated = document.getElementById('stat-updated');
    if (statUpdated && payload.generated_at) {
      const d = new Date(payload.generated_at);
      statUpdated.textContent = isNaN(d) ? payload.generated_at : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }
    const notes = document.getElementById('tips-notes');
    if (notes && payload.notes) {
      notes.style.display = '';
      notes.textContent = payload.notes;
    }
  },

  /** Save pre-match analysis data for the live engine */
  savePreMatchDataForLive(tips) {
    const map = {};
    tips.forEach(t => {
      if (t.market !== 'btts' || !t.fixtureId) return;
      map[t.fixtureId] = { bttsScore: typeof t.score === 'number' ? t.score : 0 };
    });
    if (Object.keys(map).length === 0) return;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    Cache.set('prematch_live', map, midnight - now);
    console.log('[TB] Pre-match data saved for live engine:', Object.keys(map).length, 'fixtures');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
