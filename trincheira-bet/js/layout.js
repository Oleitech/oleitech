// Shared layout components — vanilla JS
const Layout = {
  // SVG icon library
  icons: {
    tips: '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke-width="0" fill="currentColor"/>',
    results: '<rect x="3" y="4" width="18" height="16" rx="2" stroke-width="1.5" stroke="currentColor" fill="none"/><path d="M3 9h18M8 4v16" stroke-width="1.5" stroke="currentColor"/>',
    chev: '<path d="M9 6l6 6-6 6" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8m0-5v5h-5" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    bolt: '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke-width="0" fill="currentColor"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    live: '<circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"/>',
  },

  icon(name, cls) {
    return `<svg class="${cls || 'icon'}" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${this.icons[name] || ''}</svg>`;
  },

  // Logo mark (pitch variant)
  logoMark(size) {
    const s = size || 32;
    return `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true" style="display:block;flex-shrink:0;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent-hover))">
      <rect x="5" y="5" width="30" height="30" rx="2" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.4"/>
      <line x1="5" y1="20" x2="35" y2="20" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
      <circle cx="20" cy="20" r="4.5" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
      <circle cx="20" cy="20" r="1" fill="#0A0B0D" fill-opacity="0.9"/>
      <rect x="12" y="5" width="16" height="5" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
      <rect x="16" y="5" width="8" height="2" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
      <rect x="12" y="30" width="16" height="5" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
      <rect x="16" y="33" width="8" height="2" fill="none" stroke="#0A0B0D" stroke-opacity="0.9" stroke-width="1.2"/>
    </svg>`;
  },

  // Render sidebar (desktop)
  renderSidebar(activePage, bankroll, totalPL) {
    return `<aside class="sidebar">
      <div class="sidebar-brand">
        ${this.logoMark(36)}
        <div class="brand-text">
          <span class="t1">Trincheira</span>
          <span class="t2">BET &middot; v2.0</span>
        </div>
      </div>
      <nav class="nav">
        <div class="nav-section-label">Principal</div>
        <a href="index.html" class="nav-item ${activePage === 'tips' ? 'is-active' : ''}">
          ${this.icon('bolt', 'icon')}Tips
        </a>
        <a href="live.html" class="nav-item ${activePage === 'live' ? 'is-active' : ''}">
          ${this.icon('live', 'icon')}Ao Vivo
        </a>
        <a href="resultados.html" class="nav-item ${activePage === 'results' ? 'is-active' : ''}">
          ${this.icon('results', 'icon')}Resultados
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="bankroll">
          <div class="label">Bankroll</div>
          <div class="value num">${this.units(bankroll)}</div>
          ${totalPL != null ? `<div class="delta" style="color:${totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${this.units(totalPL, { signed: true })} total
          </div>` : ''}
        </div>
      </div>
    </aside>`;
  },

  // Render mobile tabbar
  renderTabbar(activePage) {
    return `<nav class="tabbar">
      <div class="tabbar-inner">
        <a href="index.html" class="tab ${activePage === 'tips' ? 'is-active' : ''}">
          ${this.icon('bolt', 'icon')}<span>Tips</span>
        </a>
        <a href="live.html" class="tab ${activePage === 'live' ? 'is-active' : ''}">
          ${this.icon('live', 'icon')}<span>Ao Vivo</span>
        </a>
        <a href="resultados.html" class="tab ${activePage === 'results' ? 'is-active' : ''}">
          ${this.icon('results', 'icon')}<span>Resultados</span>
        </a>
      </div>
    </nav>`;
  },

  // Render mobile brand bar
  renderMobileBrand() {
    const b = this._bankroll;
    const p = this._totalPL;
    const bankrollHtml = b != null ? `
      <div class="mobile-bankroll">
        <div class="mb-label">Bankroll</div>
        <div class="mb-row">
          <span class="mb-value num">${this.units(b)}</span>
          ${p != null ? `<span class="mb-delta num" style="color:${p >= 0 ? 'var(--green)' : 'var(--red)'}">${this.units(p, { signed: true })}</span>` : ''}
        </div>
      </div>` : '';
    return `<div class="mobile-brand">
      ${this.logoMark(28)}
      <div class="brand-text">
        <span class="t1" style="font-size:13px">Trincheira</span>
        <span class="t2">BET</span>
      </div>
      ${bankrollHtml}
    </div>`;
  },

  // Render confidence ring SVG
  renderConfRing(value, size) {
    const s = size || 48;
    const r = s * 0.42;
    const C = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    const dash = C * (1 - pct / 100);
    const color = pct >= 80 ? 'var(--green)' : pct >= 70 ? 'var(--accent)' : 'var(--amber)';
    return `<div class="conf-ring">
      <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="transform:rotate(-90deg)">
        <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="var(--bg-elev-3)" stroke-width="4" class="track"/>
        <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"
          stroke-dasharray="${C}" stroke-dashoffset="${dash}" class="fill"/>
      </svg>
      <div class="num">${pct}</div>
    </div>`;
  },

  // Initialize layout for a page
  init(activePage, bankroll, totalPL) {
    this._bankroll = bankroll;
    this._totalPL = totalPL;
    const root = document.getElementById('app-root');
    if (!root) return;
    root.className = 'app';
    root.innerHTML = `
      ${this.renderSidebar(activePage, bankroll, totalPL)}
      <main class="app-main" id="app-main">
        ${this.renderMobileBrand()}
      </main>
      ${this.renderTabbar(activePage)}
    `;
    return document.getElementById('app-main');
  },

  // Update bankroll in sidebar (and mobile)
  updateBankroll(bankroll, totalPL) {
    this._bankroll = bankroll;
    this._totalPL = totalPL;
    const val = document.querySelector('.bankroll .value');
    const delta = document.querySelector('.bankroll .delta');
    if (val && bankroll != null) val.textContent = this.units(bankroll);
    if (delta && totalPL != null) {
      delta.textContent = this.units(totalPL, { signed: true }) + ' total';
      delta.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    }
    const mbVal = document.querySelector('.mobile-bankroll .mb-value');
    const mbDelta = document.querySelector('.mobile-bankroll .mb-delta');
    if (mbVal && bankroll != null) mbVal.textContent = this.units(bankroll);
    if (mbDelta && totalPL != null) {
      mbDelta.textContent = this.units(totalPL, { signed: true });
      mbDelta.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    }
  },

  // Adaptador de schema: os ficheiros de resultados ate 03/05/2026 usam
  // `stakes.{balance,summary,bets}`; a partir de 16/05 passaram a
  // `curated_tips.{summary,tips,accumulators}` + `balance` no topo.
  // Devolve sempre a forma antiga para o resto do codigo nao mudar.
  // Toda a UI mostra stakes, nunca euros. Base igual a UI.STAKE_UNIT (5 EUR),
  // duplicada aqui de proposito: layout.js carrega antes de ui.js.
  STAKE_UNIT: 5,

  units(val, { signed = false } = {}) {
    if (val == null || !isFinite(val)) return '—';
    const u = val / this.STAKE_UNIT;
    const sign = signed && u >= 0 ? '+' : '';
    return sign + u.toFixed(2) + ' stakes';
  },

  dayStakes(day) {
    if (!day) return null;
    if (day.stakes?.summary) return day.stakes;

    const ct = day.curated_tips;
    if (!ct?.summary) return day.stakes || null;
    const sum = ct.summary;

    // Nomes de campo iguais aos do schema antigo (matches/type/result:'win'),
    // que e o contrato que results-page.js ja consome.
    const bets = (ct.tips || []).map(t => ({
      market: t.marketLabel || t.market,
      matches: `${t.home} vs ${t.away}`,
      type: t.pick,
      odds: t.odds,
      stake: t.stake,
      result: t.hit === true ? 'win' : 'loss',
      source: 'pre',
    })).concat((ct.accumulators || []).map(a => ({
      market: 'Acumulador',
      matches: (a.selections || []).map(x => x.match).join(' + '),
      type: (a.selections || []).map(x => x.pick).join(' + '),
      odds: a.combined_odds,
      stake: a.stake,
      result: a.result === 'GREEN' ? 'win' : 'loss',
      source: 'pre',
    })));

    // Alertas live do bot. Sao NOCIONAIS: entram nas linhas do dia e no split
    // PRE/LIVE, mas nunca em profit/total_staked, que sao o que alimenta a
    // banca (loadBankrollData) e o analytics-page.
    const la = day.live_alerts;
    const liveAlerts = (la?.alerts || []).filter(a => a.result === 'GREEN' || a.result === 'RED');
    const liveSum = la?.summary || {};

    liveAlerts.forEach(a => {
      bets.push({
        market: a.strategy || a.market || 'Live',
        matches: a.match,
        type: `${a.market}${a.elapsed != null ? ` · ${a.elapsed}'` : ''}${a.score ? ` (${a.score})` : ''}`,
        odds: a.odds,
        stake: a.stake,
        result: a.result === 'GREEN' ? 'win' : 'loss',
        source: 'live',
      });
    });

    const preBets = bets.filter(b => b.source === 'pre');
    const preWins = preBets.filter(b => b.result === 'win').length;
    const preProfit = sum.combined_pnl ?? sum.pnl ?? 0;
    const preStaked = sum.combined_stake ?? sum.total_stake ?? 0;

    const liveStaked = liveSum.stake_mensuravel ?? liveSum.stake_total ?? 0;
    const liveProfit = liveSum.pnl_mensuravel ?? 0;

    return {
      balance: day.balance ?? null,
      summary: {
        profit: preProfit,
        total_staked: preStaked,
        // Campos do split PRE/LIVE que results-page.js ja sabia consumir.
        model_bets: preBets.length,
        model_wins: preWins,
        model_staked: preStaked,
        model_profit: preProfit,
        model_roi: preStaked > 0 ? (preProfit / preStaked * 100) : 0,
        live_bets: liveAlerts.length,
        live_wins: liveAlerts.filter(a => a.result === 'GREEN').length,
        live_staked: liveStaked,
        live_profit: liveProfit,
        live_roi: liveSum.roi_pct_mensuravel ?? (liveStaked > 0 ? (liveProfit / liveStaked * 100) : 0),
      },
      bets,
    };
  },

  // Shared: load bankroll data from latest JSON
  async loadBankrollData() {
    try {
      const res = await fetch('resultados/data/index.json');
      if (!res.ok) return { bankroll: null, totalPL: null };
      const index = await res.json();
      if (!index.files.length) return { bankroll: null, totalPL: null };
      const lastFile = index.files[index.files.length - 1];
      const dayRes = await fetch('resultados/data/' + lastFile);
      if (!dayRes.ok) return { bankroll: null, totalPL: null };
      const day = await dayRes.json();
      const bankroll = this.dayStakes(day)?.balance ?? null;
      // Calculate total P/L: sum all days' stakes.summary.profit
      let totalPL = 0;
      for (const f of index.files) {
        try {
          const r = await fetch('resultados/data/' + f);
          if (r.ok) {
            const d = await r.json();
            const st = this.dayStakes(d);
            if (st?.summary?.profit != null) totalPL += st.summary.profit;
          }
        } catch (e) { /* skip */ }
      }
      return { bankroll, totalPL };
    } catch (e) {
      return { bankroll: null, totalPL: null };
    }
  }
};
