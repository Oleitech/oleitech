const App = {
  GRIDS: {
    btts: { gridId: 'top-picks-grid', badgeId: 'badge-btts', sectionId: 'section-btts' },
    favorites: { gridId: 'favorites-grid', badgeId: 'badge-favorites', sectionId: 'section-favorites' },
    over25: { gridId: 'over25-grid', badgeId: 'badge-over25', sectionId: 'section-over25' },
    over15: { gridId: 'over15-grid', badgeId: 'badge-over15', sectionId: 'section-over15' },
    baliza: { gridId: 'baliza-grid', badgeId: 'badge-baliza', sectionId: 'section-baliza' },
    scorers: { gridId: 'scorers-grid', badgeId: 'badge-scorers', sectionId: 'section-scorers' },
    clean_sheet: { gridId: 'clean-sheet-grid', badgeId: 'badge-clean-sheet', sectionId: 'section-clean-sheet' },
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
      const totalPL = await Layout.loadTotalPL();
      const main = Layout.init('tips', totalPL);
      if (!main) { console.error('[TB] Layout.init failed'); return; }

      this.buildTipsPage(main);
      Cache.purge();

      await this.loadCuratedTips();
      await this.loadAmbas();
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

          </div>
        </div>
      </div>

      <!-- A antevisao do dia era um paragrafo solto no topo, aberto, com 300
           palavras escritas para o QA auditar. Passa a fechar como os dias e os
           meses da pagina de resultados: quem quer ler, abre. -->
      <div id="tips-preview" class="preview" style="display:none">
        <div class="preview-head" id="tips-preview-head">
          <span class="preview-title">Resumo da Antevisão</span>
          <svg class="chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 6l6 6-6 6" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="preview-body"><p id="tips-notes"></p></div>
      </div>

      <section id="section-acca" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--green)"></span> Acumulador do dia <span class="badge badge--green" id="badge-acca"></span></div>
        </div>
        <div id="acca-container"></div>
      </section>

      <!-- 🟢🟢 ambas marcam (decisao do dono 09/11/2026): uma por dia, so o Sim; sai de manha com as tips, mais os alertas do dia (0,75/0,75 + valor).
           Le resultados/ambas/index.json (master/ambas.mjs). Sem stake = sem valor, medida em sombra.
           12/11/2026 (dono): aqui so a de HOJE; o historico esta na pagina de resultados (results-page.js). -->
      <section id="section-ambas" style="display:none">
        <div class="section-head">
          <div class="title">🟢🟢 Ambas marcam</div>
        </div>
        <div class="scanner">
          <div class="scanner-row"><div style="width:100%">
            <div class="scanner-title" id="ambas-hoje"></div>
          </div></div>
        </div>
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

      <section id="section-over25" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-over)"></span> Golos · Mais/menos 2.5 <span class="badge" id="badge-over25">0</span></div>
        </div>
        <div class="tips-grid" id="over25-grid"></div>
      </section>

      <section id="section-over15" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-over)"></span> Golos &middot; Mais/menos 1.5 <span class="badge" id="badge-over15">0</span></div>
        </div>
        <div class="tips-grid" id="over15-grid"></div>
      </section>

      <section id="section-baliza" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-corners)"></span> Remates à baliza <span class="badge" id="badge-baliza">0</span></div>
        </div>
        <div class="tips-grid" id="baliza-grid"></div>
      </section>

      <section id="section-scorers" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--amber)"></span> Marcadores (Anytime Scorer) <span class="badge" id="badge-scorers">0</span></div>
        </div>
        <div class="tips-grid" id="scorers-grid"></div>
      </section>

      <section id="section-clean-sheet" style="display:none">
        <div class="section-head">
          <div class="title"><span class="swatch" style="background:var(--m-btts)"></span> Não sofre (Clean Sheet) <span class="badge" id="badge-clean-sheet">0</span></div>
        </div>
        <div class="tips-grid" id="clean-sheet-grid"></div>
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

  // 13/11/2026 (dono): a multipla da jornada tem pernas em dias seguintes e fica nas tips ate estar toda resolvida
  // (o `liquida` so lhe poe `result` quando a ultima perna acaba); ai sai daqui e aparece nos resultados.
  // ponytail: 7 dias para tras chegam (a jornada mais longa e sex–seg); o liquida olha 14.
  async loadMultiplasEmCurso() {
    const dias = [1, 2, 3, 4, 5, 6, 7].map(i => this.getLocalDateStr(-i));
    const docs = await Promise.all(dias.map(d => fetch(bustCache(`tips/${d}.json`), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)));
    return docs.flatMap(p => (Array.isArray(p?.accumulators) ? p.accumulators : [])
      .filter(a => a.label === 'multipla-jornada' && a.shadow !== true && !a.result));
  },

  async loadCuratedTips() {
    this.showStatus('A carregar tips curadas...', 'loading');
    let payload = null;
    const emCurso = this.loadMultiplasEmCurso();
    try {
      const res = await fetch(bustCache(this.getTodayPath()), { cache: 'no-store' });
      if (res.ok) payload = await res.json();
      else if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.warn('[TB] Failed to load curated tips:', e);
    }
    const anteriores = await emCurso;

    const tips = Array.isArray(payload?.tips) ? payload.tips : [];
    // Acumuladores em sombra (o corvo desde 10/11/2026) sao registo, nao aposta: nao aparecem.
    const hoje = Array.isArray(payload?.accumulators) ? payload.accumulators.filter(a => a.shadow !== true) : [];
    const ids = new Set(hoje.map(a => a.multipla_id).filter(Boolean));
    const accas = [...hoje, ...anteriores.filter(a => !ids.has(a.multipla_id))];
    if (!payload && accas.length === 0) {
      this.showStatus('Ainda sem tips publicadas para hoje.', 'empty');
      return;
    }
    if (tips.length === 0 && accas.length === 0) {
      this.showStatus('Dia sem tips — nenhum jogo cumpriu os critérios.', 'empty');
      return;
    }
    this.renderTips(tips);
    this.renderAccumulators(accas);
    this.savePreMatchDataForLive(tips);
    this.updateMeta(payload || {}, tips.length, accas.length);
  },

  async loadAmbas() {
    let idx;
    try {
      const res = await fetch(bustCache('resultados/ambas/index.json'), { cache: 'no-store' });
      if (!res.ok) return; // ainda sem historico: a seccao fica escondida
      idx = await res.json();
    } catch (e) { console.warn('[TB] ambas:', e); return; }
    const dias = Array.isArray(idx?.dias) ? idx.dias : [];
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const f2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');
    const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); };
    const dia = dias.find(d => d.date === this.getLocalDateStr(0));
    const hoje = dia?.jogo ? dia : null, nLive = dia?.live?.length || 0;
    const titulo = document.getElementById('ambas-hoje');
    titulo.innerHTML = hoje
      ? `<span class="pulse" style="background:var(--green)"></span> <span>Hoje: <b>${esc(hoje.jogo)}</b> (${hora(hoje.ko)}) · 1xBet <span class="num">@${f2(hoje.odd)}</span>` +
        (hoje.oddJusta ? ` · justo <span class="num">@${f2(hoje.oddJusta)}</span>` : '') + (hoje.stake > 0 ? ' · meia stake' : ' · sem valor hoje, stake 0') +
        (hoje.result ? ` · <b>${esc(hoje.result)}</b> ${esc(hoje.final || '')}` : '') +
        (nLive ? ` · ${nLive} alerta${nLive === 1 ? '' : 's'} do dia` : '') + '</span>'
      : '<span class="pulse" style="background:var(--amber)"></span> <span>A de hoje sai de manhã, com as tips.</span>';
    document.getElementById('section-ambas').style.display = '';
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
      marketLabel: tip.marketLabel,
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
    const preview = document.getElementById('tips-preview');
    if (notes && preview && payload.notes) {
      notes.textContent = payload.notes;
      preview.style.display = '';
      const head = document.getElementById('tips-preview-head');
      // Fechado por omissao, como os dias. O toggle e ligado uma so vez.
      if (head && !head.dataset.bound) {
        head.dataset.bound = '1';
        head.addEventListener('click', () => preview.classList.toggle('is-open'));
      }
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
