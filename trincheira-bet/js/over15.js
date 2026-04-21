const Over15 = {
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
    const section = document.getElementById('over15-section');
    const grid = document.getElementById('over15-grid');
    const btn = document.getElementById('btn-over15');
    const costSpan = document.getElementById('over15-cost');

    const over15Fixtures = this.getFixtures(fixtures);
    if (over15Fixtures.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const toFetch = Math.min(over15Fixtures.length, this.MAX_ANALYZE);
    let cached = 0;
    over15Fixtures.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    if (cached > 0) {
      this.showCachedResults(over15Fixtures.slice(0, toFetch));
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const analysis = Analysis.analyzeOver15(cached[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER15_MEDIUM) {
          results.push({ fixture: f, prediction: cached[0], over15: analysis, goalsOdds: null });
        }
      }
    });

    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.goalsOdds = this.extractGoalsOdds(cachedOdds, 1.5);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.over15.score - a.over15.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  extractGoalsOdds(oddsData, targetLine) {
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        const goalsBet = bk.bets?.find(b =>
          b.id === 5 || b.name === 'Goals Over/Under' || b.name === 'Over/Under'
        );
        if (goalsBet && goalsBet.values) {
          const overVal = goalsBet.values.find(v => v.value === `Over ${targetLine}`);
          const underVal = goalsBet.values.find(v => v.value === `Under ${targetLine}`);
          if (overVal) {
            return {
              line: targetLine,
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

    const grid = document.getElementById('over15-grid');
    const loading = document.getElementById('over15-loading');
    const progressBar = document.getElementById('over15-progress-bar');
    const progressText = document.getElementById('over15-progress-text');
    const btn = document.getElementById('btn-over15');

    const over15Fixtures = this.getFixtures(fixtures);
    const toAnalyze = over15Fixtures.slice(0, this.MAX_ANALYZE);

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
        const analysis = Analysis.analyzeOver15(data[0]);
        if (analysis && analysis.score >= THRESHOLDS.OVER15_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], over15: analysis, goalsOdds: null });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    const topCandidates = results
      .sort((a, b) => b.over15.score - a.over15.score)
      .slice(0, 10);

    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;

      progressText.textContent = `A buscar odds ${oddsCount + 1}/${topCandidates.length}...`;
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;

      if (oddsData) {
        r.goalsOdds = this.extractGoalsOdds(oddsData, 1.5);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.over15.score - a.over15.score);
    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="over15-empty">
          Sem jogos com padrão forte Over 1.5 identificado hoje
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  renderResults(results) {
    const grid = document.getElementById('over15-grid');
    grid.innerHTML = '';

    // Remove old accumulator container if exists
    const section = grid.parentElement;
    const oldAcca = section.querySelector('.over15-acca-wrapper');
    if (oldAcca) oldAcca.remove();

    const filtered = results.filter(r => {
      if (r.goalsOdds && r.goalsOdds.over > 0 && r.goalsOdds.over < THRESHOLDS.OVER15_MIN_ODDS) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="over15-empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.OVER15_MIN_ODDS})
        </div>`;
      return;
    }

    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderCard(r, idx + 1);
      grid.appendChild(card);
    });

    // Add accumulator suggestions after the grid
    const accaHtml = this.renderAccumulators(filtered);
    if (accaHtml) {
      const accaWrapper = document.createElement('div');
      accaWrapper.className = 'over15-acca-wrapper';
      accaWrapper.innerHTML = accaHtml;
      grid.parentElement.appendChild(accaWrapper);
    }
  },

  renderCard(result, rank) {
    const { fixture, prediction, over15, goalsOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;
    const odds = goalsOdds?.over || null;
    const stake = Bankroll.getOver15Stake(over15.score);

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'over25', marketLabel: 'Over 1.5 golos', pick: 'Over 1.5',
      odds, score: over15.score,
      factors: over15.factors,
      learningFactors: over15.learningFactors,
      stake
    });
  },

  // ===================== ACCUMULATOR BUILDER =====================
  // Combines top Over 1.5 picks into accumulators targeting odds 1.8-2.0
  // Over 1.5 odds are typically low (1.10-1.35), so we need 3-6 legs

  // Estimate Over 1.5 odds from score when API odds aren't available
  estimateOdds(score) {
    // Higher score = lower odds (more likely to happen)
    if (score >= 78) return 1.12;
    if (score >= 70) return 1.18;
    if (score >= 62) return 1.22;
    if (score >= 55) return 1.28;
    if (score >= 48) return 1.33;
    return 1.38;
  },

  getOddForResult(r) {
    if (r.goalsOdds && r.goalsOdds.over > 0) return r.goalsOdds.over;
    return this.estimateOdds(r.over15.score);
  },

  buildAccumulators(results) {
    if (results.length < 2) return [];

    // Sort by confidence (highest first) and take top picks
    const sorted = [...results].sort((a, b) => b.over15.score - a.over15.score);
    const picks = sorted.slice(0, 12); // Use top 12

    // Assign odds (real or estimated) to each pick
    picks.forEach(r => {
      r._odd = this.getOddForResult(r);
      r._oddSource = (r.goalsOdds && r.goalsOdds.over > 0) ? 'api' : 'est';
    });

    const TARGET = 1.9;
    const TARGET_MIN = 1.70;
    const TARGET_MAX = 2.15;
    const typeNames = ['', '', 'Dupla', 'Tripla', 'Quádrupla', 'Quíntupla', 'Séxtupla'];
    const accumulators = [];

    // Try combinations of 2 to 6 legs
    const tryCombo = (indices) => {
      let combinedOdds = 1;
      let totalScore = 0;
      const legs = [];
      for (const idx of indices) {
        combinedOdds *= picks[idx]._odd;
        totalScore += picks[idx].over15.score;
        legs.push(picks[idx]);
      }
      if (combinedOdds >= TARGET_MIN && combinedOdds <= TARGET_MAX) {
        accumulators.push({
          type: typeNames[indices.length] || `${indices.length}x`,
          legs,
          combinedOdds,
          avgScore: totalScore / indices.length,
          numLegs: indices.length
        });
      }
    };

    // Generate combos — limit iterations for performance
    const maxPicks = Math.min(picks.length, 10);

    // 3-leg combos (most common for Over 1.5)
    for (let i = 0; i < maxPicks; i++)
      for (let j = i + 1; j < maxPicks; j++)
        for (let k = j + 1; k < maxPicks; k++)
          tryCombo([i, j, k]);

    // 4-leg combos
    for (let i = 0; i < maxPicks; i++)
      for (let j = i + 1; j < maxPicks; j++)
        for (let k = j + 1; k < maxPicks; k++)
          for (let l = k + 1; l < maxPicks; l++)
            tryCombo([i, j, k, l]);

    // 5-leg combos (only if not enough results yet)
    if (accumulators.length < 3) {
      const max5 = Math.min(maxPicks, 8);
      for (let i = 0; i < max5; i++)
        for (let j = i + 1; j < max5; j++)
          for (let k = j + 1; k < max5; k++)
            for (let l = k + 1; l < max5; l++)
              for (let m = l + 1; m < max5; m++)
                tryCombo([i, j, k, l, m]);
    }

    // 2-leg combos (for higher individual odds)
    for (let i = 0; i < maxPicks; i++)
      for (let j = i + 1; j < maxPicks; j++)
        tryCombo([i, j]);

    if (accumulators.length === 0 && picks.length >= 3) {
      // Fallback: find the combo closest to 1.9
      let best = null;
      let bestDist = Infinity;
      for (let size = 3; size <= Math.min(6, picks.length); size++) {
        // Just try the top N picks
        const topN = picks.slice(0, size);
        let odds = 1;
        topN.forEach(r => odds *= r._odd);
        const dist = Math.abs(odds - TARGET);
        if (dist < bestDist) {
          bestDist = dist;
          best = {
            type: typeNames[size] || `${size}x`,
            legs: topN,
            combinedOdds: odds,
            avgScore: topN.reduce((s, r) => s + r.over15.score, 0) / size,
            numLegs: size
          };
        }
      }
      if (best) accumulators.push(best);
    }

    // Sort: prefer combos closest to 1.9, then by highest avg score
    accumulators.sort((a, b) => {
      const distA = Math.abs(a.combinedOdds - TARGET);
      const distB = Math.abs(b.combinedOdds - TARGET);
      if (Math.abs(distA - distB) < 0.05) return b.avgScore - a.avgScore;
      return distA - distB;
    });

    // Deduplicate: don't show combos with same legs
    const seen = new Set();
    const unique = [];
    for (const acca of accumulators) {
      const key = acca.legs.map(l => l.fixture.fixture.id).sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(acca);
      }
      if (unique.length >= 3) break;
    }

    return unique;
  },

  renderAccumulators(results) {
    const accas = this.buildAccumulators(results);
    if (accas.length === 0) return '';

    const baseStake = Bankroll.baseStake;

    const accaCards = accas.map((acca, idx) => {
      const legs = acca.legs.map(r => {
        const home = r.fixture.teams.home.name;
        const away = r.fixture.teams.away.name;
        const odd = r._odd.toFixed(2);
        const source = r._oddSource === 'est' ? '~' : '';
        const score = r.over15.score;
        return `
          <div class="acca-card__leg">
            <span class="acca-card__leg-teams">${home} vs ${away}</span>
            <span class="acca-card__leg-odd">${source}${odd}</span>
            <span class="acca-card__leg-score">${score}pts</span>
          </div>
        `;
      }).join('');

      const potReturn = (baseStake * acca.combinedOdds).toFixed(2);
      const hasEstimated = acca.legs.some(r => r._oddSource === 'est');

      return `
        <div class="acca-card">
          <div class="acca-card__header">
            <span class="acca-card__label">${acca.type} #${idx + 1}</span>
            <span class="acca-card__odds">${acca.combinedOdds.toFixed(2)}</span>
          </div>
          <div class="acca-card__legs">${legs}</div>
          <div class="acca-card__footer">
            <span class="acca-card__return">${baseStake}&euro; &rarr; <strong>${potReturn}&euro;</strong></span>
            <span class="acca-card__confidence">${acca.numLegs} pernas &middot; Conf. ${acca.avgScore.toFixed(0)}pts</span>
          </div>
          ${hasEstimated ? '<div style="font-size:10px;color:var(--text-muted);margin-top:4px">~ = odd estimada (sem dados API)</div>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="over15-accumulators">
        <div class="over15-accumulators__title">&#127942; Acumuladores Sugeridos</div>
        <div class="over15-accumulators__subtitle">Combinações Over 1.5 com odds alvo 1.8 — 2.0</div>
        ${accaCards}
      </div>
    `;
  },

  init() {
    document.getElementById('btn-over15')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
