const Over25Scanner = {
  MAX_ANALYZE: 35,
  analyzed: [],
  isAnalyzing: false,

  getFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        const rateA = LEAGUES[a.league.id]?.bttsRate || 0;
        const rateB = LEAGUES[b.league.id]?.bttsRate || 0;
        return rateB - rateA;
      });
  },

  show(fixtures) {
    const section = document.getElementById('over25-section');
    const grid = document.getElementById('over25-grid');
    const btn = document.getElementById('btn-over25');
    const costSpan = document.getElementById('over25-cost');

    const over25Fixtures = this.getFixtures(fixtures);
    if (over25Fixtures.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const toFetch = Math.min(over25Fixtures.length, this.MAX_ANALYZE);
    let cached = 0;
    over25Fixtures.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    if (cached > 0) {
      this.showCachedResults(over25Fixtures.slice(0, toFetch));
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const analysis = Analysis.analyzeOver25Deep(cached[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER25_DEEP_MEDIUM) {
          results.push({ fixture: f, prediction: cached[0], over25: analysis, goalsOdds: null });
        }
      }
    });

    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.goalsOdds = this.extractGoalsOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.over25.score - a.over25.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  extractGoalsOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const goalsBet = bk.bets?.find(b =>
          b.id === 5 || b.name === 'Goals Over/Under' || b.name === 'Over/Under'
        );
        if (goalsBet && goalsBet.values) {
          const overVal = goalsBet.values.find(v => v.value === 'Over 2.5');
          const underVal = goalsBet.values.find(v => v.value === 'Under 2.5');
          if (overVal) {
            return {
              line: 2.5,
              over: parseFloat(overVal.odd || 0),
              under: parseFloat(underVal?.odd || 0),
              bookmaker: bk.name || 'Unknown'
            };
          }
        }
      }
    }
    return null;
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('over25-grid');
    const loading = document.getElementById('over25-loading');
    const progressBar = document.getElementById('over25-progress-bar');
    const progressText = document.getElementById('over25-progress-text');
    const btn = document.getElementById('btn-over25');

    const over25Fixtures = this.getFixtures(fixtures);
    const toAnalyze = over25Fixtures.slice(0, this.MAX_ANALYZE);

    btn.style.display = 'none';
    loading.style.display = 'flex';
    grid.innerHTML = '';

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }

      progressBar.style.width = `${(done / toAnalyze.length) * 100}%`;
      progressText.textContent = `A analisar ${done + 1}/${toAnalyze.length}...`;

      const data = await API.getPrediction(f.fixture.id);
      done++;

      if (data && data.length > 0) {
        const analysis = Analysis.analyzeOver25Deep(data[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER25_DEEP_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], over25: analysis, goalsOdds: null });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    const topCandidates = results
      .sort((a, b) => b.over25.score - a.over25.score)
      .slice(0, 10);

    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;

      progressText.textContent = `A buscar odds ${oddsCount + 1}/${topCandidates.length}...`;
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;

      if (oddsData) {
        r.goalsOdds = this.extractGoalsOdds(oddsData);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => {
      const aHasOdds = a.goalsOdds && a.goalsOdds.over >= THRESHOLDS.OVER25_DEEP_MIN_ODDS;
      const bHasOdds = b.goalsOdds && b.goalsOdds.over >= THRESHOLDS.OVER25_DEEP_MIN_ODDS;
      if (aHasOdds && !bHasOdds) return -1;
      if (!aHasOdds && bHasOdds) return 1;
      return b.over25.score - a.over25.score;
    });

    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="over25s-empty">
          Sem jogos com padrão forte Over 2.5 identificado hoje
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  renderResults(results) {
    const grid = document.getElementById('over25-grid');
    grid.innerHTML = '';

    const filtered = results.filter(r => {
      if (r.goalsOdds && r.goalsOdds.over > 0 && r.goalsOdds.over < THRESHOLDS.OVER25_DEEP_MIN_ODDS) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="over25s-empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.OVER25_DEEP_MIN_ODDS})
        </div>`;
      return;
    }

    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderCard(result, rank) {
    const { fixture, prediction, over25, goalsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    const homeForm = prediction.teams?.home?.league?.form?.slice(-5) || '';
    const awayForm = prediction.teams?.away?.league?.form?.slice(-5) || '';

    const card = UI.el('div', 'over25s-card');
    card.dataset.fixtureId = fixture.fixture.id;

    const tier = over25.score >= THRESHOLDS.OVER25_DEEP_FIRE ? 'fire' :
                 over25.score >= THRESHOLDS.OVER25_DEEP_HIGH ? 'hot' : 'warm';

    const scoreColor = over25.score >= THRESHOLDS.OVER25_DEEP_FIRE ? 'var(--purple)' :
                       over25.score >= THRESHOLDS.OVER25_DEEP_HIGH ? 'var(--blue)' : 'var(--amber)';

    let oddsHtml = '';
    if (goalsOdds && goalsOdds.over > 0) {
      const oddsClass = goalsOdds.over >= 1.70 ? 'over25s-odds--value' :
                        goalsOdds.over >= 1.50 ? 'over25s-odds--fair' : 'over25s-odds--low';
      oddsHtml = `
        <div class="over25s-card__odds ${oddsClass}">
          <span class="over25s-card__odds-label">Over 2.5 Golos</span>
          <span class="over25s-card__odds-value">${goalsOdds.over.toFixed(2)}</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="over25s-card__header">
        <div class="over25s-card__rank">#${rank}</div>
        <div class="over25s-card__tier">
          ${tier === 'fire' ? '&#128293;' : tier === 'hot' ? '&#11088;' : '&#9898;'}
        </div>
        <div class="over25s-card__score-ring" style="--score-color:${scoreColor}">
          <span class="over25s-card__score-value">${over25.score}</span>
          <span class="over25s-card__score-label">O2.5</span>
        </div>
      </div>

      <div class="over25s-card__league">${leagueName} &middot; ${time}</div>

      <div class="over25s-card__matchup">
        <div class="over25s-card__team">
          <img src="${home.logo}" alt="" class="over25s-card__team-logo" onerror="this.style.display='none'">
          <span>${home.name}</span>
        </div>
        <span class="over25s-card__vs">vs</span>
        <div class="over25s-card__team">
          <img src="${away.logo}" alt="" class="over25s-card__team-logo" onerror="this.style.display='none'">
          <span>${away.name}</span>
        </div>
      </div>

      ${oddsHtml}

      <div class="over25s-card__stats-grid">
        <div class="over25s-card__stat">
          <span class="over25s-card__stat-label">Casa marca</span>
          <span class="over25s-card__stat-value">${over25.stats.homeGoalsFor}/jogo</span>
        </div>
        <div class="over25s-card__stat">
          <span class="over25s-card__stat-label">Casa sofre</span>
          <span class="over25s-card__stat-value">${over25.stats.homeGoalsAgainst}/jogo</span>
        </div>
        <div class="over25s-card__stat">
          <span class="over25s-card__stat-label">Fora marca</span>
          <span class="over25s-card__stat-value">${over25.stats.awayGoalsFor}/jogo</span>
        </div>
        <div class="over25s-card__stat">
          <span class="over25s-card__stat-label">Fora sofre</span>
          <span class="over25s-card__stat-value">${over25.stats.awayGoalsAgainst}/jogo</span>
        </div>
      </div>

      <div class="over25s-card__expected">
        <span class="over25s-card__stat-label">Média golos combinada</span>
        <span class="over25s-card__expected-value">${over25.stats.avgGoals}</span>
      </div>

      <div class="over25s-card__form">
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${home.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(homeForm)}</div>
        </div>
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${away.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(awayForm)}</div>
        </div>
      </div>

      ${over25.factors.length > 0 ? `
        <div class="over25s-card__factors">
          ${over25.factors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="over25s-card__factor ${isWarning ? 'over25s-card__factor--warning' : ''}">
              ${isWarning ? '' : '&#10003; '}${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${(over25.learningFactors && over25.learningFactors.length > 0) ? `
        <div class="over25s-card__learning">
          <div class="over25s-card__learning-title">&#9889; Aprendizagem</div>
          ${over25.learningFactors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="over25s-card__learning-item ${isWarning ? 'over25s-card__learning-item--warning' : 'over25s-card__learning-item--boost'}">
              ${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${Bankroll.renderBadge(Bankroll.getOver25Stake(over25.score))}
    `;

    return card;
  },

  init() {
    document.getElementById('btn-over25')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
