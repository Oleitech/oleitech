const TopPicks = {
  MAX_ANALYZE: 35,
  analyzed: [],
  isAnalyzing: false,

  // Get fixtures from BTTS-friendly leagues, sorted by league BTTS rate
  getBTTSFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        // Accept all known leagues (priority 1-3) for BTTS scanning
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        // Sort by league BTTS rate (highest first)
        const rateA = LEAGUES[a.league.id]?.bttsRate || 0;
        const rateB = LEAGUES[b.league.id]?.bttsRate || 0;
        return rateB - rateA;
      });
  },

  show(fixtures) {
    const section = document.getElementById('top-picks-section');
    const grid = document.getElementById('top-picks-grid');
    const btn = document.getElementById('btn-analyze');
    const costSpan = document.getElementById('analyze-cost');

    const bttsFixtures = this.getBTTSFixtures(fixtures);
    if (bttsFixtures.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const toFetch = Math.min(bttsFixtures.length, this.MAX_ANALYZE);
    let cached = 0;
    bttsFixtures.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    // Show cached results immediately
    if (cached > 0) {
      this.showCachedResults(bttsFixtures.slice(0, toFetch));
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const bttsAnalysis = Analysis.analyzeBTTS(cached[0]);
        if (bttsAnalysis && bttsAnalysis.score >= THRESHOLDS.BTTS_MEDIUM) {
          results.push({
            fixture: f,
            prediction: cached[0],
            btts: bttsAnalysis,
            bttsOdds: null // Will be populated if odds are cached
          });
        }
      }
    });

    // Check cached odds
    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.bttsOdds = this.extractBTTSOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.btts.score - a.btts.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const grid = document.getElementById('top-picks-grid');
    const loading = document.getElementById('top-picks-loading');
    const progressBar = document.getElementById('top-picks-progress-bar');
    const progressText = document.getElementById('top-picks-progress-text');
    const btn = document.getElementById('btn-analyze');

    const bttsFixtures = this.getBTTSFixtures(fixtures);
    const toAnalyze = bttsFixtures.slice(0, this.MAX_ANALYZE);

    btn.style.display = 'none';
    loading.style.display = 'flex';
    grid.innerHTML = '';

    const results = [];
    let done = 0;

    // Phase 1: Fetch predictions for all fixtures
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
        const bttsAnalysis = Analysis.analyzeBTTS(data[0]);
        if (bttsAnalysis && bttsAnalysis.score >= THRESHOLDS.BTTS_MEDIUM) {
          results.push({
            fixture: f,
            prediction: data[0],
            btts: bttsAnalysis,
            bttsOdds: null
          });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    // Phase 2: Fetch odds for top BTTS candidates (max 10 to save API calls)
    const topCandidates = results
      .sort((a, b) => b.btts.score - a.btts.score)
      .slice(0, 10);

    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;

      progressText.textContent = `A buscar odds ${oddsCount + 1}/${topCandidates.length}...`;
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;

      if (oddsData) {
        r.bttsOdds = this.extractBTTSOdds(oddsData);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    // Sort by BTTS score, filter out low odds
    results.sort((a, b) => {
      // Prioritize matches with confirmed good odds
      const aHasOdds = a.bttsOdds && a.bttsOdds.yes >= THRESHOLDS.BTTS_MIN_ODDS;
      const bHasOdds = b.bttsOdds && b.bttsOdds.yes >= THRESHOLDS.BTTS_MIN_ODDS;
      if (aHasOdds && !bHasOdds) return -1;
      if (!aHasOdds && bHasOdds) return 1;
      return b.btts.score - a.btts.score;
    });

    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="top-picks__empty">
          Sem jogos com padrão BTTS forte identificado hoje
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  extractBTTSOdds(oddsData) {
    // API-Football odds structure: response[].bookmakers[].bets[]
    // BTTS bet has id 8 or name "Both Teams Score"
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const bttsBet = bk.bets?.find(b =>
          b.id === 8 || b.name === 'Both Teams Score' || b.name === 'Both Teams to Score'
        );
        if (bttsBet && bttsBet.values) {
          const yesOdd = bttsBet.values.find(v => v.value === 'Yes');
          const noOdd = bttsBet.values.find(v => v.value === 'No');
          return {
            yes: parseFloat(yesOdd?.odd || 0),
            no: parseFloat(noOdd?.odd || 0),
            bookmaker: bk.name || 'Unknown'
          };
        }
      }
    }
    return null;
  },

  renderResults(results) {
    const grid = document.getElementById('top-picks-grid');
    grid.innerHTML = '';

    // Filter out odds below minimum if odds are available
    const filtered = results.filter(r => {
      if (r.bttsOdds && r.bttsOdds.yes > 0 && r.bttsOdds.yes < THRESHOLDS.BTTS_MIN_ODDS) {
        return false; // Skip low odds (juice bets)
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="top-picks__empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.BTTS_MIN_ODDS})
        </div>`;
      return;
    }

    // Show top 15
    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderBTTSCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderBTTSCard(result, rank) {
    const { fixture, prediction, btts, bttsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    // Form strings
    const homeForm = prediction.teams?.home?.league?.form?.slice(-5) || '';
    const awayForm = prediction.teams?.away?.league?.form?.slice(-5) || '';

    const card = UI.el('div', 'btts-card');
    card.dataset.fixtureId = fixture.fixture.id;

    // Tier based on BTTS score
    const tier = btts.score >= THRESHOLDS.BTTS_FIRE ? 'fire' :
                 btts.score >= THRESHOLDS.BTTS_HIGH ? 'hot' : 'warm';

    // BTTS score color
    const scoreColor = btts.score >= THRESHOLDS.BTTS_FIRE ? 'var(--green)' :
                       btts.score >= THRESHOLDS.BTTS_HIGH ? 'var(--amber)' : 'var(--blue)';

    // Odds display
    let oddsHtml = '';
    if (bttsOdds && bttsOdds.yes > 0) {
      const oddsClass = bttsOdds.yes >= 1.70 ? 'btts-odds--value' :
                        bttsOdds.yes >= 1.50 ? 'btts-odds--fair' : 'btts-odds--low';
      oddsHtml = `
        <div class="btts-card__odds ${oddsClass}">
          <span class="btts-card__odds-label">BTTS Sim</span>
          <span class="btts-card__odds-value">${bttsOdds.yes.toFixed(2)}</span>
        </div>`;
    }

    // H2H BTTS display
    let h2hHtml = '';
    if (btts.stats.h2hBtts) {
      const h = btts.stats.h2hBtts;
      const h2hColor = h.rate >= 60 ? 'var(--green)' : h.rate >= 40 ? 'var(--amber)' : 'var(--red)';
      h2hHtml = `
        <div class="btts-card__h2h">
          <span class="btts-card__stat-label">H2H BTTS</span>
          <span style="color:${h2hColor};font-weight:700">${h.count}/${h.total} (${h.rate}%)</span>
        </div>`;
    }

    // League BTTS rate
    let leagueBttsHtml = '';
    if (btts.stats.leagueBttsRate) {
      leagueBttsHtml = `
        <div class="btts-card__league-btts">
          <span class="btts-card__stat-label">Liga BTTS</span>
          <span>${btts.stats.leagueBttsRate}%</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="btts-card__header">
        <div class="btts-card__rank">#${rank}</div>
        <div class="btts-card__tier btts-card__tier--${tier}">
          ${tier === 'fire' ? '&#128293;' : tier === 'hot' ? '&#11088;' : '&#9898;'}
        </div>
        <div class="btts-card__score-ring" style="--score-color:${scoreColor}">
          <span class="btts-card__score-value">${btts.score}</span>
          <span class="btts-card__score-label">BTTS</span>
        </div>
      </div>

      <div class="btts-card__league">${leagueName} &middot; ${time}</div>

      <div class="btts-card__matchup">
        <div class="btts-card__team">
          <img src="${home.logo}" alt="" class="btts-card__team-logo" onerror="this.style.display='none'">
          <span>${home.name}</span>
        </div>
        <span class="btts-card__vs">vs</span>
        <div class="btts-card__team">
          <img src="${away.logo}" alt="" class="btts-card__team-logo" onerror="this.style.display='none'">
          <span>${away.name}</span>
        </div>
      </div>

      ${oddsHtml}

      <div class="btts-card__stats-grid">
        <div class="btts-card__stat">
          <span class="btts-card__stat-label">Casa marca</span>
          <span class="btts-card__stat-value">${btts.stats.homeGoalsFor}/jogo</span>
        </div>
        <div class="btts-card__stat">
          <span class="btts-card__stat-label">Casa sofre</span>
          <span class="btts-card__stat-value">${btts.stats.homeGoalsAgainst}/jogo</span>
        </div>
        <div class="btts-card__stat">
          <span class="btts-card__stat-label">Fora marca</span>
          <span class="btts-card__stat-value">${btts.stats.awayGoalsFor}/jogo</span>
        </div>
        <div class="btts-card__stat">
          <span class="btts-card__stat-label">Fora sofre</span>
          <span class="btts-card__stat-value">${btts.stats.awayGoalsAgainst}/jogo</span>
        </div>
      </div>

      ${h2hHtml}
      ${leagueBttsHtml}

      <div class="btts-card__form">
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${home.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(homeForm)}</div>
        </div>
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${away.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(awayForm)}</div>
        </div>
      </div>

      ${btts.factors.length > 0 ? `
        <div class="btts-card__factors">
          ${btts.factors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="btts-card__factor ${isWarning ? 'btts-card__factor--warning' : ''}">
              ${isWarning ? '' : '&#10003; '}${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${(btts.learningFactors && btts.learningFactors.length > 0) || btts.risk ? `
        <div class="btts-card__learning">
          <div class="btts-card__learning-title">&#9889; Aprendizagem</div>
          ${(btts.learningFactors || []).map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="btts-card__learning-item ${isWarning ? 'btts-card__learning-item--warning' : 'btts-card__learning-item--boost'}">
              ${f}
            </div>`;
          }).join('')}
          ${btts.risk ? `
            <div class="btts-card__risk btts-card__risk--${btts.risk.level}">
              ${btts.risk.label}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${Bankroll.renderBadge(Bankroll.getBTTSStake(btts.score))}
    `;

    return card;
  },

  init() {
    document.getElementById('btn-analyze')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
