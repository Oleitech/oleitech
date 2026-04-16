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
    let over15Total = 0, over15Green = 0;
    let over25Total = 0, over25Green = 0;
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
      if (day.over15?.summary) {
        over15Total += day.over15.summary.total;
        over15Green += day.over15.summary.green;
      }
      if (day.over25?.summary) {
        over25Total += day.over25.summary.total;
        over25Green += day.over25.summary.green;
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

    return {
      days,
      btts: { total: bttsTotal, green: bttsGreen, rate: bttsTotal ? ((bttsGreen / bttsTotal) * 100).toFixed(1) : 0 },
      corners: { total: cornersTotal, green: cornersGreen, rate: cornersTotal ? ((cornersGreen / cornersTotal) * 100).toFixed(1) : 0 },
      cards: { total: cardsTotal, green: cardsGreen, rate: cardsTotal ? ((cardsGreen / cardsTotal) * 100).toFixed(1) : 0 },
      over15: { total: over15Total, green: over15Green, rate: over15Total ? ((over15Green / over15Total) * 100).toFixed(1) : 0 },
      over25: { total: over25Total, green: over25Green, rate: over25Total ? ((over25Green / over25Total) * 100).toFixed(1) : 0 },
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
    if (stats.over15.total > 0) {
      statCards.push(`<div class="history__stat-card history__stat-card--over15">
        <div class="history__stat-value">${stats.over15.rate}%</div>
        <div class="history__stat-label">O1.5 (${stats.over15.green}/${stats.over15.total})</div>
      </div>`);
    }
    if (stats.over25.total > 0) {
      statCards.push(`<div class="history__stat-card history__stat-card--over25">
        <div class="history__stat-value">${stats.over25.rate}%</div>
        <div class="history__stat-label">O2.5 (${stats.over25.green}/${stats.over25.total})</div>
      </div>`);
    }
    statCards.push(`<div class="history__stat-card history__stat-card--streak">
      <div class="history__stat-value">${stats.streak}</div>
      <div class="history__stat-label">Streak</div>
    </div>`);

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
    const over15 = day.over15?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const over25 = day.over25?.summary || { total: 0, green: 0, red: 0, hit_rate: 0 };
    const isGood = btts.hit_rate >= 50;

    const renderTipsList = (tips, type) => {
      return tips.map(tip => {
        let icon, cls, scoreText, confText;
        if (type === 'btts') {
          icon = tip.btts_hit ? '&#10003;' : '&#10007;';
          cls = tip.btts_hit ? 'green' : 'red';
          scoreText = (tip.result_home !== null && tip.result_home !== undefined)
            ? `${tip.result_home}-${tip.result_away}` : '—';
          confText = tip.confidence || '—';
        } else if (type === 'corners') {
          icon = tip.hit ? '&#10003;' : '&#10007;';
          cls = tip.hit ? 'green' : 'red';
          scoreText = `${tip.total_corners} cantos`;
          confText = tip.market;
        } else if (type === 'cards') {
          icon = tip.hit ? '&#10003;' : '&#10007;';
          cls = tip.hit ? 'green' : 'red';
          scoreText = `${tip.total_cards} cartões`;
          confText = tip.market;
        } else if (type === 'over15' || type === 'over25') {
          icon = tip.hit ? '&#10003;' : '&#10007;';
          cls = tip.hit ? 'green' : 'red';
          scoreText = (tip.result_home !== null && tip.result_home !== undefined)
            ? `${tip.result_home}-${tip.result_away}` : '—';
          confText = tip.confidence || '—';
        }
        return `
          <div class="history__tip ${cls}">
            <span class="history__tip-icon">${icon}</span>
            <span class="history__tip-teams">${tip.home} vs ${tip.away}</span>
            <span class="history__tip-score">${scoreText}</span>
            <span class="history__tip-conf">${confText}</span>
          </div>
        `;
      }).join('');
    };

    const bttsDetails = renderTipsList(day.btts?.tips || [], 'btts');
    const cornersDetails = renderTipsList(day.corners?.tips || [], 'corners');
    const cardsDetails = renderTipsList(day.cards?.tips || [], 'cards');
    const over15Details = renderTipsList(day.over15?.tips || [], 'over15');
    const over25Details = renderTipsList(day.over25?.tips || [], 'over25');

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
    if (over15.total > 0) {
      badges += `<span class="history__badge ${over15.hit_rate >= 50 ? 'green' : 'red'}">
        O1.5 ${over15.green}/${over15.total}
      </span>`;
    }
    if (over25.total > 0) {
      badges += `<span class="history__badge ${over25.hit_rate >= 50 ? 'green' : 'red'}">
        O2.5 ${over25.green}/${over25.total}
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
          ${bttsDetails ? `<div class="history__tip-section"><div class="history__tip-section-title">BTTS</div>${bttsDetails}</div>` : ''}
          ${cornersDetails ? `<div class="history__tip-section"><div class="history__tip-section-title">Cantos</div>${cornersDetails}</div>` : ''}
          ${cardsDetails ? `<div class="history__tip-section"><div class="history__tip-section-title">Cartões</div>${cardsDetails}</div>` : ''}
          ${over15Details ? `<div class="history__tip-section"><div class="history__tip-section-title">Over 1.5</div>${over15Details}</div>` : ''}
          ${over25Details ? `<div class="history__tip-section"><div class="history__tip-section-title">Over 2.5</div>${over25Details}</div>` : ''}
          ${day.notes ? `<div class="history__notes">${day.notes}</div>` : ''}
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
  }
};
