const TopPicks = {
  MAX_ANALYZE: 25,
  analyzed: [],
  isAnalyzing: false,

  getPriorityFixtures(fixtures) {
    // Filter to priority leagues (priority 1 and 2) and only not-started matches
    return fixtures.filter(f => {
      const league = LEAGUES[f.league.id];
      if (!league || league.priority > 2) return false;
      const status = f.fixture.status.short;
      return status === 'NS' || status === 'TBD';
    });
  },

  show(fixtures) {
    const section = document.getElementById('top-picks-section');
    const grid = document.getElementById('top-picks-grid');
    const btn = document.getElementById('btn-analyze');
    const costSpan = document.getElementById('analyze-cost');

    const priority = this.getPriorityFixtures(fixtures);
    if (priority.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    // Count how many are already cached (free to analyze)
    const toFetch = Math.min(priority.length, this.MAX_ANALYZE);
    let cached = 0;
    priority.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    // If we have cached data, show previous results immediately
    if (cached > 0) {
      this.showCachedResults(priority.slice(0, toFetch), fixtures);
    }
  },

  showCachedResults(priorityFixtures, allFixtures) {
    const results = [];
    priorityFixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const patterns = Analysis.analyze(cached[0]);
        if (patterns.length > 0) {
          const bestPattern = patterns.reduce((a, b) => {
            const scoreA = this.confidenceScore(a);
            const scoreB = this.confidenceScore(b);
            return scoreA >= scoreB ? a : b;
          });
          results.push({
            fixture: f,
            prediction: cached[0],
            patterns,
            bestPattern,
            totalScore: patterns.reduce((sum, p) => sum + this.confidenceScore(p), 0)
          });
        }
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.totalScore - a.totalScore);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  async analyze(fixtures) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const section = document.getElementById('top-picks-section');
    const grid = document.getElementById('top-picks-grid');
    const loading = document.getElementById('top-picks-loading');
    const progressBar = document.getElementById('top-picks-progress-bar');
    const progressText = document.getElementById('top-picks-progress-text');
    const btn = document.getElementById('btn-analyze');

    const priority = this.getPriorityFixtures(fixtures);
    const toAnalyze = priority.slice(0, this.MAX_ANALYZE);

    btn.style.display = 'none';
    loading.style.display = 'flex';
    grid.innerHTML = '';

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      // Check remaining requests
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }

      progressBar.style.width = `${(done / toAnalyze.length) * 100}%`;
      progressText.textContent = `A analisar ${done + 1}/${toAnalyze.length}...`;

      const data = await API.getPrediction(f.fixture.id);
      done++;

      if (data && data.length > 0) {
        const prediction = data[0];
        const patterns = Analysis.analyze(prediction);

        if (patterns.length > 0) {
          const bestPattern = patterns.reduce((a, b) => {
            return this.confidenceScore(a) >= this.confidenceScore(b) ? a : b;
          });

          results.push({
            fixture: f,
            prediction,
            patterns,
            bestPattern,
            totalScore: patterns.reduce((sum, p) => sum + this.confidenceScore(p), 0)
          });
        }
      }

      // Small delay to not hammer the API
      await new Promise(r => setTimeout(r, 150));
    }

    // Sort by total confidence score
    results.sort((a, b) => b.totalScore - a.totalScore);
    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="top-picks__empty">
          Sem padrões fortes identificados nas ligas principais
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  confidenceScore(pattern) {
    const pct = parseInt(pattern.confidencePercent) || 0;
    const multiplier = pattern.confidence === 'high' ? 1.5 :
                       pattern.confidence === 'medium' ? 1.0 : 0.5;
    return pct * multiplier;
  },

  renderResults(results) {
    const grid = document.getElementById('top-picks-grid');
    grid.innerHTML = '';

    // Show top 12
    results.slice(0, 12).forEach(r => {
      const card = this.renderCard(r);
      grid.appendChild(card);
    });
  },

  renderCard(result) {
    const { fixture, prediction, patterns, bestPattern, totalScore } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    // Get form strings
    const homeForm = prediction.teams?.home?.league?.form?.slice(-5) || '';
    const awayForm = prediction.teams?.away?.league?.form?.slice(-5) || '';

    // Goals stats
    const homeGoalsFor = prediction.teams?.home?.league?.goals?.for?.average?.total || '?';
    const homeGoalsAgainst = prediction.teams?.home?.league?.goals?.against?.average?.total || '?';
    const awayGoalsFor = prediction.teams?.away?.league?.goals?.for?.average?.total || '?';
    const awayGoalsAgainst = prediction.teams?.away?.league?.goals?.against?.average?.total || '?';

    const card = UI.el('div', 'top-pick-card');
    card.dataset.fixtureId = fixture.fixture.id;

    // Confidence tier
    const tier = totalScore >= 120 ? 'fire' : totalScore >= 80 ? 'hot' : 'warm';

    card.innerHTML = `
      <div class="top-pick-card__tier top-pick-card__tier--${tier}">
        ${tier === 'fire' ? '&#128293;' : tier === 'hot' ? '&#11088;' : '&#9898;'}
      </div>
      <div class="top-pick-card__league">${leagueName} &middot; ${time}</div>
      <div class="top-pick-card__matchup">
        <div class="top-pick-card__team">
          <img src="${home.logo}" alt="" class="top-pick-card__team-logo" onerror="this.style.display='none'">
          <span>${home.name}</span>
        </div>
        <span class="top-pick-card__vs">vs</span>
        <div class="top-pick-card__team">
          <img src="${away.logo}" alt="" class="top-pick-card__team-logo" onerror="this.style.display='none'">
          <span>${away.name}</span>
        </div>
      </div>
      <div class="top-pick-card__form">
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${home.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(homeForm)}</div>
        </div>
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${away.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(awayForm)}</div>
        </div>
      </div>
      <div class="top-pick-card__stats">
        <span title="Golos marcados/sofridos casa">&#9917; ${homeGoalsFor}/${homeGoalsAgainst}</span>
        <span title="Golos marcados/sofridos fora">&#9917; ${awayGoalsFor}/${awayGoalsAgainst}</span>
      </div>
      <div class="top-pick-card__patterns">
        ${patterns.map(p => `
          <span class="pattern-badge pattern-badge--${p.confidence} ${Picks.isPicked(fixture.fixture.id, p.key) ? 'picked' : ''}"
                data-pattern="${p.key}"
                data-fixture="${fixture.fixture.id}"
                data-home="${home.name}"
                data-away="${away.name}"
                data-label="${p.label}"
                data-confidence="${p.confidencePercent}"
                title="${p.detail || ''}">
            ${p.label} <span class="pattern-badge__confidence">${p.confidencePercent}</span>
          </span>
        `).join('')}
      </div>
      ${bestPattern.detail ? `<div class="top-pick-card__insight">${bestPattern.detail}</div>` : ''}
    `;

    // Click on pattern badges to pick
    card.querySelectorAll('.pattern-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = parseInt(badge.dataset.fixture);
        const pKey = badge.dataset.pattern;
        const added = Picks.add({
          fixtureId: fId,
          patternKey: pKey,
          patternLabel: badge.dataset.label,
          confidencePercent: badge.dataset.confidence,
          homeTeam: badge.dataset.home,
          awayTeam: badge.dataset.away
        });
        badge.classList.toggle('picked', added);
      });
    });

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
