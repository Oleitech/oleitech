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
  renderSidebar(activePage, totalPL) {
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
        ${totalPL != null ? `<div class="bankroll">
          <div class="label">P/L acumulado</div>
          <div class="value num" style="color:${totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">${this.units(totalPL, { signed: true })}</div>
        </div>` : ''}
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
    const p = this._totalPL;
    const plHtml = p != null ? `
      <div class="mobile-bankroll">
        <div class="mb-label">P/L acumulado</div>
        <div class="mb-row">
          <span class="mb-value num" style="color:${p >= 0 ? 'var(--green)' : 'var(--red)'}">${this.units(p, { signed: true })}</span>
        </div>
      </div>` : '';
    return `<div class="mobile-brand">
      ${this.logoMark(28)}
      <div class="brand-text">
        <span class="t1" style="font-size:13px">Trincheira</span>
        <span class="t2">BET</span>
      </div>
      ${plHtml}
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
  init(activePage, totalPL) {
    this._totalPL = totalPL;
    const root = document.getElementById('app-root');
    if (!root) return;
    root.className = 'app';
    root.innerHTML = `
      ${this.renderSidebar(activePage, totalPL)}
      <main class="app-main" id="app-main">
        ${this.renderMobileBrand()}
      </main>
      ${this.renderTabbar(activePage)}
    `;
    return document.getElementById('app-main');
  },

  // Update the accumulated P/L in sidebar (and mobile)
  updateTotalPL(totalPL) {
    this._totalPL = totalPL;
    if (totalPL == null) return;
    const color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    for (const sel of ['.bankroll .value', '.mobile-bankroll .mb-value']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.textContent = this.units(totalPL, { signed: true });
      el.style.color = color;
    }
  },

  // Desde 31/08/2026 os ficheiros de resultados ja guardam STAKES, nao euros
  // (ver scripts/migrate-eur-to-stakes.mjs). Nao ha nada a converter aqui: o
  // valor guardado e o valor que se mostra.
  units(val, { signed = false } = {}) {
    if (val == null || !isFinite(val)) return '—';
    const sign = signed && val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + ' stakes';
  },

  // Adaptador de schema: os ficheiros de resultados ate 03/05/2026 usam
  // `stakes.{balance,summary,bets}`; a partir de 16/05 passaram a
  // `curated_tips.{summary,tips,accumulators}` + `balance` no topo.
  // Devolve sempre a forma antiga para o resto do codigo nao mudar.

  // Rede de seguranca para ficheiros anteriores a migracao de 31/08/2026, que
  // guardavam euros. O marcador `units` e explicito -- nao se adivinha pela
  // grandeza do numero. Serve sobretudo contra caches mornas (browser ou CDN),
  // onde misturar um ficheiro em euros com outro em stakes daria um total sem
  // significado nenhum. Converte uma vez e marca; chamar de novo nao repete.
  LEGACY_EUR_PER_STAKE: 5,

  normalizeUnits(day) {
    if (!day || day.units === 'stakes') return day;
    const k = this.LEGACY_EUR_PER_STAKE;
    const div = (obj, keys) => {
      if (!obj) return;
      for (const key of keys) {
        if (typeof obj[key] === 'number') obj[key] = Math.round(obj[key] / k * 100) / 100;
      }
    };

    div(day, ['balance']);

    const ct = day.curated_tips;
    if (ct) {
      div(ct.summary, ['pnl', 'total_stake', 'total_return', 'combined_pnl',
        'combined_stake', 'combined_return', 'accumulators_pnl',
        'accumulators_stake', 'accumulators_return']);
      (ct.tips || []).forEach(t => div(t, ['stake', 'pnl', 'return']));
      (ct.accumulators || []).forEach(a => div(a, ['stake', 'pnl', 'return']));
    }

    const la = day.live_alerts;
    if (la) {
      div(la.summary, ['stake_total', 'stake_mensuravel', 'return_mensuravel',
        'pnl_mensuravel', 'pnl', 'return_total']);
      (la.alerts || []).forEach(a => div(a, ['stake', 'pnl', 'return']));
    }

    const st = day.stakes;
    if (st) {
      div(st, ['balance']);
      div(st.summary, ['profit', 'total_staked', 'total_return',
        'model_profit', 'model_staked', 'model_return',
        'live_profit', 'live_staked', 'live_return']);
      (st.bets || []).forEach(b => div(b, ['stake', 'return']));
    }

    day.units = 'stakes';
    return day;
  },

  dayStakes(day) {
    if (!day) return null;
    this.normalizeUnits(day);
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
    // banca (loadTotalPL) e o analytics-page.
    const la = day.live_alerts;
    // Alertas em sombra (confianca abaixo do piso de 90) sao arquivados e
    // resolvidos, mas nunca foram enviados nem apostados. A 03/09/2026 ficou
    // decidido deixa-los aparecer; a 05/09 o dono reverteu, e com razao: no dia
    // 04 a pagina mostrava 6 linhas de live quando so uma foi dinheiro, e a taxa
    // de acerto do dia media apostas que ele nunca fez. O resumo do dia ja usava
    // so os campos `_mensuravel` — as linhas e que estavam a contar tudo.
    // O registo da sombra nao se perde: continua nos ficheiros de resultados, em
    // `live_alerts.shadow_summary`, que e o que serve para julgar o piso de 90.
    // `!== true` e deliberado: ficheiros anteriores a 31/08 nao tem o campo, e
    // esses alertas foram todos reais.
    const liveAlerts = (la?.alerts || [])
      .filter(a => a.shadow !== true)
      .filter(a => a.result === 'GREEN' || a.result === 'RED');
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

  // Shared: soma o P/L de todos os dias. Devolve stakes, ou null se falhar.
  async loadTotalPL() {
    try {
      const res = await fetch(bustCache('resultados/data/index.json'), { cache: 'no-store' });
      if (!res.ok) return null;
      const index = await res.json();
      if (!index.files?.length) return null;
      const days = await Promise.all(index.files.map(async (f) => {
        try {
          const r = await fetch(bustCache('resultados/data/' + f), { cache: 'no-store' });
          return r.ok ? await r.json() : null;
        } catch (e) { return null; }
      }));
      let totalPL = 0;
      for (const d of days) {
        if (!d) continue;
        const profit = this.dayStakes(d)?.summary?.profit;
        if (profit != null) totalPL += profit;
      }
      return Math.round(totalPL * 100) / 100;
    } catch (e) {
      return null;
    }
  }
};
