const Fixtures = {
  currentDate: null,
  fixturesData: [],

  async load(date) {
    this.currentDate = date;
    const data = await API.getFixtures(date);

    if (!data || data.length === 0) {
      this.fixturesData = [];
      return;
    }

    this.fixturesData = data;

    // Only render to old container if it exists
    const container = document.getElementById('fixtures-container');
    if (container) {
      this.render(data);
    }
  },

  groupByLeague(fixtures) {
    const groups = {};
    fixtures.forEach(f => {
      const leagueId = f.league.id;
      if (!groups[leagueId]) {
        groups[leagueId] = {
          id: leagueId,
          name: f.league.name,
          country: f.league.country,
          logo: f.league.logo,
          flag: f.league.flag,
          fixtures: []
        };
      }
      groups[leagueId].fixtures.push(f);
    });

    // Sort: priority leagues first, then alphabetical
    return Object.values(groups).sort((a, b) => {
      const pa = LEAGUES[a.id]?.priority || 5;
      const pb = LEAGUES[b.id]?.priority || 5;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  },

  render(fixtures) {
    const container = document.getElementById('fixtures-container');
    container.innerHTML = '';
    this.populateLeagueFilter(fixtures);

    const groups = this.groupByLeague(fixtures);
    groups.forEach(group => {
      const section = this.renderLeagueSection(group);
      container.appendChild(section);
    });
  },

  renderLeagueSection(group) {
    const isPriority = (LEAGUES[group.id]?.priority || 5) <= 2;
    const section = UI.el('div', 'league-section');
    section.dataset.leagueId = group.id;

    section.innerHTML = `
      <div class="league-header ${isPriority ? '' : 'collapsed'}">
        ${group.flag ? `<img class="league-header__flag" src="${group.flag}" alt="${group.country}" loading="lazy" onerror="this.style.display='none'">` : ''}
        ${group.logo ? `<img class="league-header__logo" src="${group.logo}" alt="${group.name}" loading="lazy" onerror="this.style.display='none'">` : ''}
        <span class="league-header__name">${group.name}</span>
        <span class="league-header__count">${group.fixtures.length} jogos</span>
        <span class="league-header__toggle">&#9660;</span>
      </div>
      <div class="league-fixtures ${isPriority ? '' : 'hidden'}">
      </div>
    `;

    const fixturesContainer = section.querySelector('.league-fixtures');
    group.fixtures
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .forEach(f => {
        fixturesContainer.appendChild(this.renderMatchCard(f));
      });

    // Toggle accordion
    section.querySelector('.league-header').addEventListener('click', () => {
      const header = section.querySelector('.league-header');
      const body = section.querySelector('.league-fixtures');
      header.classList.toggle('collapsed');
      body.classList.toggle('hidden');
    });

    return section;
  },

  renderMatchCard(fixture) {
    const card = UI.el('div', 'match-card');
    card.dataset.fixtureId = fixture.fixture.id;

    const homeTeam = fixture.teams.home;
    const awayTeam = fixture.teams.away;
    const time = UI.renderMatchTime(fixture);
    const score = UI.renderScore(fixture);

    card.innerHTML = `
      <div class="match-card__header">
        <div class="match-card__time">${time}</div>
        <div class="match-card__teams">
          <div class="match-card__team">
            <img class="match-card__team-logo" src="${homeTeam.logo}" alt="" loading="lazy" onerror="this.style.display='none'">
            <span class="match-card__team-name">${homeTeam.name}</span>
            ${score ? `<span class="match-card__score">${fixture.goals.home}</span>` : ''}
          </div>
          <div class="match-card__team">
            <img class="match-card__team-logo" src="${awayTeam.logo}" alt="" loading="lazy" onerror="this.style.display='none'">
            <span class="match-card__team-name">${awayTeam.name}</span>
            ${score ? `<span class="match-card__score">${fixture.goals.away}</span>` : ''}
          </div>
        </div>
        <div class="match-card__patterns-preview" id="patterns-preview-${fixture.fixture.id}"></div>
        <span class="match-card__expand-icon">&#9660;</span>
      </div>
      <div class="match-detail" id="detail-${fixture.fixture.id}">
        <div class="match-detail__loading">A carregar análise...</div>
      </div>
    `;

    // Click to expand and load prediction
    card.querySelector('.match-card__header').addEventListener('click', () => {
      const isExpanded = card.classList.contains('expanded');
      // Close all other expanded cards
      document.querySelectorAll('.match-card.expanded').forEach(c => {
        if (c !== card) c.classList.remove('expanded');
      });

      card.classList.toggle('expanded');
      if (!isExpanded && !card.dataset.loaded) {
        this.loadPrediction(fixture.fixture.id, fixture);
      }
    });

    return card;
  },

  async loadPrediction(fixtureId, fixture) {
    const detail = document.getElementById(`detail-${fixtureId}`);
    const card = detail.closest('.match-card');

    const data = await API.getPrediction(fixtureId);
    card.dataset.loaded = 'true';

    if (!data || data.length === 0) {
      detail.innerHTML = `<div class="match-detail__loading">Sem dados de análise disponíveis</div>`;
      return;
    }

    const prediction = data[0];
    const patterns = Analysis.analyze(prediction);

    // Store patterns on card for filtering
    card.dataset.patterns = patterns.map(p => p.key).join(',');
    if (patterns.length > 0) card.classList.add('has-patterns');

    // Render preview badges
    const preview = document.getElementById(`patterns-preview-${fixtureId}`);
    if (preview && patterns.length > 0) {
      preview.innerHTML = patterns
        .filter(p => p.confidence === CONFIDENCE.HIGH || p.confidence === CONFIDENCE.MEDIUM)
        .slice(0, 3)
        .map(p => `<span class="pattern-badge pattern-badge--${p.confidence}" style="font-size:10px;padding:2px 6px">${p.shortLabel || p.label}</span>`)
        .join('');
    }

    this.renderDetail(detail, prediction, patterns, fixtureId, fixture);
  },

  renderDetail(container, prediction, patterns, fixtureId, fixture) {
    const teams = prediction.teams;
    const homeForm = teams?.home?.league?.form || '';
    const awayForm = teams?.away?.league?.form || '';
    const comp = Analysis.getComparison(prediction);
    const h2h = prediction.h2h || [];
    const advice = prediction.predictions;

    const homeTeamName = fixture.teams.home.name;
    const awayTeamName = fixture.teams.away.name;

    container.innerHTML = `
      ${patterns.length > 0 ? `
        <div class="match-detail__section">
          <div class="match-detail__title">Padrões Identificados</div>
          <div class="patterns-list">
            ${patterns.map(p => UI.renderPatternBadge(p, Picks.isPicked(fixtureId, p.key))).join('')}
          </div>
        </div>
      ` : ''}

      <div class="match-detail__section">
        <div class="match-detail__title">Forma Recente (últimos 5)</div>
        ${UI.renderFormRow(homeTeamName, homeForm.slice(-5))}
        ${UI.renderFormRow(awayTeamName, awayForm.slice(-5))}
      </div>

      <div class="match-detail__section">
        <div class="match-detail__title">Comparação</div>
        ${UI.renderStatBar('Forma', comp.homeForm, comp.awayForm)}
        ${UI.renderStatBar('Ataque', comp.homeAtt, comp.awayAtt)}
        ${UI.renderStatBar('Defesa', comp.homeDef, comp.awayDef)}
        ${UI.renderStatBar('Golos', comp.homeGoals, comp.awayGoals)}
        ${UI.renderStatBar('Total', comp.homeTotal, comp.awayTotal)}
      </div>

      <div class="match-detail__section">
        <div class="match-detail__title">Estatísticas de Golos</div>
        <div style="font-size:var(--fs-xs);color:var(--text-secondary);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
          <div>
            <strong>${homeTeamName}</strong><br>
            Marca: ${teams?.home?.league?.goals?.for?.average?.total || '?'}/jogo<br>
            Sofre: ${teams?.home?.league?.goals?.against?.average?.total || '?'}/jogo
          </div>
          <div>
            <strong>${awayTeamName}</strong><br>
            Marca: ${teams?.away?.league?.goals?.for?.average?.total || '?'}/jogo<br>
            Sofre: ${teams?.away?.league?.goals?.against?.average?.total || '?'}/jogo
          </div>
        </div>
      </div>

      ${h2h.length > 0 ? `
        <div class="match-detail__section">
          <div class="match-detail__title">Confrontos Diretos (últimos ${Math.min(h2h.length, 5)})</div>
          ${h2h.slice(0, 5).map(m => {
            const date = new Date(m.fixture.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
            return `<div class="h2h-item">
              <span>${date}</span>
              <span style="flex:1;text-align:right;font-size:var(--fs-xs)">${m.teams.home.name}</span>
              <span class="h2h-item__score">${m.goals.home} - ${m.goals.away}</span>
              <span style="flex:1;font-size:var(--fs-xs)">${m.teams.away.name}</span>
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${advice?.winner ? `
        <div class="match-detail__section">
          <div class="match-detail__title">Previsão da API</div>
          <div style="font-size:var(--fs-sm);color:var(--text-secondary)">
            <strong style="color:var(--green)">${advice.winner.name}</strong>
            ${advice.winner.comment ? `— ${advice.winner.comment}` : ''}
          </div>
        </div>
      ` : ''}
    `;

    // Pattern badge click → add to picks
    container.querySelectorAll('.pattern-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const patternKey = badge.dataset.pattern;
        const pattern = patterns.find(p => p.key === patternKey);
        if (!pattern) return;

        const added = Picks.add({
          fixtureId,
          patternKey,
          patternLabel: pattern.label,
          confidencePercent: pattern.confidencePercent,
          homeTeam: homeTeamName,
          awayTeam: awayTeamName
        });

        badge.classList.toggle('picked', added);
        // Update all badges with same pattern in this card
        if (!added) {
          container.querySelectorAll(`[data-pattern="${patternKey}"]`).forEach(b => b.classList.remove('picked'));
        }
      });
    });
  },

  populateLeagueFilter(fixtures) {
    const select = document.getElementById('league-filter');
    if (!select) return;

    const leagues = new Map();
    fixtures.forEach(f => {
      if (!leagues.has(f.league.id)) {
        leagues.set(f.league.id, f.league.name);
      }
    });

    select.innerHTML = '<option value="">Todas as Ligas</option>';
    [...leagues.entries()]
      .sort((a, b) => {
        const pa = LEAGUES[a[0]]?.priority || 5;
        const pb = LEAGUES[b[0]]?.priority || 5;
        if (pa !== pb) return pa - pb;
        return a[1].localeCompare(b[1]);
      })
      .forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
      });
  },

  filterByLeague(leagueId) {
    document.querySelectorAll('.league-section').forEach(section => {
      if (!leagueId || section.dataset.leagueId === leagueId) {
        section.style.display = '';
        // Expand if filtering to specific league
        if (leagueId) {
          section.querySelector('.league-header')?.classList.remove('collapsed');
          section.querySelector('.league-fixtures')?.classList.remove('hidden');
        }
      } else {
        section.style.display = 'none';
      }
    });
  },

  filterByPattern(patternKey) {
    // This filter highlights cards that have the pattern, dims others
    document.querySelectorAll('.match-card').forEach(card => {
      if (!patternKey) {
        card.style.opacity = '';
        return;
      }
      const cardPatterns = (card.dataset.patterns || '').split(',');
      card.style.opacity = cardPatterns.includes(patternKey) ? '' : '0.3';
    });
  }
};
