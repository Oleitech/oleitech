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
  },

  marketLabels: {
    btts: 'BTTS',
    over25: 'Over 2.5',
    cards: 'Cartões',
    corners: 'Cantos',
  },

  chevSVG: '<svg class="chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 6l6 6-6 6" stroke-width="1.8" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',

  async init() {
    // Load bankroll data and init layout
    const totalPL = await Layout.loadTotalPL();
    const main = Layout.init('results', totalPL);
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

    // Load all data
    await this.loadData();

    // Render page
    this.render(main);
  },

  async loadData() {
    try {
      // `no-store` como no app.js. Sem isto o browser servia ficheiros da sua
      // cache e o dia publicado so aparecia horas depois; desde a migracao
      // para stakes (31/08/2026) o efeito e pior, porque uma cache morna
      // mistura ficheiros novos (stakes) com antigos (euros) e o total do topo
      // fica sem sentido.
      const res = await fetch(bustCache('resultados/data/index.json'), { cache: 'no-store' });
      if (!res.ok) return;
      const index = await res.json();
      if (!index.files || !index.files.length) return;

      // Load all day files in parallel
      const promises = index.files.map(async (f) => {
        try {
          const r = await fetch(bustCache('resultados/data/' + f), { cache: 'no-store' });
          if (!r.ok) return null;
          return await r.json();
        } catch (e) { return null; }
      });

      const results = await Promise.all(promises);
      this.days = results.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) {
      console.error('Failed to load results data:', e);
    }
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

    return { totalTips, totalHits, hitRate, totalPL, roi, dayCount: days.length };
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

  render(main) {
    const stats = this.computeStats();
    const months = this.groupByMonth();

    // "apostas" e nao "tips": a contagem inclui acumuladores e alertas live.
    const subtitleText = `${stats.totalTips} apostas &middot; ${stats.hitRate.toFixed(1)}% hit rate &middot; ${stats.roi.toFixed(1)}% ROI`;

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

    // Month groups
    const container = UI.el('div', 'results-months');
    months.forEach(([monthKey, days], idx) => {
      const monthStats = this.computeMonthStats(days);
      const parts = monthKey.split('-');
      const monthName = this.monthNames[parseInt(parts[1], 10) - 1];
      const year = parts[0];
      const isFirst = idx === 0;

      const monthEl = UI.el('div', 'month' + (isFirst ? ' is-open' : ''));

      // Month head
      const head = UI.el('div', 'month-head');
      head.innerHTML = `
        <div class="month-title">
          ${this.chevSVG}
          ${monthName} ${year}
          <span class="badge">${monthStats.dayCount} dias</span>
        </div>
        <div class="month-summary">
          <div class="m"><span class="label">Apostas</span><span class="value num">${monthStats.totalTips}</span></div>
          <div class="m"><span class="label">Hit%</span><span class="value num">${monthStats.hitRate.toFixed(1)}%</span></div>
          <div class="m"><span class="label">ROI</span><span class="value num" style="color:${monthStats.roi >= 0 ? 'var(--green)' : 'var(--red)'}">${monthStats.roi.toFixed(1)}%</span></div>
          <div class="m"><span class="label">P/L</span><span class="value num" style="color:${monthStats.totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">${this.formatPL(monthStats.totalPL)}</span></div>
        </div>
      `;
      head.addEventListener('click', () => monthEl.classList.toggle('is-open'));
      monthEl.appendChild(head);

      // Month body
      const body = UI.el('div', 'month-body');
      const dayGrid = UI.el('div', 'day-grid');

      days.forEach(day => {
        dayGrid.appendChild(this.renderDay(day));
      });

      body.appendChild(dayGrid);
      monthEl.appendChild(body);
      container.appendChild(monthEl);
    });

    main.appendChild(container);
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
      <div class="day-metric">
        <span class="label">Hit%</span>
        <span class="value num">${hitRate.toFixed(0)}%</span>
      </div>
      <div class="day-metric">
        <span class="label">Stake</span>
        <span class="value num">${this.formatUnits(staked, true)}</span>
      </div>
      <div class="day-metric">
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

  detectMarketKey(marketStr) {
    if (!marketStr) return '';
    const lower = marketStr.toLowerCase();
    if (lower.includes('btts') || lower.includes('ambas')) return 'btts';
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
