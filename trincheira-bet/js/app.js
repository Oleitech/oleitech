const App = {
  GRIDS: {
    btts: { gridId: 'top-picks-grid', badgeId: 'badge-btts', sectionId: 'section-btts' },
    favorites: { gridId: 'favorites-grid', badgeId: 'badge-favorites', sectionId: 'section-favorites' },
    scorers: { gridId: 'scorers-grid', badgeId: 'badge-scorers', sectionId: 'section-scorers' },
    corners: { gridId: 'corners-grid', badgeId: 'badge-corners', sectionId: 'section-corners' },
  },

  getTodayPath() {
    return `tips/${UI.getDateStr(0)}.json`;
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
    if (tips.length === 0) {
      this.showStatus('Dia sem tips — nenhum jogo cumpriu os critérios.', 'empty');
      return;
    }

    this.renderTips(tips);
    this.savePreMatchDataForLive(tips);
    this.updateMeta(payload, tips.length);
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
      const cfg = this.GRIDS[tip.market];
      if (!cfg) {
        console.warn('[TB] Unknown market in tip:', tip.market);
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
    });
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

  updateMeta(payload, count) {
    this.showStatus(`Tips publicadas · ${count} ${count === 1 ? 'aposta' : 'apostas'}`, 'ready');
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
