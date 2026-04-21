// Trincheira BET — Analytics Page
const AnalyticsPage = {
  allDays: [],
  filteredDays: [],
  currentMonth: null, // { year, month } — 0-indexed month
  main: null,

  MONTHS_PT: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  WEEKDAYS_PT: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],

  // ─── Data Loading ───────────────────────────────────────────
  async loadAllData() {
    try {
      const res = await fetch('resultados/data/index.json');
      if (!res.ok) return [];
      const index = await res.json();
      const promises = index.files.map(f =>
        fetch('resultados/data/' + f).then(r => r.ok ? r.json() : null).catch(() => null)
      );
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    } catch (e) {
      console.error('Failed to load data:', e);
      return [];
    }
  },

  // ─── Market Classification ──────────────────────────────────
  classifyMarket(marketStr) {
    if (!marketStr) return 'other';
    const m = marketStr.toLowerCase();
    if (m === 'btts' || m.includes('ambas marcam')) return 'btts';
    if (m.includes('over 2.5') && !m.includes('cart') && !m.includes('cant')) return 'over25';
    if (m.includes('cartoes') || m.includes('cartões') || m.includes('cart')) return 'cards';
    if (m.includes('cantos') || m.includes('corner')) return 'corners';
    if (m.includes('over')) return 'over25';
    return 'other';
  },

  marketLabel(key) {
    const labels = { btts: 'BTTS', over25: 'Over 2.5', cards: 'Cartões', corners: 'Cantos' };
    return labels[key] || key;
  },

  marketColor(key) {
    const colors = { btts: 'var(--m-btts)', over25: 'var(--m-over)', cards: 'var(--m-cards)', corners: 'var(--m-corners)' };
    return colors[key] || 'var(--text-3)';
  },

  // ─── Odds Tier Classification ───────────────────────────────
  oddsTier(odds) {
    if (odds <= 1.60) return { key: 'safe', label: 'Seguro', range: '≤1.60' };
    if (odds <= 1.85) return { key: 'fair', label: 'Valor justo', range: '1.61–1.85' };
    if (odds <= 2.10) return { key: 'high', label: 'Valor alto', range: '1.86–2.10' };
    return { key: 'long', label: 'Longshot', range: '>2.10' };
  },

  // ─── Stake Tier Classification ──────────────────────────────
  stakeTier(stake) {
    if (stake <= 2) return { key: 's1', label: '€1–2', range: '≤€2' };
    if (stake <= 4) return { key: 's2', label: '€3–4', range: '€3–4' };
    if (stake <= 6) return { key: 's3', label: '€5–6', range: '€5–6' };
    return { key: 's4', label: '€7+', range: '≥€7' };
  },

  // ─── Aggregation ────────────────────────────────────────────
  aggregate(days) {
    const result = {
      totalPL: 0,
      totalStaked: 0,
      totalBets: 0,
      wins: 0,
      losses: 0,
      bankrollSeries: [],
      byMarket: {},
      byLeague: {},
      byOddsTier: {},
      byStakeTier: {},
      dailyPL: [],
      bestDay: { pl: -Infinity, date: '' },
      worstDay: { pl: Infinity, date: '' },
      streak: 0
    };

    for (const day of days) {
      const s = day.stakes;
      if (!s) continue;

      const dayProfit = s.summary?.profit || 0;
      const dayDate = day.date;

      result.totalPL += dayProfit;
      result.totalStaked += s.summary?.total_staked || 0;
      result.totalBets += s.summary?.total_bets || 0;
      result.wins += s.summary?.wins || 0;
      result.losses += s.summary?.losses || 0;

      if (s.balance != null) {
        result.bankrollSeries.push({ date: dayDate, balance: s.balance });
      }

      result.dailyPL.push({ date: dayDate, pl: dayProfit });

      if (dayProfit > result.bestDay.pl) {
        result.bestDay = { pl: dayProfit, date: dayDate };
      }
      if (dayProfit < result.worstDay.pl) {
        result.worstDay = { pl: dayProfit, date: dayDate };
      }

      // Process individual bets
      if (s.bets) {
        for (const bet of s.bets) {
          const mkt = this.classifyMarket(bet.market);
          const isWin = bet.result === 'win';
          const pl = (bet.return || 0) - (bet.stake || 0);

          // By market
          if (!result.byMarket[mkt]) result.byMarket[mkt] = { wins: 0, total: 0, pl: 0 };
          result.byMarket[mkt].total++;
          if (isWin) result.byMarket[mkt].wins++;
          result.byMarket[mkt].pl += pl;

          // By odds tier
          const ot = this.oddsTier(bet.odds || 0);
          if (!result.byOddsTier[ot.key]) result.byOddsTier[ot.key] = { wins: 0, total: 0, pl: 0, staked: 0, label: ot.label, range: ot.range };
          result.byOddsTier[ot.key].total++;
          if (isWin) result.byOddsTier[ot.key].wins++;
          result.byOddsTier[ot.key].pl += pl;
          result.byOddsTier[ot.key].staked += bet.stake || 0;

          // By stake tier
          const st = this.stakeTier(bet.stake || 0);
          if (!result.byStakeTier[st.key]) result.byStakeTier[st.key] = { wins: 0, total: 0, pl: 0, staked: 0, label: st.label, range: st.range };
          result.byStakeTier[st.key].total++;
          if (isWin) result.byStakeTier[st.key].wins++;
          result.byStakeTier[st.key].pl += pl;
          result.byStakeTier[st.key].staked += bet.stake || 0;
        }
      }

      // Extract leagues from tip data
      const tipSections = ['btts', 'cards', 'over25', 'corners'];
      for (const sec of tipSections) {
        if (!day[sec]?.tips) continue;
        for (const tip of day[sec].tips) {
          const league = tip.league || 'Desconhecida';
          if (!result.byLeague[league]) result.byLeague[league] = { tips: 0, wins: 0, pl: 0 };
          result.byLeague[league].tips++;
          const isHit = tip.btts_hit || tip.hit;
          if (isHit) result.byLeague[league].wins++;
        }
      }

      // Approximate league P/L from bets
      if (s.bets) {
        for (const bet of s.bets) {
          // Try to match bet to a league via match name
          const matchName = bet.matches || '';
          for (const sec of tipSections) {
            if (!day[sec]?.tips) continue;
            for (const tip of day[sec].tips) {
              const tipMatch = (tip.home || '') + ' vs ' + (tip.away || '');
              if (matchName.includes(tip.home) || matchName.includes(tip.away)) {
                const league = tip.league || 'Desconhecida';
                if (result.byLeague[league]) {
                  result.byLeague[league].pl += (bet.return || 0) - (bet.stake || 0);
                }
                break;
              }
            }
          }
        }
      }
    }

    // Compute streak (consecutive profitable days from end)
    let streak = 0;
    for (let i = result.dailyPL.length - 1; i >= 0; i--) {
      if (result.dailyPL[i].pl > 0) streak++;
      else break;
    }
    result.streak = streak;

    return result;
  },

  // ─── Available Months ───────────────────────────────────────
  getAvailableMonths() {
    const months = new Map();
    for (const day of this.allDays) {
      const d = new Date(day.date);
      const key = d.getFullYear() + '-' + String(d.getMonth()).padStart(2, '0');
      if (!months.has(key)) {
        months.set(key, { year: d.getFullYear(), month: d.getMonth(), count: 0 });
      }
      months.get(key).count++;
    }
    return Array.from(months.values());
  },

  filterByMonth(year, month) {
    return this.allDays.filter(d => {
      const dt = new Date(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month;
    });
  },

  // ─── Sparkline SVG ──────────────────────────────────────────
  renderSparkline(values, color, width, height) {
    if (!values.length) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => [
      (i / Math.max(1, values.length - 1)) * width,
      height - ((v - min) / range) * height
    ]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = path + ` L ${width},${height} L 0,${height} Z`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#sg)"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  },

  // ─── Bankroll Line Chart SVG ────────────────────────────────
  renderBankrollChart(series) {
    if (!series.length) return '<div style="color:var(--text-3);font-size:13px;padding:var(--sp-5)">Sem dados de bankroll</div>';

    const W = 600, H = 220, padL = 52, padR = 16, padT = 16, padB = 32;
    const cW = W - padL - padR, cH = H - padT - padB;
    const values = series.map(s => s.balance);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
      const x = padL + (i / Math.max(1, values.length - 1)) * cW;
      const y = padT + cH - ((v - min) / range) * cH;
      return [x, y];
    });

    const polyline = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const areaPath = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
      + ` L ${pts[pts.length - 1][0].toFixed(1)},${padT + cH} L ${pts[0][0].toFixed(1)},${padT + cH} Z`;

    // Y-axis ticks (5 ticks)
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
      const val = min + (range * i / 4);
      const y = padT + cH - (i / 4) * cH;
      ticks.push({ val, y });
    }

    // X-axis labels (show first, middle, last)
    const xLabels = [];
    if (series.length >= 1) {
      const indices = [0];
      if (series.length > 2) indices.push(Math.floor(series.length / 2));
      if (series.length > 1) indices.push(series.length - 1);
      for (const idx of indices) {
        const x = padL + (idx / Math.max(1, series.length - 1)) * cW;
        const d = new Date(series[idx].date);
        xLabels.push({ x, label: d.getDate() + '/' + (d.getMonth() + 1) });
      }
    }

    const lastPt = pts[pts.length - 1];
    const lineColor = values[values.length - 1] >= values[0] ? 'var(--green)' : 'var(--accent)';

    return `<svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block">
      <defs>
        <linearGradient id="bankroll-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Grid lines -->
      ${ticks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${t.y.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`).join('')}
      <!-- Y labels -->
      ${ticks.map(t => `<text x="${padL - 8}" y="${(t.y + 4).toFixed(1)}" fill="var(--text-3)" font-size="10" font-family="var(--font-mono)" text-anchor="end">€${t.val.toFixed(0)}</text>`).join('')}
      <!-- X labels -->
      ${xLabels.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 6}" fill="var(--text-3)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">${l.label}</text>`).join('')}
      <!-- Area fill -->
      <path d="${areaPath}" fill="url(#bankroll-grad)"/>
      <!-- Line -->
      <polyline points="${polyline}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- End dot -->
      <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="4" fill="${lineColor}" stroke="var(--bg-elev-2)" stroke-width="2"/>
    </svg>`;
  },

  // ─── Format helpers ─────────────────────────────────────────
  fmtPL(val) {
    if (val == null || isNaN(val)) return '€0.00';
    const sign = val >= 0 ? '+' : '';
    return sign + '€' + val.toFixed(2);
  },

  fmtPct(val) {
    if (val == null || isNaN(val)) return '0%';
    return val.toFixed(1) + '%';
  },

  plClass(val) {
    if (val > 0) return 'pos';
    if (val < 0) return 'neg';
    return '';
  },

  fmtShortDate(dateStr) {
    const d = new Date(dateStr);
    return d.getDate() + ' ' + this.MONTHS_PT[d.getMonth()].slice(0, 3);
  },

  // ─── Render: Topbar with Month Filter ───────────────────────
  renderTopbar(agg) {
    const months = this.getAvailableMonths();
    const now = new Date();
    const curKey = this.currentMonth.year + '-' + this.currentMonth.month;
    const thisMonthKey = now.getFullYear() + '-' + now.getMonth();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.getFullYear() + '-' + lastMonth.getMonth();

    const tipCount = this.filteredDays.reduce((sum, d) => {
      return sum + (d.stakes?.summary?.total_bets || 0);
    }, 0);

    const monthName = this.MONTHS_PT[this.currentMonth.month] + ' ' + this.currentMonth.year;

    // Build month picker options
    const monthOptions = months.map(m => {
      const k = m.year + '-' + m.month;
      const label = this.MONTHS_PT[m.month] + ' ' + m.year;
      return `<option value="${k}" ${k === curKey ? 'selected' : ''}>${label}</option>`;
    }).join('');

    return `<div class="topbar">
      <div>
        <h1>Analytics</h1>
        <div class="subtitle">${monthName} &middot; ${tipCount} apostas</div>
      </div>
      <div class="topbar-actions">
        <button class="chip ${curKey === thisMonthKey ? 'is-active' : ''}" data-filter="this"">Este mês</button>
        <button class="chip ${curKey === lastMonthKey ? 'is-active' : ''}" data-filter="last">Mês passado</button>
        <select class="btn btn--sm btn--ghost" id="month-picker" style="font-size:13px;background:var(--bg-elev-2)">
          ${monthOptions}
        </select>
      </div>
    </div>`;
  },

  // ─── Render: Hero Metrics ───────────────────────────────────
  renderHeroMetrics(agg) {
    const roi = agg.totalStaked > 0 ? (agg.totalPL / agg.totalStaked * 100) : 0;
    const hitRate = agg.totalBets > 0 ? (agg.wins / agg.totalBets * 100) : 0;
    const bankrollValues = agg.bankrollSeries.map(s => s.balance);
    const plColor = agg.totalPL >= 0 ? 'var(--green)' : 'var(--accent)';

    return `<div class="hero-metrics">
      <div class="metric is-hero">
        <div class="label">P/L do mês</div>
        <div class="value num" style="color:${plColor}">${this.fmtPL(agg.totalPL)}</div>
        <div class="delta ${this.plClass(roi)}">ROI ${this.fmtPct(roi)}</div>
        <div class="sparkline">${this.renderSparkline(bankrollValues, plColor, 180, 40)}</div>
      </div>
      <div class="metric">
        <div class="label">Hit Rate</div>
        <div class="value num">${this.fmtPct(hitRate)}</div>
        <div class="delta" style="color:var(--text-3)">${agg.wins}/${agg.totalBets} apostas</div>
      </div>
      <div class="metric">
        <div class="label">Streak</div>
        <div class="value num" style="color:${agg.streak > 0 ? 'var(--green)' : 'var(--text-2)'}">${agg.streak} ${agg.streak === 1 ? 'dia' : 'dias'}</div>
        <div class="delta" style="color:var(--text-3)">consecutivos c/ lucro</div>
      </div>
      <div class="metric">
        <div class="label">Melhor / Pior dia</div>
        <div class="value" style="display:flex;flex-direction:column;gap:4px;font-size:16px">
          <span class="num" style="color:var(--green)">${agg.bestDay.pl > -Infinity ? this.fmtPL(agg.bestDay.pl) : '—'}</span>
          <span class="num" style="color:var(--accent)">${agg.worstDay.pl < Infinity ? this.fmtPL(agg.worstDay.pl) : '—'}</span>
        </div>
        <div class="delta" style="color:var(--text-3);font-size:11px">
          ${agg.bestDay.date ? this.fmtShortDate(agg.bestDay.date) : ''} / ${agg.worstDay.date ? this.fmtShortDate(agg.worstDay.date) : ''}
        </div>
      </div>
    </div>`;
  },

  // ─── Render: Bankroll Chart Panel ───────────────────────────
  renderBankrollPanel(agg) {
    const lastBal = agg.bankrollSeries.length ? agg.bankrollSeries[agg.bankrollSeries.length - 1].balance : null;
    return `<div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Curva de Bankroll</div>
          <div class="panel-subtitle">${agg.bankrollSeries.length} dias registados${lastBal != null ? ' &middot; Atual: €' + lastBal.toFixed(2) : ''}</div>
        </div>
      </div>
      <div class="pl-chart">${this.renderBankrollChart(agg.bankrollSeries)}</div>
    </div>`;
  },

  // ─── Render: Market Hit Rate Bars ───────────────────────────
  renderMarketBars(agg) {
    const markets = ['btts', 'over25', 'cards', 'corners'];
    let bars = '';

    for (const mkt of markets) {
      const data = agg.byMarket[mkt];
      if (!data || data.total === 0) continue;
      const pct = (data.wins / data.total * 100);
      const color = this.marketColor(mkt);

      bars += `<div class="mkt-bar">
        <div class="mname"><span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block;flex-shrink:0"></span> ${this.marketLabel(mkt)}</div>
        <div class="track"><div class="fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
        <div class="stat">${pct.toFixed(1)}% &middot; ${data.wins}/${data.total}</div>
      </div>`;
    }

    if (!bars) bars = '<div style="color:var(--text-3);font-size:13px">Sem dados</div>';

    return `<div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Hit rate por mercado</div>
          <div class="panel-subtitle">Performance de cada mercado</div>
        </div>
      </div>
      <div class="mkt-bars">${bars}</div>
    </div>`;
  },

  // ─── Render: League Table ───────────────────────────────────
  renderLeagueTable(agg) {
    const leagues = Object.entries(agg.byLeague)
      .map(([name, data]) => ({
        name,
        tips: data.tips,
        hitPct: data.tips > 0 ? (data.wins / data.tips * 100) : 0,
        pl: data.pl || 0
      }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 12);

    if (!leagues.length) {
      return `<div class="panel">
        <div class="panel-head"><div><div class="panel-title">Liga performance</div></div></div>
        <div style="color:var(--text-3);font-size:13px">Sem dados de ligas</div>
      </div>`;
    }

    let rows = `<div class="league-row head">
      <div>Liga</div><div>Tips</div><div>Hit%</div><div>P/L</div>
    </div>`;

    for (const l of leagues) {
      const plColor = l.pl >= 0 ? 'var(--green)' : 'var(--accent)';
      rows += `<div class="league-row">
        <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.name}</div>
        <div>${l.tips}</div>
        <div>${l.hitPct.toFixed(1)}%</div>
        <div style="color:${plColor}">${this.fmtPL(l.pl)}</div>
      </div>`;
    }

    return `<div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Liga performance</div>
          <div class="panel-subtitle">Ordenado por P/L</div>
        </div>
      </div>
      <div class="league-table">${rows}</div>
    </div>`;
  },

  // ─── Render: Odds Tier Chart ────────────────────────────────
  renderOddsTier(agg) {
    const order = ['safe', 'fair', 'high', 'long'];
    const tierColors = {
      safe: 'var(--green)',
      fair: 'var(--accent)',
      high: 'var(--amber)',
      long: 'var(--violet)'
    };

    let rows = '';
    for (const key of order) {
      const t = agg.byOddsTier[key];
      if (!t || t.total === 0) continue;
      const hitPct = (t.wins / t.total * 100);
      const roi = t.staked > 0 ? (t.pl / t.staked * 100) : 0;
      const color = tierColors[key] || 'var(--text-3)';
      const maxBets = Math.max(...order.map(k => agg.byOddsTier[k]?.total || 0), 1);
      const volPct = (t.total / maxBets * 100);

      rows += `<div style="display:grid;grid-template-columns:90px 1fr;gap:var(--sp-3);align-items:start;padding:var(--sp-3) 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:500">${t.label}</div>
          <div style="font-size:11px;color:var(--text-3);font-family:var(--font-mono)">${t.range}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="flex:1;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden">
              <div style="width:${hitPct.toFixed(1)}%;height:100%;background:${color};border-radius:3px"></div>
            </div>
            <span class="num" style="font-size:12px;color:var(--text-2);min-width:44px;text-align:right">${hitPct.toFixed(1)}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="flex:1;height:4px;background:var(--bg-inset);border-radius:2px;overflow:hidden">
              <div style="width:${volPct.toFixed(1)}%;height:100%;background:var(--text-4);border-radius:2px"></div>
            </div>
            <span class="num" style="font-size:11px;color:var(--text-3);min-width:44px;text-align:right">${t.total} bets</span>
          </div>
          <div style="display:flex;gap:var(--sp-4);font-family:var(--font-mono);font-size:11px">
            <span style="color:${t.pl >= 0 ? 'var(--green)' : 'var(--accent)'}">${this.fmtPL(t.pl)}</span>
            <span style="color:var(--text-3)">ROI ${roi.toFixed(1)}%</span>
          </div>
        </div>
      </div>`;
    }

    if (!rows) rows = '<div style="color:var(--text-3);font-size:13px;padding:var(--sp-3)">Sem dados</div>';

    return `<div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Hit rate por odd</div>
          <div class="panel-subtitle">Performance por faixa de odds</div>
        </div>
      </div>
      <div>${rows}</div>
    </div>`;
  },

  // ─── Render: Stake Tier Chart ───────────────────────────────
  renderStakeTier(agg) {
    const order = ['s1', 's2', 's3', 's4'];
    const tierColors = {
      s1: 'var(--text-3)',
      s2: 'var(--accent)',
      s3: 'var(--amber)',
      s4: 'var(--green)'
    };

    let rows = '';
    for (const key of order) {
      const t = agg.byStakeTier[key];
      if (!t || t.total === 0) continue;
      const hitPct = (t.wins / t.total * 100);
      const roi = t.staked > 0 ? (t.pl / t.staked * 100) : 0;
      const color = tierColors[key] || 'var(--text-3)';
      const maxBets = Math.max(...order.map(k => agg.byStakeTier[k]?.total || 0), 1);
      const volPct = (t.total / maxBets * 100);

      rows += `<div style="display:grid;grid-template-columns:90px 1fr;gap:var(--sp-3);align-items:start;padding:var(--sp-3) 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:500">${t.label}</div>
          <div style="font-size:11px;color:var(--text-3);font-family:var(--font-mono)">${t.range}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="flex:1;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden">
              <div style="width:${hitPct.toFixed(1)}%;height:100%;background:${color};border-radius:3px"></div>
            </div>
            <span class="num" style="font-size:12px;color:var(--text-2);min-width:44px;text-align:right">${hitPct.toFixed(1)}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="flex:1;height:4px;background:var(--bg-inset);border-radius:2px;overflow:hidden">
              <div style="width:${volPct.toFixed(1)}%;height:100%;background:var(--text-4);border-radius:2px"></div>
            </div>
            <span class="num" style="font-size:11px;color:var(--text-3);min-width:44px;text-align:right">${t.total} bets</span>
          </div>
          <div style="display:flex;gap:var(--sp-4);font-family:var(--font-mono);font-size:11px">
            <span style="color:${t.pl >= 0 ? 'var(--green)' : 'var(--accent)'}">${this.fmtPL(t.pl)}</span>
            <span style="color:var(--text-3)">ROI ${roi.toFixed(1)}%</span>
          </div>
        </div>
      </div>`;
    }

    if (!rows) rows = '<div style="color:var(--text-3);font-size:13px;padding:var(--sp-3)">Sem dados</div>';

    return `<div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Hit rate por stake</div>
          <div class="panel-subtitle">Performance por montante apostado</div>
        </div>
      </div>
      <div>${rows}</div>
    </div>`;
  },

  // ─── Render Full Page ───────────────────────────────────────
  renderPage() {
    this.filteredDays = this.filterByMonth(this.currentMonth.year, this.currentMonth.month);
    const agg = this.aggregate(this.filteredDays);

    this.main.innerHTML = Layout.renderMobileBrand() + `
      ${this.renderTopbar(agg)}
      ${this.renderHeroMetrics(agg)}
      <div class="panels">
        ${this.renderBankrollPanel(agg)}
        ${this.renderMarketBars(agg)}
      </div>
      <div class="panels-2">
        ${this.renderLeagueTable(agg)}
        ${this.renderOddsTier(agg)}
      </div>
      <div class="panels-1">
        ${this.renderStakeTier(agg)}
      </div>
    `;

    this.bindFilters();
  },

  // ─── Filter Event Binding ───────────────────────────────────
  bindFilters() {
    // Chip buttons
    const chips = this.main.querySelectorAll('.chip[data-filter]');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        const now = new Date();
        if (filter === 'this') {
          this.currentMonth = { year: now.getFullYear(), month: now.getMonth() };
        } else if (filter === 'last') {
          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          this.currentMonth = { year: prev.getFullYear(), month: prev.getMonth() };
        }
        this.renderPage();
      });
    });

    // Month picker dropdown
    const picker = document.getElementById('month-picker');
    if (picker) {
      picker.addEventListener('change', () => {
        const [year, month] = picker.value.split('-').map(Number);
        this.currentMonth = { year, month };
        this.renderPage();
      });
    }
  },

  // ─── Init ───────────────────────────────────────────────────
  async init() {
    // Load bankroll data and init layout
    const { bankroll, totalPL } = await Layout.loadBankrollData();
    this.main = Layout.init('analytics', bankroll, totalPL);
    if (!this.main) return;

    // Show loading state
    this.main.innerHTML = Layout.renderMobileBrand() + `
      <div class="topbar"><div><h1>Analytics</h1><div class="subtitle">A carregar dados...</div></div></div>
      <div class="hero-metrics">
        <div class="metric skeleton" style="height:140px"></div>
        <div class="metric skeleton" style="height:140px"></div>
        <div class="metric skeleton" style="height:140px"></div>
        <div class="metric skeleton" style="height:140px"></div>
      </div>
    `;

    // Load all data
    this.allDays = await this.loadAllData();

    // Determine current month filter (default to latest month with data)
    if (this.allDays.length) {
      const latest = new Date(this.allDays[this.allDays.length - 1].date);
      this.currentMonth = { year: latest.getFullYear(), month: latest.getMonth() };
    } else {
      const now = new Date();
      this.currentMonth = { year: now.getFullYear(), month: now.getMonth() };
    }

    this.renderPage();
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => AnalyticsPage.init());
