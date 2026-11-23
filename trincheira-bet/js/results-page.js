const ResultsPage = {
  days: [],
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  weekdayNames: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],

  // Market display config
  marketColors: {
    btts: 'var(--m-btts)',
    over25: 'var(--m-over)',
    cards: 'var(--m-cards)',
    corners: 'var(--m-corners)',
    baliza: 'var(--m-corners)',
  },

  marketLabels: {
    btts: 'BTTS',
    over25: 'Mais/menos 2.5',
    baliza: 'Remates à baliza',
    cards: 'Cartões',
    corners: 'Cantos',
    clean_sheet: 'Não sofre',
  },

  chevSVG: '<svg class="chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 6l6 6-6 6" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',

  async init() {
    // 23/11/2026 (ecra preto ~20 s; dono: "ir mostrando algo"): o layout desenha ja. Os dias chegam por lotes, em serie
    // (a fila do fetchJSON, 3 em voo e 130 ms, e FIFO): os 7 mais recentes, o resto do mes atual e depois mes a mes
    // para tras. Cada mes aparece com o seu resumo assim que fica completo; os que faltam ficam no fundo "a carregar…".
    // O resumo do topo e o P/L total ficam a "—" ate ao fim (um numero parcial parecia o real).
    const main = Layout.init('results', null);
    if (!main) return;

    // Show loading state
    main.innerHTML += `
      <header class="topbar">
        <div>
          <h1>Resultados</h1>
          <div class="subtitle">A carregar dados...</div>
        </div>
      </header>
      <div id="results-content"></div>
    `;

    const index = await fetchJSON('resultados/data/index.json', { memo: true }).catch(() => null);
    const files = [...(index?.files || [])].sort().reverse();
    this.porMes = new Map();
    for (const f of files) { const k = f.slice(0, 7); if (!this.porMes.has(k)) this.porMes.set(k, []); this.porMes.get(k).push(f); }
    const recentes = files.slice(0, 7);
    const lotes = [recentes, ...[...this.porMes.values()].map(fs => fs.filter(f => !recentes.includes(f)))].filter(l => l.length);
    this.days = [];
    for (const [i, lote] of lotes.entries()) {
      this.days = [...this.days, ...await this.loadData(lote)].sort((a, b) => b.date.localeCompare(a.date));
      if (i === 0) this.render(main, false);
      else this.atualizaMeses();
    }
    const sub = main.querySelector('.topbar .subtitle');
    if (sub) sub.innerHTML = this.subtitulo(true);
    Layout.loadTotalPL().then(t => Layout.updateTotalPL(t)).catch(() => {}); // no fim: os ficheiros ja estao todos (memo)
    await this.renderAmbas(main);
  },

  // Reconstroi so os meses cujo numero de dias carregados mudou. Mantem abertos o mes e os dias que o utilizador abriu
  // e, se o mes esta todo acima do ecra, compensa a diferenca de altura para o scroll nao saltar (os dias novos
  // entram no fim do mes: com o utilizador a ler dentro dele, ficam por baixo e nao mexem no que esta a ver).
  atualizaMeses() {
    for (const [k, novo] of this.mesesEls()) {
      const velho = this.container?.querySelector(`.month[data-k="${k}"]`);
      if (!velho || velho.dataset.n === novo.dataset.n) continue;
      novo.classList.toggle('is-open', velho.classList.contains('is-open'));
      for (const d of velho.querySelectorAll('.day.is-open[data-k]')) novo.querySelector(`.day[data-k="${d.dataset.k}"]`)?.classList.add('is-open');
      const antes = velho.getBoundingClientRect();
      velho.replaceWith(novo);
      if (antes.bottom <= 0) window.scrollBy(0, novo.getBoundingClientRect().height - antes.height); // mes todo acima do ecra
    }
  },

  // 🟢🟢 ambas marcam (12/11/2026, dono): o historico sai da pagina das tips e vive aqui. So mostra:
  // a banca ja conta as com stake pelo live_alerts de resultados/data (fonte unica); as sem stake sao sombra, fora das contas.
  async renderAmbas(main) {
    let idx;
    try {
      idx = await fetchJSON('resultados/ambas/index.json');
      if (!idx) return;
    } catch (e) { console.warn('[TB] ambas:', e); return; }
    const linhas = (Array.isArray(idx?.dias) ? idx.dias : [])
      .flatMap(d => [...(d.jogo ? [{ ...d, alerta: false }] : []), ...(d.live || []).map(x => ({ ...x, date: d.date, alerta: true }))])
      .filter(l => l.result);
    if (!linhas.length) return;
    const esc = (v) => this.esc(v), f2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');
    const comStake = linhas.filter(l => l.stake > 0);
    const pnl = comStake.reduce((a, l) => a + (l.pnl || 0), 0);
    const verdes = comStake.filter(l => l.result === 'GREEN').length;
    const sec = UI.el('section', 'ambas-results');
    sec.id = 'results-ambas';
    sec.style.marginTop = '24px';
    sec.innerHTML = `
      <div class="section-head"><div class="title">🟢🟢 Ambas marcam <span class="badge badge--green">${linhas.length}</span></div></div>
      <div class="month-summary" style="margin:8px 0 12px">
        <div class="m"><span class="label">Com stake</span><span class="value num">${verdes}/${comStake.length}</span></div>
        <div class="m"><span class="label">P/L</span><span class="value num" style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${this.formatPL(pnl, true)}</span></div>
        <div class="m"><span class="label">Sombra (fora das contas)</span><span class="value num">${linhas.length - comStake.length}</span></div>
      </div>
      <div class="league-table">
        <div class="league-row head"><div>Jogo</div><div>Odd</div><div>Stake</div><div>Resultado</div></div>
        ${linhas.map(l => `<div class="league-row">
          <div>${esc(l.date.slice(8, 10))}/${esc(l.date.slice(5, 7))} · ${esc(l.jogo)}${l.alerta ? ' · alerta do dia' : ''}</div>
          <div class="num">@${f2(l.odd)}</div>
          <div>${l.stake > 0 ? `${this.formatUnits(l.stake, true)} · ${this.formatPL(l.pnl || 0, true)}` : 'sombra'}</div>
          <div style="color:${l.result === 'GREEN' ? 'var(--green)' : l.result === 'RED' ? 'var(--red)' : 'inherit'}">${esc(l.result)} ${esc(l.final || '')}</div>
        </div>`).join('')}
      </div>`;
    main.appendChild(sec);
  },

  // fetchJSON pede sem cache do browser (no-store, ver o app.js) e repete os 429; partilhado com o total do topo (memo)
  async loadData(files) {
    const results = await Promise.all(files.map(f => fetchJSON('resultados/data/' + f, { memo: true }).catch(() => null)));
    return results.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  },

  // Flatten all tips from a day into unified bet list
  flattenTips(day) {
    const tips = [];

    // BTTS tips
    if (day.btts?.tips) {
      day.btts.tips.forEach(t => {
        tips.push({
          market: 'btts',
          home: t.home,
          away: t.away,
          pick: 'BTTS Sim',
          hit: t.btts_hit === true,
        });
      });
    }

    // Over 2.5 tips
    if (day.over25?.tips) {
      day.over25.tips.forEach(t => {
        tips.push({
          market: 'over25',
          home: t.home,
          away: t.away,
          pick: 'Over 2.5',
          hit: t.hit === true,
        });
      });
    }

    // Cards tips
    if (day.cards?.tips) {
      day.cards.tips.forEach(t => {
        tips.push({
          market: 'cards',
          home: t.home,
          away: t.away,
          pick: t.market || 'Cartões',
          hit: t.hit === true,
        });
      });
    }

    // Corners tips
    if (day.corners?.tips) {
      day.corners.tips.forEach(t => {
        tips.push({
          market: 'corners',
          home: t.home,
          away: t.away,
          pick: t.market || 'Cantos',
          hit: t.hit === true,
        });
      });
    }

    // Schema novo (>=16/05/2026): tips curadas em curated_tips.tips
    if (day.curated_tips?.tips) {
      day.curated_tips.tips.forEach(t => {
        tips.push({
          market: t.market,
          home: t.home,
          away: t.away,
          pick: t.pick,
          hit: t.hit === true,
        });
      });
    }

    return tips;
  },

  // Contagem acertos/total do dia a partir da MESMA fonte que rende as linhas
  // expandidas (tips + acumuladores + alertas live). O flattenTips sozinho so
  // ve tips individuais, e por isso a barra dizia 3/3 num dia de 4/5.
  dayCounts(day) {
    const bets = Layout.dayStakes(day)?.bets || [];
    if (bets.length > 0) {
      const scored = bets.filter(b => b.result === 'win' || b.result === 'loss');
      return { total: scored.length, hits: scored.filter(b => b.result === 'win').length };
    }
    const tips = this.flattenTips(day);
    return { total: tips.length, hits: tips.filter(t => t.hit).length };
  },

  // Compute global stats across all days
  computeStats() {
    let totalTips = 0;
    let totalHits = 0;
    let totalPL = 0;
    let totalStaked = 0;
    let bestDay = { profit: -Infinity, date: '' };
    let streak = 0;
    let maxStreak = 0;
    let currentStreak = 0;

    // Process days in chronological order for streak
    const chronological = [...this.days].reverse();

    chronological.forEach(day => {
      const counts = this.dayCounts(day);
      totalTips += counts.total;
      totalHits += counts.hits;

      const profit = Layout.dayStakes(day)?.summary?.profit || 0;
      const staked = Layout.dayStakes(day)?.summary?.total_staked || 0;
      totalPL += profit;
      totalStaked += staked;

      if (profit > bestDay.profit) {
        bestDay = { profit, date: day.date };
      }

      if (profit >= 0) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    // Current streak (from most recent day backwards)
    streak = 0;
    for (let i = 0; i < this.days.length; i++) {
      const profit = Layout.dayStakes(this.days[i])?.summary?.profit || 0;
      if (profit >= 0) streak++;
      else break;
    }

    const hitRate = totalTips > 0 ? (totalHits / totalTips * 100) : 0;
    const roi = totalStaked > 0 ? (totalPL / totalStaked * 100) : 0;

    return { totalTips, totalHits, hitRate, totalPL, roi, streak, maxStreak, bestDay, totalStaked };
  },

  // Group days by YYYY-MM
  groupByMonth() {
    const groups = {};
    this.days.forEach(day => {
      const key = day.date.substring(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(day);
    });
    // Return sorted by month descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  },

  // Compute month-level stats
  computeMonthStats(days) {
    let totalTips = 0;
    let totalHits = 0;
    let totalPL = 0;
    let totalStaked = 0;

    days.forEach(day => {
      const counts = this.dayCounts(day);
      totalTips += counts.total;
      totalHits += counts.hits;
      totalPL += Layout.dayStakes(day)?.summary?.profit || 0;
      totalStaked += Layout.dayStakes(day)?.summary?.total_staked || 0;
    });

    const hitRate = totalTips > 0 ? (totalHits / totalTips * 100) : 0;
    const roi = totalStaked > 0 ? (totalPL / totalStaked * 100) : 0;

    return { totalTips, totalHits, hitRate, totalPL, totalStaked, roi, dayCount: days.length };
  },

  // Format date parts
  parseDateParts(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return {
      day: d.getDate().toString().padStart(2, '0'),
      weekday: this.weekdayNames[d.getDay()],
      month: this.monthNames[d.getMonth()],
      year: d.getFullYear(),
    };
  },

  // Os ficheiros de resultados ja guardam stakes desde 31/08/2026, por isso
  // aqui so se formata. compact=true para as colunas estreitas das linhas.
  formatPL(val, compact = false) {
    if (val == null) return '—';
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + (compact ? ' st' : ' stakes');
  },

  // Valor absoluto em stakes (stake arriscada), sem sinal.
  formatUnits(val, compact = false) {
    if (val == null) return '—';
    const label = Number.isInteger(val) ? String(val) : val.toFixed(2);
    return label + (compact ? ' st' : ' stakes');
  },

  // "apostas" e nao "tips": a contagem inclui acumuladores e alertas live. Incompleto: "—" (nunca um parcial).
  subtitulo(completo) {
    if (!completo) return '— apostas &middot; — hit rate &middot; — ROI &middot; a carregar o histórico…';
    const stats = this.computeStats();
    return `${stats.totalTips} apostas &middot; ${stats.hitRate.toFixed(1)}% hit rate &middot; ${stats.roi.toFixed(1)}% ROI`;
  },

  render(main, completo = true) {
    const subtitleText = this.subtitulo(completo);

    main.innerHTML = '';
    // Re-add mobile brand
    main.innerHTML = Layout.renderMobileBrand();

    // Topbar
    const topbar = UI.el('header', 'topbar');
    topbar.innerHTML = `
      <div>
        <h1>Resultados</h1>
        <div class="subtitle">${subtitleText}</div>
      </div>
    `;
    main.appendChild(topbar);

    this.container = UI.el('div', 'results-months');
    for (const [, el] of this.mesesEls()) this.container.appendChild(el);
    main.appendChild(this.container);
  },

  // Um elemento por mes do indice, do mais recente para tras. Mes sem dias carregados: so o titulo, "a carregar…".
  // Mes incompleto (os 7 dias recentes podem ser so parte dele): contas a "—", nunca um parcial.
  mesesEls() {
    const porDia = this.groupByMonth();
    const chaves = this.porMes ? [...this.porMes.keys()] : porDia.map(([k]) => k);
    return chaves.map((monthKey, idx) => {
      const days = (porDia.find(([k]) => k === monthKey) || [, []])[1];
      const completo = !this.porMes || days.length >= this.porMes.get(monthKey).length;
      const monthStats = this.computeMonthStats(days);
      const parts = monthKey.split('-');
      const monthName = this.monthNames[parseInt(parts[1], 10) - 1];
      const year = parts[0];

      const monthEl = UI.el('div', 'month' + (idx === 0 ? ' is-open' : ''));
      monthEl.dataset.k = monthKey;
      monthEl.dataset.n = String(days.length);

      // Month head
      const head = UI.el('div', 'month-head');
      head.innerHTML = `
        <div class="month-title">
          ${this.chevSVG}
          ${monthName} ${year}
          <span class="badge">${days.length ? `${monthStats.dayCount} dias` : 'a carregar…'}</span>
        </div>
        ${days.length ? `<div class="month-summary">
          <div class="m"><span class="label">Acertos</span><span class="value num">${monthStats.totalHits}/${monthStats.totalTips}</span></div>
          <div class="m"><span class="label">Apostado</span><span class="value num">${this.formatUnits(monthStats.totalStaked, true)}</span></div>
          <div class="m"><span class="label">P/L</span><span class="value num" style="color:${monthStats.totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">${this.formatPL(monthStats.totalPL, true)}</span></div>
          <div class="m"><span class="label">ROI</span><span class="value num" style="color:${monthStats.roi >= 0 ? 'var(--green)' : 'var(--red)'}">${monthStats.roi.toFixed(1)}%</span></div>
        </div>` : ''}
      `;
      if (!completo) head.querySelectorAll('.month-summary .value, .month-title .badge').forEach(e => { e.textContent = '—'; e.style.color = 'inherit'; });
      if (!days.length) head.querySelector('.month-title .badge').textContent = 'a carregar…';
      head.addEventListener('click', () => monthEl.classList.toggle('is-open'));
      monthEl.appendChild(head);

      // Month body
      const body = UI.el('div', 'month-body');
      const dayGrid = UI.el('div', 'day-grid');
      days.forEach(day => dayGrid.appendChild(this.renderDay(day)));
      body.appendChild(dayGrid);
      monthEl.appendChild(body);
      return [monthKey, monthEl];
    });
  },

  renderDay(day) {
    const tips = this.flattenTips(day);
    const counts = this.dayCounts(day);
    const hits = counts.hits;
    const hitRate = counts.total > 0 ? (hits / counts.total * 100) : 0;
    const winPct = hitRate;
    const lossPct = 100 - winPct;

    const profit = Layout.dayStakes(day)?.summary?.profit || 0;
    const staked = Layout.dayStakes(day)?.summary?.total_staked || 0;

    const dateParts = this.parseDateParts(day.date);

    const dayEl = UI.el('div', 'day');
    dayEl.dataset.k = day.date;

    // Day head
    const head = UI.el('div', 'day-head');
    head.innerHTML = `
      <div class="day-date">
        <span class="d">${dateParts.day}</span>
        <span class="wd">${dateParts.weekday}</span>
      </div>
      <div class="day-rate">
        <div class="rate-bar">
          <div class="win" style="width:${winPct}%"></div>
          <div class="loss" style="width:${lossPct}%"></div>
        </div>
        <span class="num" style="font-size:12px;color:var(--text-2)">${hits}/${counts.total}</span>
      </div>
      ${/* O Hit% saiu daqui a 05/09/2026: dizia o mesmo que a barra e o `2/3`
             mesmo ao lado, e no telemovel era a UNICA metrica visivel — as
             regras escondiam a stake e o P/L, que e o que ele quer ver fechado. */''}
      <div class="day-metric is-staked">
        <span class="label">Apostado</span>
        <span class="value num">${this.formatUnits(staked, true)}</span>
      </div>
      <div class="day-metric is-pl">
        <span class="label">P/L</span>
        <span class="value num day-pl ${profit >= 0 ? 'pos' : 'neg'}">${this.formatPL(profit, true)}</span>
      </div>
      ${this.chevSVG}
    `;
    head.addEventListener('click', () => dayEl.classList.toggle('is-open'));
    dayEl.appendChild(head);

    // Day body
    const body = UI.el('div', 'day-body');

    // Match tips with stakes bets for odds/P&L
    const stakeBets = Layout.dayStakes(day)?.bets || [];
    const sum = Layout.dayStakes(day)?.summary || {};

    // Source split summary (pre-game vs live)
    const hasSplit = (sum.model_bets || sum.model_staked) && (sum.live_bets || sum.live_staked);
    if (hasSplit) {
      const modelBets = sum.model_bets ?? 0;
      const modelWins = sum.model_wins ?? 0;
      const modelProfit = sum.model_profit ?? 0;
      const modelRoi = sum.model_roi ?? 0;
      const liveBets = sum.live_bets ?? 0;
      const liveWins = sum.live_wins ?? 0;
      const liveProfit = sum.live_profit ?? 0;
      const liveRoi = sum.live_roi ?? 0;
      const split = UI.el('div', 'src-split');
      split.innerHTML = `
        <div class="src-split__item">
          <span class="src-tag src-pre">PRE</span>
          <span class="src-split__stat">${modelWins}/${modelBets}</span>
          <span class="src-split__pl num ${modelProfit >= 0 ? 'pos' : 'neg'}">${this.formatPL(modelProfit)}</span>
          <span class="src-split__roi num">ROI ${modelRoi.toFixed(1)}%</span>
        </div>
        <div class="src-split__item is-notional" title="Alertas do bot live. Nocional: nao entra na banca.">
          <span class="src-tag src-live">LIVE</span>
          <span class="src-split__stat">${liveWins}/${liveBets}</span>
          <span class="src-split__pl num ${liveProfit >= 0 ? 'pos' : 'neg'}">${this.formatPL(liveProfit)}</span>
          <span class="src-split__roi num">ROI ${liveRoi.toFixed(1)}%</span>
          <span class="src-split__note">nocional</span>
        </div>
      `;
      body.appendChild(split);
    }

    // Build bet rows from stakes.bets (has odds, stake, P/L)
    if (stakeBets.length > 0) {
      stakeBets.forEach(bet => {
        const row = UI.el('div', 'day-row' + (bet.source === 'live' ? ' is-live' : ''));
        const marketKey = this.detectMarketKey(bet.market);
        const marketColor = this.marketColors[marketKey] || 'var(--text-3)';
        const isWin = bet.result === 'win';
        const isPush = bet.result === 'push';
        // Alertas live nem sempre tem odd registada; nesses casos o P/L nao e
        // mensuravel e a linha mostra "—" em vez de um numero inventado.
        const hasOdds = typeof bet.odds === 'number' && isFinite(bet.odds);
        const betPL = !hasOdds ? null : (isPush ? 0 : (isWin ? (bet.stake * bet.odds - bet.stake) : -bet.stake));
        const resLabel = isPush ? 'PUSH' : (isWin ? 'GREEN' : 'RED');
        const resClass = isPush ? 'push' : (isWin ? 'green' : 'red');
        const isLive = bet.source === 'live';
        const srcBadge = isLive
          ? '<span class="src-tag src-live" title="Aposta live (bot Telegram)">LIVE</span>'
          : '<span class="src-tag src-pre" title="Aposta pre-game (modelo)">PRE</span>';
        const plClass = (betPL == null || isPush) ? '' : (betPL >= 0 ? 'pos' : 'neg');
        const plText = betPL == null ? '—' : (isPush ? '0 st' : this.formatPL(betPL, true));

        // Acumulador: o resumo numa linha, as pernas por baixo a pedido. No
        // telemovel a linha unica mostrava `Fredrikstad vs Bodo/Gli…` e mais
        // nada — o nome do primeiro jogo cortado a meio a fazer de resumo de
        // tres apostas. As pernas ja vinham nos dados, so nao chegavam aqui.
        const legs = Array.isArray(bet.legs) ? bet.legs : [];
        if (legs.length > 0) {
          const acc = UI.el('div', 'acc');
          row.classList.add('is-acc');
          const nome = bet.label === 'multipla-jornada' ? bet.nome || `🎯 Múltipla da jornada${bet.variante ? ` ${bet.variante}` : ''}` : bet.label ? `Acumulador ${bet.label}` : 'Acumulador';
          const pernas = `${legs.length} pernas`;
          row.innerHTML = `
            <span class="mkt" style="color:var(--m-acc)">${srcBadge}${this.esc(nome)}</span>
            <span class="match">${pernas}${bet.bookmaker ? ` · ${this.esc(bet.bookmaker)}` : ''}${this.chevSVG}</span>
            <span class="pick">${this.esc(legs.map(l => l.pick).join(' + '))}</span>
            <span class="odd num">${hasOdds ? bet.odds.toFixed(2) : '—'}</span>
            <span class="res ${resClass}">${resLabel}</span>
            <span class="pl num ${plClass}">${plText}</span>
          `;
          const legsEl = UI.el('div', 'acc-legs');
          legsEl.innerHTML = legs.map(l => {
            const lr = (l.result || '').toUpperCase();
            const lc = lr === 'GREEN' ? 'green' : (lr === 'RED' ? 'red' : 'pending');
            const lo = typeof l.odds === 'number' && isFinite(l.odds) ? l.odds.toFixed(2) : '—';
            return `
              <div class="acc-leg is-${lc}">
                <span class="leg-match">${this.esc(l.match)}</span>
                <span class="leg-odd num">${lo}</span>
                <span class="leg-pick">${this.esc(l.pick)}</span>
                <span class="leg-score num">${l.final_score ? this.esc(l.final_score) : ''}</span>
              </div>`;
          }).join('');
          if (bet.note) {
            legsEl.innerHTML += `<div class="acc-note">${this.esc(bet.note)}</div>`;
          }
          row.addEventListener('click', () => acc.classList.toggle('is-open'));
          acc.appendChild(row);
          acc.appendChild(legsEl);
          body.appendChild(acc);
          return;
        }

        row.innerHTML = `
          <span class="mkt" style="color:${marketColor}">${srcBadge}${bet.market}</span>
          <span class="match">${bet.matches}</span>
          <span class="pick">${bet.type}</span>
          <span class="odd num">${hasOdds ? bet.odds.toFixed(2) : '—'}</span>
          <span class="res ${resClass}">${resLabel}</span>
          <span class="pl num ${plClass}">${plText}</span>
        `;
        body.appendChild(row);
      });
    } else {
      // Fallback: show flattened tips without stakes detail
      tips.forEach(tip => {
        const row = UI.el('div', 'day-row');
        const marketColor = this.marketColors[tip.market] || 'var(--text-3)';
        row.innerHTML = `
          <span class="mkt" style="color:${marketColor}">${this.marketLabels[tip.market] || tip.market}</span>
          <span class="match">${tip.home} vs ${tip.away}</span>
          <span class="pick">${tip.pick}</span>
          <span class="odd num">—</span>
          <span class="res ${tip.hit ? 'green' : 'red'}">${tip.hit ? 'GREEN' : 'RED'}</span>
          <span class="pl num">—</span>
        `;
        body.appendChild(row);
      });
    }

    dayEl.appendChild(body);
    return dayEl;
  },

  // Os dados sao nossos, mas as notas dos acumuladores sao texto livre escrito
  // por um agente e vao para innerHTML. Escapar e mais barato do que confiar.
  esc(v) {
    if (v == null) return '';
    return String(v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  },

  detectMarketKey(marketStr) {
    if (!marketStr) return '';
    const lower = marketStr.toLowerCase();
    if (lower.includes('btts') || lower.includes('ambas')) return 'btts';
    // Antes do over: "Remates à baliza" nao e golos.
    if (lower.includes('baliza')) return 'baliza';
    if (lower.includes('over 2.5') || lower.includes('over2.5')) return 'over25';
    if (lower.includes('cart') || lower.includes('card')) return 'cards';
    if (lower.includes('cant') || lower.includes('corner')) return 'corners';
    if (lower.includes('over')) return 'over25';
    return '';
  },

  formatShortDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDate() + ' ' + this.monthNames[d.getMonth()].substring(0, 3);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => ResultsPage.init());
