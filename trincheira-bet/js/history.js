const History = {
  data: [],
  dataPath: 'resultados/data/',

  async init() {
    await this.loadData();
    this.render();
  },

  async loadData() {
    // Load the index of available result files
    try {
      const response = await fetch(this.dataPath + 'index.json');
      if (!response.ok) throw new Error('No index');
      const index = await response.json();

      const results = [];
      for (const file of index.files) {
        try {
          const res = await fetch(this.dataPath + file);
          if (res.ok) results.push(await res.json());
        } catch (e) { /* skip bad files */ }
      }
      this.data = results.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      // Fallback: try loading from localStorage
      const stored = localStorage.getItem('trincheira_history');
      if (stored) {
        this.data = JSON.parse(stored);
      }
    }
  },

  // Add results manually (used when JSON files aren't served)
  addDay(dayData) {
    const existing = this.data.findIndex(d => d.date === dayData.date);
    if (existing >= 0) {
      this.data[existing] = dayData;
    } else {
      this.data.push(dayData);
    }
    this.data.sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem('trincheira_history', JSON.stringify(this.data));
    this.render();
  },

  getOverallStats() {
    let bttsTotal = 0, bttsGreen = 0;
    let cornersTotal = 0, cornersGreen = 0;
    let cardsTotal = 0, cardsGreen = 0;
    let over25Total = 0, over25Green = 0;
    let totalStaked = 0, totalReturn = 0, totalBets = 0, totalWins = 0;
    let days = this.data.length;
    let streak = 0;
    let bestDay = null;

    for (const day of this.data) {
      if (day.btts?.summary) {
        bttsTotal += day.btts.summary.total;
        bttsGreen += day.btts.summary.green;
      }
      if (day.corners?.summary) {
        cornersTotal += day.corners.summary.total;
        cornersGreen += day.corners.summary.green;
      }
      if (day.cards?.summary) {
        cardsTotal += day.cards.summary.total;
        cardsGreen += day.cards.summary.green;
      }
      if (day.over25?.summary) {
        over25Total += day.over25.summary.total;
        over25Green += day.over25.summary.green;
      }
      if (day.stakes?.summary) {
        totalStaked += day.stakes.summary.total_staked;
        totalReturn += day.stakes.summary.total_return;
        totalBets += day.stakes.summary.total_bets;
        totalWins += day.stakes.summary.wins;
      }

      const dayRate = day.btts?.summary ? day.btts.summary.hit_rate : 0;
      if (!bestDay || dayRate > bestDay.rate) {
        bestDay = { date: day.date, rate: dayRate };
      }
    }

    const sorted = [...this.data].sort((a, b) => b.date.localeCompare(a.date));
    for (const day of sorted) {
      const rate = day.btts?.summary?.hit_rate || 0;
      if (rate >= 50) streak++;
      else break;
    }

    const totalProfit = totalReturn - totalStaked;
    return {
      days,
      btts: { total: bttsTotal, green: bttsGreen, rate: bttsTotal ? ((bttsGreen / bttsTotal) * 100).toFixed(1) : 0 },
      corners: { total: cornersTotal, green: cornersGreen, rate: cornersTotal ? ((cornersGreen / cornersTotal) * 100).toFixed(1) : 0 },
      cards: { total: cardsTotal, green: cardsGreen, rate: cardsTotal ? ((cardsGreen / cardsTotal) * 100).toFixed(1) : 0 },
      over25: { total: over25Total, green: over25Green, rate: over25Total ? ((over25Green / over25Total) * 100).toFixed(1) : 0 },
      stakes: { staked: totalStaked, returned: totalReturn, profit: totalProfit, bets: totalBets, wins: totalWins },
      streak,
      bestDay
    };
  },

  formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const date = new Date(y, m - 1, d);
    return `${days[date.getDay()]} ${d}/${m}`;
  },

  render() {
    const section = document.getElementById('history-section');
    if (!section) return;

    if (this.data.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    const stats = this.getOverallStats();

    // Stats cards
    const statCards = [
      `<div class="history__stat-card">
        <div class="history__stat-value">${stats.days}</div>
        <div class="history__stat-label">Dias</div>
      </div>`,
      `<div class="history__stat-card history__stat-card--btts">
        <div class="history__stat-value">${stats.btts.rate}%</div>
        <div class="history__stat-label">BTTS (${stats.btts.green}/${stats.btts.total})</div>
      </div>`,
      `<div class="history__stat-card history__stat-card--corners">
        <div class="history__stat-value">${stats.corners.rate}%</div>
        <div class="history__stat-label">Cantos (${stats.corners.green}/${stats.corners.total})</div>
      </div>`
    ];
    if (stats.cards.total > 0) {
      statCards.push(`<div class="history__stat-card history__stat-card--cards">
        <div class="history__stat-value">${stats.cards.rate}%</div>
        <div class="history__stat-label">Cartões (${stats.cards.green}/${stats.cards.total})</div>
      </div>`);
    }
    if (stats.over25.total > 0) {
      statCards.push(`<div class="history__stat-card history__stat-card--over25">
        <div class="history__stat-value">${stats.over25.rate}%</div>
        <div class="history__stat-label">O2.5 (${stats.over25.green}/${stats.over25.total})</div>
      </div>`);
    }
    if (stats.stakes.bets > 0) {
      const profitClass = stats.stakes.profit >= 0 ? 'history__stat-card--profit' : 'history__stat-card--loss';
      const sign = stats.stakes.profit >= 0 ? '+' : '';
      statCards.push(`<div class="history__stat-card ${profitClass}">
        <div class="history__stat-value">${sign}${stats.stakes.profit.toFixed(0)}&euro;</div>
        <div class="history__stat-label">P/L (${stats.stakes.bets} apostas)</div>
      </div>`);
    }

    const statsHtml = `<div class="history__stats">${statCards.join('')}</div>`;

    // Chart - daily hit rate bars
    const chartHtml = this.renderChart();

    // Day-by-day details
    const daysHtml = this.data.map(day => this.renderDay(day)).join('');

    const grid = document.getElementById('history-content');
    if (grid) {
      grid.innerHTML = statsHtml + chartHtml + `<div class="history__days">${daysHtml}</div>`;
    }

    // Setup expand/collapse
    grid?.querySelectorAll('.history__day-header').forEach(header => {
      header.addEventListener('click', () => {
        const detail = header.nextElementSibling;
        const arrow = header.querySelector('.history__day-arrow');
        detail.classList.toggle('expanded');
        arrow.classList.toggle('expanded');
      });
    });
  },

  renderChart() {
    if (this.data.length < 1) return '';

    const days = [...this.data].sort((a, b) => a.date.localeCompare(b.date)).slice(-14); // Last 14 days

    const bars = days.map(day => {
      const bttsRate = day.btts?.summary?.hit_rate || 0;
      const cornersRate = day.corners?.summary?.hit_rate || 0;
      const isGreen = bttsRate >= 50;
      const label = this.formatDate(day.date);

      return `
        <div class="history__chart-col">
          <div class="history__chart-bars">
            <div class="history__chart-bar history__chart-bar--btts ${isGreen ? 'green' : 'red'}"
                 style="height: ${Math.max(bttsRate, 5)}%"
                 title="BTTS: ${bttsRate}%">
            </div>
            ${day.corners?.summary ? `
              <div class="history__chart-bar history__chart-bar--corners"
                   style="height: ${Math.max(cornersRate, 5)}%"
                   title="Cantos: ${cornersRate}%">
              </div>
            ` : ''}
          </div>
          <div class="history__chart-label">${label}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="history__chart">
        <div class="history__chart-header">
          <span class="history__chart-title">Taxa de Acerto Diaria</span>
          <div class="history__chart-legend">
            <span class="history__legend-item"><span class="history__legend-dot history__legend-dot--btts"></span>BTTS</span>
            <span class="history__legend-item"><span class="history__legend-dot history__legend-dot--corners"></span>Cantos</span>
          </div>
        </div>
        <div class="history__chart-area">
          <div class="history__chart-grid">
            <div class="history__chart-line" style="bottom:100%"><span>100%</span></div>
            <div class="history__chart-line" style="bottom:75%"><span>75%</span></div>
            <div class="history__chart-line" style="bottom:50%"><span>50%</span></div>
            <div class="history__chart-line" style="bottom:25%"><span>25%</span></div>
          </div>
          <div class="history__chart-cols">
            ${bars}
          </div>
        </div>
      </div>
    `;
  },

  renderDay(day) {
    const btts = day.btts?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const corners = day.corners?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const cards = day.cards?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const over25 = day.over25?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const isGood = btts.hit_rate >= 50;

    // Build badges
    let badges = `
      <span class="history__badge ${isGood ? 'green' : 'red'}">
        BTTS ${btts.green}/${btts.total}
      </span>`;
    if (corners.total > 0) {
      badges += `<span class="history__badge ${corners.hit_rate >= 50 ? 'green' : 'red'}">
        Cantos ${corners.green}/${corners.total}
      </span>`;
    }
    if (cards.total > 0) {
      badges += `<span class="history__badge ${cards.hit_rate >= 50 ? 'green' : 'red'}">
        Cartões ${cards.green}/${cards.total}
      </span>`;
    }
    if (over25.total > 0) {
      badges += `<span class="history__badge ${over25.hit_rate >= 50 ? 'green' : 'red'}">
        O2.5 ${over25.green}/${over25.total}
      </span>`;
    }
    if (day.stakes?.summary) {
      const sp = day.stakes.summary;
      const profitCls = sp.profit >= 0 ? 'green' : 'red';
      const sign = sp.profit >= 0 ? '+' : '';
      badges += `<span class="history__badge ${profitCls}">
        ${sign}${sp.profit.toFixed(0)}&euro;
      </span>`;
    }

    return `
      <div class="history__day">
        <div class="history__day-header">
          <div class="history__day-date">${this.formatDate(day.date)}</div>
          <div class="history__day-badges">${badges}</div>
          <span class="history__day-arrow">&#9660;</span>
        </div>
        <div class="history__day-detail">
          ${day.stakes ? this.renderStakes(day.stakes) : ''}
          ${day.notes ? `<div class="history__notes">${day.notes}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderStakes(stakes) {
    if (!stakes || !stakes.bets || stakes.bets.length === 0) return '';

    const s = stakes.summary;
    const isProfit = s.profit >= 0;
    const profitClass = isProfit ? 'green' : 'red';
    const profitSign = isProfit ? '+' : '';

    const betsHtml = stakes.bets.map(bet => {
      let cls, icon, returnText;
      if (bet.result === 'win') {
        cls = 'green';
        icon = '&#10003;';
        returnText = '+' + bet.return.toFixed(2) + '&euro;';
      } else if (bet.result === 'pending') {
        cls = 'pending';
        icon = '&#8987;';
        returnText = '...';
      } else {
        cls = 'red';
        icon = '&#10007;';
        returnText = '-' + bet.stake.toFixed(2) + '&euro;';
      }
      const typeLabel = bet.type === 'acumulador' ? 'Acum.' : '';
      return `
        <div class="history__stake-bet ${cls}">
          <span class="history__tip-icon">${icon}</span>
          <span class="history__stake-match">${bet.matches}</span>
          <span class="history__stake-market">${typeLabel} ${bet.market}</span>
          <span class="history__stake-odds">${bet.odds}</span>
          <span class="history__stake-amount">${bet.stake}&euro;</span>
          <span class="history__stake-return ${cls}">${returnText}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="history__stakes-section">
        <div class="history__stakes-header">
          <div class="history__tip-section-title">Apostas Reais</div>
          <div class="history__stakes-summary">
            <span class="history__stakes-stat">Apostado: <strong>${s.total_staked}&euro;</strong></span>
            <span class="history__stakes-stat">Retorno: <strong>${s.total_return.toFixed(2)}&euro;</strong></span>
            <span class="history__stakes-stat history__stakes-profit ${profitClass}">
              P/L: <strong>${profitSign}${s.profit.toFixed(2)}&euro;</strong>
            </span>
            <span class="history__stakes-stat">ROI: <strong>${s.roi}%</strong></span>
            <span class="history__stakes-stat">${s.wins}W / ${s.losses}L</span>
          </div>
        </div>
        <div class="history__stakes-bets">
          ${betsHtml}
        </div>
      </div>
    `;
  },

  // Seed initial data from hardcoded results (for when JSON fetch isn't available)
  seedData() {
    const stored = localStorage.getItem('trincheira_history');
    if (stored) {
      this.data = JSON.parse(stored);
      return;
    }

    // Day 1: 12/04/2026
    this.addDay({
      "date": "2026-04-12",
      "btts": {
        "tips": [
          { "home": "PEC Zwolle", "away": "Excelsior", "league": "Eredivisie", "confidence": 71, "btts_sim": 1.53, "result_home": 2, "result_away": 2, "btts_hit": true },
          { "home": "Dender", "away": "Zulte Waregem", "league": "Pro League", "confidence": 70, "btts_sim": 1.70, "result_home": 1, "result_away": 2, "btts_hit": true },
          { "home": "Anderlecht", "away": "Gent", "league": "Pro League", "confidence": 66, "btts_sim": 1.55, "result_home": 3, "result_away": 1, "btts_hit": true },
          { "home": "Austria Vienna", "away": "Rapid Vienna", "league": "Bundesliga AT", "confidence": 65, "btts_sim": 1.83, "result_home": 1, "result_away": 1, "btts_hit": true },
          { "home": "Genk", "away": "OH Leuven", "league": "Pro League", "confidence": 64, "btts_sim": null, "result_home": 0, "result_away": 0, "btts_hit": false },
          { "home": "FC Luzern", "away": "FC St. Gallen", "league": "Super League", "confidence": 85, "btts_sim": 1.40, "result_home": 2, "result_away": 2, "btts_hit": true },
          { "home": "1. FC Köln", "away": "Werder Bremen", "league": "Bundesliga", "confidence": 82, "btts_sim": 1.57, "result_home": 3, "result_away": 1, "btts_hit": true },
          { "home": "BSC Young Boys", "away": "Servette FC", "league": "Super League", "confidence": 83, "btts_sim": null, "result_home": 1, "result_away": 1, "btts_hit": true }
        ],
        "summary": { "total": 8, "green": 7, "red": 1, "hit_rate": 87.5 }
      },
      "corners": {
        "tips": [
          { "home": "Jogo 1", "away": "(desconhecido)", "league": "—", "market": "+10.5 cantos", "total_corners": 5, "hit": false },
          { "home": "Jogo 2", "away": "(desconhecido)", "league": "—", "market": "+10.5 cantos", "total_corners": 11, "hit": true },
          { "home": "Jogo 3", "away": "(desconhecido)", "league": "—", "market": "+10.5 cantos", "total_corners": 12, "hit": true }
        ],
        "summary": { "total": 3, "green": 2, "red": 1, "hit_rate": 66.7 }
      },
      "notes": "Primeiro dia de tracking. BTTS excelente (87.5%). Genk vs OH Leuven (conf. 64) foi o unico miss. Cantos: jogo da esquerda teve apenas 5 cantos vs target 10.5."
    });

    // Day 2: 13/04/2026
    this.addDay({
      "date": "2026-04-13",
      "btts": {
        "tips": [
          { "home": "FC Fredericia", "away": "Vejle", "league": "Superliga", "confidence": 80, "btts_sim": null, "result_home": 2, "result_away": 2, "btts_hit": true },
          { "home": "Lanus", "away": "Banfield", "league": "Primera División", "confidence": 57, "btts_sim": 2.10, "result_home": 1, "result_away": 0, "btts_hit": false }
        ],
        "summary": { "total": 2, "green": 1, "red": 1, "hit_rate": 50.0 }
      },
      "corners": {
        "tips": [
          { "home": "IF Brommapojkarna", "away": "AIK Stockholm", "league": "Allsvenskan", "market": "+10.5 cantos", "total_corners": 12, "hit": true }
        ],
        "summary": { "total": 1, "green": 1, "red": 0, "hit_rate": 100.0 }
      },
      "notes": "Dia com poucas tips. Fredericia vs Vejle (conf. 80) acertou. Lanus vs Banfield (conf. 57) falhou - confianca baixa confirmou-se como risco."
    });

    // Day 3: 14/04/2026
    this.addDay({
      "date": "2026-04-14",
      "btts": {
        "tips": [
          { "home": "Aris", "away": "Pafos", "league": "First Division", "confidence": 62, "btts_sim": null, "result_home": 1, "result_away": 1, "btts_hit": true }
        ],
        "summary": { "total": 1, "green": 1, "red": 0, "hit_rate": 100.0 }
      },
      "corners": {
        "tips": [
          { "home": "Atletico Madrid", "away": "Barcelona", "league": "Champions League", "market": "+10.5 cantos", "confidence": 80, "total_corners": 6, "hit": false },
          { "home": "Liverpool", "away": "Paris Saint Germain", "league": "Champions League", "market": "+10.5 cantos", "confidence": 62, "total_corners": 10, "hit": false }
        ],
        "summary": { "total": 2, "green": 0, "red": 2, "hit_rate": 0.0 }
      },
      "notes": "Dia RED nos cantos. BTTS acertou (Aris vs Pafos 1-1). Cantos: Barcelona teve apenas 6, PSG ficou perto com 10 mas nao chegou ao 10.5."
    });

    // Day 4: 15/04/2026
    this.addDay({
      "date": "2026-04-15",
      "btts": {
        "tips": [
          { "home": "Al-Nassr", "away": "Al-Ettifaq", "league": "Pro League", "confidence": 55, "btts_sim": 1.57, "result_home": 1, "result_away": 0, "btts_hit": false }
        ],
        "summary": { "total": 1, "green": 0, "red": 1, "hit_rate": 0.0 }
      },
      "corners": {
        "tips": [
          { "home": "Bayern München", "away": "Real Madrid", "league": "Champions League", "market": "+9.5 cantos", "confidence": 60, "total_corners": 12, "hit": true }
        ],
        "summary": { "total": 1, "green": 1, "red": 0, "hit_rate": 100.0 }
      },
      "notes": "BTTS: Al-Nassr vs Al-Ettifaq (conf. 55) falhou - 1-0, jogo desequilibrado. Cantos: Bayern vs Real Madrid 12 cantos (4-3), Over 9.5 GREEN."
    });

    // Day 5: 16/04/2026
    this.addDay({
      "date": "2026-04-16",
      "btts": {
        "tips": [
          { "home": "AZ Alkmaar", "away": "Shakhtar Donetsk", "league": "Conference League", "confidence": null, "btts_sim": 1.61, "result_home": 2, "result_away": 2, "btts_hit": true },
          { "home": "Septemvri Sofia", "away": "Spartak Varna", "league": "Liga Parva", "confidence": null, "btts_sim": 1.73, "result_home": 0, "result_away": 0, "btts_hit": false }
        ],
        "summary": { "total": 2, "green": 1, "red": 1, "hit_rate": 50.0 }
      },
      "cards": {
        "tips": [
          { "home": "Real Betis", "away": "SC Braga", "league": "Europa League", "market": "+3.5 cartões", "total_cards": 7, "hit": true },
          { "home": "Nottingham Forest", "away": "Porto", "league": "Europa League", "market": "+3.5 cartões", "total_cards": 4, "hit": true },
          { "home": "Celta Vigo", "away": "Freiburg", "league": "Europa League", "market": "+3.5 cartões", "total_cards": 6, "hit": true }
        ],
        "summary": { "total": 3, "green": 3, "red": 0, "hit_rate": 100.0 }
      },
      "over25": {
        "tips": [
          { "home": "AEK Atenas", "away": "Rayo Vallecano", "league": "Conference League", "confidence": null, "result_home": 3, "result_away": 1, "hit": true },
          { "home": "Nottingham Forest", "away": "Porto", "league": "Europa League", "confidence": null, "result_home": 1, "result_away": 0, "hit": false }
        ],
        "summary": { "total": 2, "green": 1, "red": 1, "hit_rate": 50.0 }
      },
      "over15": {
        "tips": [
          { "home": "Aston Villa", "away": "Bologna", "league": "Europa League", "confidence": null, "result_home": 4, "result_away": 0, "hit": true },
          { "home": "AEK Atenas", "away": "Rayo Vallecano", "league": "Conference League", "confidence": null, "result_home": 3, "result_away": 1, "hit": true },
          { "home": "Strasbourg", "away": "Mainz", "league": "Conference League", "confidence": null, "result_home": 4, "result_away": 0, "hit": true },
          { "home": "Nottingham Forest", "away": "Porto", "league": "Europa League", "confidence": null, "result_home": 1, "result_away": 0, "hit": false },
          { "home": "Fiorentina", "away": "Crystal Palace", "league": "Conference League", "confidence": null, "result_home": 2, "result_away": 1, "hit": true },
          { "home": "AZ Alkmaar", "away": "Shakhtar Donetsk", "league": "Conference League", "confidence": null, "result_home": 2, "result_away": 2, "hit": true }
        ],
        "summary": { "total": 6, "green": 5, "red": 1, "hit_rate": 83.3 }
      },
      "stakes": {
        "bets": [
          { "type": "acumulador", "market": "Over 1.5", "matches": "Nott. Forest vs Porto + Fiorentina vs Crystal Palace", "odds": 1.895, "stake": 10, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 3.5 cartões", "matches": "Real Betis vs SC Braga", "odds": 1.53, "stake": 5, "result": "win", "return": 7.65 },
          { "type": "simples", "market": "Over 3.5 cartões", "matches": "Nott. Forest vs Porto", "odds": 1.58, "stake": 5, "result": "win", "return": 7.90 },
          { "type": "simples", "market": "Over 2.5", "matches": "AEK Atenas vs Rayo Vallecano", "odds": 1.842, "stake": 10, "result": "win", "return": 18.42 },
          { "type": "simples", "market": "Over 2.5", "matches": "Nott. Forest vs Porto", "odds": 2.32, "stake": 10, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2", "matches": "AZ Alkmaar vs Shakhtar Donetsk", "odds": 1.715, "stake": 15, "result": "win", "return": 25.73 },
          { "type": "acumulador", "market": "Over 1.5", "matches": "Aston Villa + AEK + Strasbourg", "odds": 1.801, "stake": 10, "result": "win", "return": 18.01 },
          { "type": "simples", "market": "Over 3.5 cartões", "matches": "Celta Vigo vs Freiburg", "odds": 1.84, "stake": 5, "result": "win", "return": 9.20 },
          { "type": "simples", "market": "BTTS", "matches": "AZ Alkmaar vs Shakhtar Donetsk", "odds": 1.61, "stake": 10, "result": "win", "return": 16.10 },
          { "type": "simples", "market": "BTTS", "matches": "Septemvri Sofia vs Spartak Varna", "odds": 1.73, "stake": 10, "result": "loss", "return": 0 }
        ],
        "summary": { "total_staked": 90, "total_return": 103.01, "profit": 13.01, "total_bets": 10, "wins": 7, "losses": 3, "roi": 14.5 }
      },
      "notes": "Dia europeu. BTTS: 1/2. Cartões: 3/3 perfeito. Over 1.5: 5/6. Over 2.5: 1/2. Stakes: +13.01€ lucro (ROI 14.5%)."
    });

    // Day 6: 17/04/2026
    this.addDay({
      "date": "2026-04-17",
      "btts": {
        "tips": [
          { "home": "Fram", "away": "Keflavik", "league": "Urvalsdeild", "confidence": null, "btts_sim": 1.615, "result_home": 3, "result_away": 1, "btts_hit": true },
          { "home": "Breidablik", "away": "IA Akranes", "league": "Urvalsdeild", "confidence": null, "btts_sim": 1.53, "result_home": 1, "result_away": 0, "btts_hit": false }
        ],
        "summary": { "total": 2, "green": 1, "red": 1, "hit_rate": 50.0 }
      },
      "cards": {
        "tips": [
          { "home": "Fenerbahce", "away": "Çaykur Rizespor", "league": "Superliga Turquia", "market": "+4.5 cartões", "total_cards": 7, "hit": true },
          { "home": "Antalyaspor", "away": "Konyaspor", "league": "Superliga Turquia", "market": "+4.5 cartões", "total_cards": 8, "hit": true },
          { "home": "Melbourne Victory", "away": "Newcastle Jets", "league": "A-League", "market": "+3.5 cartões", "total_cards": 4, "hit": true },
          { "home": "Rio Ave", "away": "Aves", "league": "Liga Portugal", "market": "+4.5 cartões", "total_cards": 3, "hit": false }
        ],
        "summary": { "total": 4, "green": 3, "red": 1, "hit_rate": 75.0 }
      },
      "over25": {
        "tips": [
          { "home": "Fenerbahce", "away": "Çaykur Rizespor", "league": "Superliga Turquia", "confidence": null, "result_home": 2, "result_away": 2, "hit": true },
          { "home": "Oss", "away": "Den Bosch", "league": "Eerste Divisie", "confidence": null, "result_home": 3, "result_away": 2, "hit": true },
          { "home": "Holstein Kiel", "away": "Kaiserslautern", "league": "2. Bundesliga", "confidence": null, "result_home": 3, "result_away": 0, "hit": true },
          { "home": "Regensburg", "away": "Aachen", "league": "3. Liga", "confidence": null, "result_home": 1, "result_away": 3, "hit": true },
          { "home": "ADO Den Haag", "away": "Waalwijk", "league": "Eerste Divisie", "confidence": null, "result_home": 5, "result_away": 1, "hit": true },
          { "home": "B.93", "away": "HB Køge", "league": "1. Division", "confidence": null, "result_home": 1, "result_away": 2, "hit": true },
          { "home": "Helmond Sport", "away": "VVV-Venlo", "league": "Eerste Divisie", "confidence": null, "result_home": 2, "result_away": 0, "hit": false },
          { "home": "Katowice", "away": "Motor Lublin", "league": "Ekstraklasa", "confidence": null, "result_home": 3, "result_away": 2, "hit": true },
          { "home": "Esbjerg", "away": "Hillerod", "league": "1. Division", "confidence": null, "result_home": 0, "result_away": 0, "hit": false },
          { "home": "Jong Utrecht", "away": "Eindhoven", "league": "Eerste Divisie", "confidence": null, "result_home": 3, "result_away": 0, "hit": true },
          { "home": "De Graafschap", "away": "Cambuur", "league": "Eerste Divisie", "confidence": null, "result_home": 3, "result_away": 1, "hit": true }
        ],
        "summary": { "total": 11, "green": 9, "red": 2, "hit_rate": 81.8 }
      },
      "corners": {
        "tips": [
          { "home": "Melbourne Victory", "away": "Newcastle Jets", "league": "A-League", "market": "+10.5 cantos", "total_corners": 10, "hit": false }
        ],
        "summary": { "total": 1, "green": 0, "red": 1, "hit_rate": 0.0 }
      },
      "stakes": {
        "bets": [
          { "type": "simples", "market": "Over 2.5", "matches": "Fenerbahce vs Rizespor", "odds": 1.41, "stake": 15, "result": "win", "return": 21.15 },
          { "type": "simples", "market": "Over 2.5", "matches": "Oss vs Den Bosch", "odds": 1.44, "stake": 15, "result": "win", "return": 21.60 },
          { "type": "simples", "market": "Over 2.5", "matches": "Kiel vs Kaiserslautern", "odds": 1.65, "stake": 15, "result": "win", "return": 24.75 },
          { "type": "simples", "market": "Over 2.5", "matches": "Regensburg vs Aachen", "odds": 1.55, "stake": 15, "result": "win", "return": 23.25 },
          { "type": "simples", "market": "Over 2.5", "matches": "Den Haag vs Waalwijk", "odds": 1.48, "stake": 15, "result": "win", "return": 22.20 },
          { "type": "simples", "market": "Over 2.5", "matches": "B.93 vs Køge", "odds": 1.58, "stake": 15, "result": "win", "return": 23.70 },
          { "type": "simples", "market": "Over 2.5", "matches": "Helmond vs VVV-Venlo", "odds": 1.54, "stake": 15, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Katowice vs Motor Lublin", "odds": 1.666, "stake": 15, "result": "win", "return": 24.99 },
          { "type": "simples", "market": "Over 2.5", "matches": "Esbjerg vs Hillerod", "odds": 1.88, "stake": 15, "result": "loss", "return": 0 },
          { "type": "acumulador", "market": "Over 2.5", "matches": "Jong Utrecht + Graafschap", "odds": 1.999, "stake": 5, "result": "win", "return": 10.00 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Fenerbahce vs Rizespor", "odds": 1.9, "stake": 15, "result": "win", "return": 28.50 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Antalyaspor vs Konyaspor", "odds": 1.92, "stake": 20, "result": "win", "return": 38.40 },
          { "type": "simples", "market": "BTTS + Over 2.5", "matches": "Fram vs Keflavik", "odds": 1.615, "stake": 15, "result": "win", "return": 24.23 },
          { "type": "simples", "market": "Over 3.5 cartões", "matches": "Melbourne Victory vs Newcastle Jets", "odds": 2.28, "stake": 10, "result": "win", "return": 22.80 },
          { "type": "simples", "market": "Over 10.5 cantos", "matches": "Melbourne Victory vs Newcastle Jets", "odds": 1.7, "stake": 15, "result": "loss", "return": 0 },
          { "type": "simples", "market": "BTTS + Over 2.5", "matches": "Breidablik vs IA Akranes", "odds": 1.53, "stake": 10, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Rio Ave vs Aves", "odds": 1.65, "stake": 10, "result": "loss", "return": 0 }
        ],
        "summary": { "total_staked": 230, "total_return": 285.57, "profit": 55.57, "total_bets": 17, "wins": 12, "losses": 5, "roi": 24.2 }
      },
      "notes": "Grande dia! Over 2.5: 9/11 (81.8%). Cartões: 3/4 (Rio Ave 3 cartões, RED). Cantos: 0/1. BTTS: 1/2. Stakes: +55.57€ (ROI 24.2%)."
    });

    // Day 7: 18/04/2026
    this.addDay({
      "date": "2026-04-18",
      "btts": {
        "tips": [
          { "home": "SSV Ulm 1846", "away": "Havelse", "league": "3. Liga", "confidence": null, "btts_sim": 1.48, "result_home": 2, "result_away": 1, "btts_hit": true },
          { "home": "MSV Duisburg", "away": "Hoffenheim II", "league": "3. Liga", "confidence": null, "btts_sim": 1.52, "result_home": 3, "result_away": 1, "btts_hit": true },
          { "home": "Verl", "away": "Viktoria Köln", "league": "3. Liga", "confidence": null, "btts_sim": 1.60, "result_home": 2, "result_away": 0, "btts_hit": false }
        ],
        "summary": { "total": 3, "green": 2, "red": 1, "hit_rate": 66.7 }
      },
      "cards": {
        "tips": [
          { "home": "OFI Crete", "away": "Levadiakos", "league": "Super League Grécia", "market": "+4.5 cartões", "total_cards": null, "hit": true },
          { "home": "Napoli", "away": "Lazio", "league": "Serie A", "market": "+3.5 cartões", "total_cards": null, "hit": true },
          { "home": "Kocaelispor", "away": "Goztepe", "league": "Süper Lig", "market": "+4.5 cartões", "total_cards": null, "hit": true },
          { "home": "Genclerbirligi", "away": "Galatasaray", "league": "Süper Lig", "market": "+4.5 cartões", "total_cards": null, "hit": false },
          { "home": "Kifisias", "away": "Asteras Tripolis", "league": "Super League Grécia", "market": "+4.5 cartões", "total_cards": null, "hit": false },
          { "home": "Cruz Azul", "away": "Tijuana", "league": "Liga MX", "market": "+4.5 cartões", "total_cards": null, "hit": false },
          { "home": "Necaxa", "away": "Tigres UANL", "league": "Liga MX", "market": "+5.5 cartões", "total_cards": null, "hit": false }
        ],
        "summary": { "total": 7, "green": 3, "red": 4, "hit_rate": 42.9 }
      },
      "over25": {
        "tips": [
          { "home": "MSV Duisburg", "away": "Hoffenheim II", "league": "3. Liga", "confidence": null, "result_home": 3, "result_away": 1, "hit": true },
          { "home": "Thun", "away": "Basel", "league": "Super League Suíça", "confidence": null, "result_home": 3, "result_away": 1, "hit": true },
          { "home": "Verl", "away": "Viktoria Köln", "league": "3. Liga", "confidence": null, "result_home": 2, "result_away": 0, "hit": false },
          { "home": "Keski-Uusimaa", "away": "RoPS", "league": "Ykkönen", "confidence": null, "result_home": 0, "result_away": 2, "hit": false },
          { "home": "Wolfsberger AC", "away": "BW Linz", "league": "Bundesliga Áustria", "confidence": null, "result_home": 0, "result_away": 0, "hit": false },
          { "home": "Cruz Azul", "away": "Tijuana", "league": "Liga MX", "confidence": null, "result_home": 1, "result_away": 1, "hit": false }
        ],
        "summary": { "total": 6, "green": 2, "red": 4, "hit_rate": 33.3 }
      },
      "corners": {
        "tips": [],
        "summary": { "total": 0, "green": 0, "red": 0, "hit_rate": 0 }
      },
      "stakes": {
        "bets": [
          { "type": "simples", "market": "BTTS", "matches": "SSV Ulm vs Havelse", "odds": 1.48, "stake": 5, "result": "win", "return": 7.40 },
          { "type": "simples", "market": "BTTS", "matches": "MSV Duisburg vs Hoffenheim II", "odds": 1.52, "stake": 15, "result": "win", "return": 22.80 },
          { "type": "simples", "market": "BTTS", "matches": "Verl vs Viktoria Köln", "odds": 1.60, "stake": 20, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "OFI Crete vs Levadiakos", "odds": 1.50, "stake": 30, "result": "win", "return": 45.00 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Kifisias vs Asteras Tripolis", "odds": 1.53, "stake": 30, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 3.5 cartões", "matches": "Napoli vs Lazio", "odds": 2.875, "stake": 26, "result": "win", "return": 74.75 },
          { "type": "simples", "market": "Over 2.5", "matches": "Keski-Uusimaa vs RoPS", "odds": 1.38, "stake": 20, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Verl vs Viktoria Köln", "odds": 1.55, "stake": 20, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Thun vs Basel", "odds": 1.36, "stake": 20, "result": "win", "return": 27.20 },
          { "type": "simples", "market": "Over 2.5", "matches": "Wolfsberger vs BW Linz", "odds": 1.92, "stake": 20, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "MSV Duisburg vs Hoffenheim II", "odds": 1.49, "stake": 15, "result": "win", "return": 22.35 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Kocaelispor vs Goztepe", "odds": 2.10, "stake": 20, "result": "win", "return": 42.00 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Genclerbirligi vs Galatasaray", "odds": 2.22, "stake": 20, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 5.5 cartões", "matches": "Necaxa vs Tigres UANL", "odds": 2.10, "stake": 15, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Cruz Azul vs Tijuana", "odds": 1.667, "stake": 30, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Cruz Azul vs Tijuana", "odds": 1.39, "stake": 15, "result": "loss", "return": 0 }
        ],
        "summary": { "total_staked": 341, "total_return": 241.50, "profit": -99.50, "total_bets": 16, "wins": 7, "losses": 9, "roi": -29.2 }
      },
      "notes": "Dia RED. Over 2.5: 2/6 (33.3%). Cartões: 3/7 (42.9%) - Liga MX e Grécia falharam. BTTS: 2/3 (66.7%). Stakes: -99.50€ (ROI -29.2%). Excesso de exposição (341€ vs max ~196€)."
    });

    // Day 8: 19/04/2026
    // (Note: Day 8 data loaded from JSON file)
    this.addDay({
      "date": "2026-04-19",
      "btts": {
        "tips": [
          { "home": "VfB Stuttgart II", "away": "Erzgebirge Aue", "league": "3. Liga", "confidence": null, "btts_sim": 1.44, "result_home": 2, "result_away": 2, "btts_hit": true },
          { "home": "Santos Laguna", "away": "Atlas Guadalajara", "league": "Liga MX", "confidence": null, "btts_sim": 1.57, "result_home": 0, "result_away": 1, "btts_hit": false }
        ],
        "summary": { "total": 2, "green": 1, "red": 1, "hit_rate": 50.0 }
      },
      "cards": {
        "tips": [
          { "home": "Arouca", "away": "Estrela da Amadora", "league": "Liga Portugal", "market": "+4.5 cartões", "total_cards": null, "hit": true },
          { "home": "Braga", "away": "Famalicão", "league": "Liga Portugal", "market": "+4.5 cartões", "total_cards": null, "hit": true },
          { "home": "Santos Laguna", "away": "Atlas Guadalajara", "league": "Liga MX", "market": "+5.5 cartões", "total_cards": null, "hit": true },
          { "home": "Sporting CP", "away": "Benfica", "league": "Liga Portugal", "market": "+5.5 cartões", "total_cards": null, "hit": false },
          { "home": "Rosario Central", "away": "Sarmiento Junín", "league": "Liga Argentina", "market": "+4.5 cartões", "total_cards": null, "hit": false }
        ],
        "summary": { "total": 5, "green": 3, "red": 2, "hit_rate": 60.0 }
      },
      "over25": {
        "tips": [
          { "home": "Energie Cottbus", "away": "Rot-Weiss Essen", "league": "3. Liga", "confidence": null, "result_home": 5, "result_away": 3, "hit": true },
          { "home": "Wehen Wiesbaden", "away": "Waldhof Mannheim", "league": "3. Liga", "confidence": null, "result_home": 3, "result_away": 3, "hit": true },
          { "home": "Freiburg", "away": "1. FC Heidenheim", "league": "Bundesliga", "confidence": null, "result_home": 2, "result_away": 1, "hit": true },
          { "home": "Bayern München", "away": "VfB Stuttgart", "league": "Bundesliga", "confidence": null, "result_home": 4, "result_away": 2, "hit": true },
          { "home": "Silkeborg", "away": "Fredericia", "league": "Superliga DK", "confidence": null, "result_home": 2, "result_away": 2, "hit": true },
          { "home": "Austria Wien", "away": "Salzburg", "league": "Bundesliga AT", "confidence": null, "result_home": 1, "result_away": 3, "hit": true },
          { "home": "Odense", "away": "Randers", "league": "Superliga DK", "confidence": null, "result_home": 3, "result_away": 1, "hit": true },
          { "home": "HamKam", "away": "KFUM Oslo", "league": "Eliteserien", "confidence": null, "result_home": 4, "result_away": 0, "hit": true },
          { "home": "VfB Stuttgart II", "away": "Erzgebirge Aue", "league": "3. Liga", "confidence": null, "result_home": 2, "result_away": 2, "hit": true },
          { "home": "Åsane", "away": "Strømmen", "league": "OBOS-ligaen", "confidence": null, "result_home": 4, "result_away": 5, "hit": true },
          { "home": "Santos Laguna", "away": "Atlas Guadalajara", "league": "Liga MX", "confidence": null, "result_home": 0, "result_away": 1, "hit": false },
          { "home": "B. Mönchengladbach", "away": "1. FSV Mainz 05", "league": "Bundesliga", "confidence": null, "result_home": 1, "result_away": 1, "hit": false },
          { "home": "LASK Linz", "away": "Sturm Graz", "league": "Bundesliga AT", "confidence": null, "result_home": 1, "result_away": 1, "hit": false },
          { "home": "Gent", "away": "Sint-Truidense", "league": "Pro League", "confidence": null, "result_home": 0, "result_away": 0, "hit": false },
          { "home": "Kristiansund", "away": "Fredrikstad", "league": "Eliteserien", "confidence": null, "result_home": 2, "result_away": 0, "hit": false }
        ],
        "summary": { "total": 15, "green": 10, "red": 5, "hit_rate": 66.7 }
      },
      "corners": {
        "tips": [],
        "summary": { "total": 0, "green": 0, "red": 0, "hit_rate": 0 }
      },
      "stakes": {
        "bets": [
          { "type": "simples", "market": "BTTS", "matches": "VfB Stuttgart II vs Erzgebirge Aue", "odds": 1.44, "stake": 6, "result": "win", "return": 8.64 },
          { "type": "simples", "market": "BTTS", "matches": "Santos Laguna vs Atlas", "odds": 1.57, "stake": 2, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Energie Cottbus vs RW Essen", "odds": 1.46, "stake": 8, "result": "win", "return": 11.68 },
          { "type": "simples", "market": "Over 2.5", "matches": "Wehen Wiesbaden vs Waldhof Mannheim", "odds": 1.57, "stake": 6, "result": "win", "return": 9.42 },
          { "type": "simples", "market": "Over 2.5", "matches": "Freiburg vs 1. Heidenheim", "odds": 1.671, "stake": 8, "result": "win", "return": 13.37 },
          { "type": "simples", "market": "Over 3.5", "matches": "Bayern München vs VfB Stuttgart", "odds": 1.69, "stake": 6, "result": "win", "return": 10.14 },
          { "type": "simples", "market": "Over 2.5", "matches": "Santos Laguna vs Atlas", "odds": 1.73, "stake": 6, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "B. Mönchengladbach vs Mainz", "odds": 1.877, "stake": 6, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Silkeborg vs Fredericia", "odds": 1.42, "stake": 6, "result": "win", "return": 8.52 },
          { "type": "simples", "market": "Over 2.5", "matches": "Austria Wien vs Salzburg", "odds": 1.66, "stake": 4, "result": "win", "return": 6.64 },
          { "type": "simples", "market": "Over 2.5", "matches": "LASK Linz vs Sturm Graz", "odds": 1.59, "stake": 4, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Gent vs Sint-Truidense", "odds": 1.885, "stake": 2, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "Odense vs Randers", "odds": 1.75, "stake": 4, "result": "win", "return": 7.00 },
          { "type": "simples", "market": "Over 2.5", "matches": "HamKam vs KFUM", "odds": 1.856, "stake": 2, "result": "win", "return": 3.71 },
          { "type": "simples", "market": "Over 2.5", "matches": "Kristiansund vs Fredrikstad", "odds": 1.682, "stake": 2, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 2.5", "matches": "VfB Stuttgart II vs Erzgebirge Aue", "odds": 1.42, "stake": 2, "result": "win", "return": 2.84 },
          { "type": "simples", "market": "Over 2.5", "matches": "Åsane vs Strømmen", "odds": 1.77, "stake": 2, "result": "win", "return": 3.54 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Braga vs Famalicão", "odds": 2.06, "stake": 12, "result": "win", "return": 24.72 },
          { "type": "simples", "market": "Over 5.5 cartões", "matches": "Santos Laguna vs Atlas", "odds": 1.80, "stake": 8, "result": "win", "return": 14.40 },
          { "type": "simples", "market": "Over 5.5 cartões", "matches": "Sporting CP vs Benfica", "odds": 1.65, "stake": 4, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Rosario Central vs Sarmiento", "odds": 1.48, "stake": 8, "result": "loss", "return": 0 },
          { "type": "simples", "market": "Over 4.5 cartões", "matches": "Arouca vs Estrela da Amadora", "odds": 1.56, "stake": 12, "result": "win", "return": 18.72 },
          { "type": "simples", "market": "Over 6.5 cartões", "matches": "Sporting CP vs Benfica", "odds": 2.22, "stake": 5, "result": "loss", "return": 0, "source": "personal" },
          { "type": "simples", "market": "Over 5.5 cartões", "matches": "Sporting CP vs Benfica", "odds": 1.57, "stake": 5, "result": "loss", "return": 0, "source": "personal" },
          { "type": "simples", "market": "Over 1.5 cartões Benfica 1a parte", "matches": "Sporting CP vs Benfica", "odds": 2.02, "stake": 5, "result": "loss", "return": 0, "source": "personal" },
          { "type": "simples", "market": "Geny Catamo marcar golo", "matches": "Sporting CP vs Benfica", "odds": 4.33, "stake": 5, "result": "loss", "return": 0, "source": "personal" }
        ],
        "summary": { "total_staked": 140, "total_return": 143.34, "profit": 3.34, "total_bets": 26, "wins": 14, "losses": 12, "roi": 2.4, "model_staked": 120, "model_return": 143.34, "model_profit": 23.34, "model_roi": 19.5 }
      },
      "notes": "Dia positivo no modelo (+23.34€, ROI 19.5%). 4 apostas pessoais no Sporting-Benfica falharam (-20€). Over 2.5: 10/15 (66.7%) - 3. Liga DE excelente (3/3). Cartões: 3/5 (60%). BTTS: 1/2 (50%). Banca final: 186.65€."
    });
  }
};
