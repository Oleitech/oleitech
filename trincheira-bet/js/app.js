const App = {
  selectedDate: 0, // 0 = today, 1 = tomorrow, -1 = yesterday
  activePatternFilter: null,

  async init() {
    // Purge expired cache on load
    Cache.purge();

    // Update request counter
    UI.updateRequestCounter();

    // Initialize learning engine (must load before scanners use it)
    await Learning.init();

    // Initialize picks
    Picks.init();

    // Initialize top picks
    TopPicks.init();

    // Initialize corners scanner
    Corners.init();

    // Initialize history (seed data + render)
    History.seedData();
    History.init();

    // Setup date tabs
    this.setupDateTabs();

    // Setup filters
    this.setupFilters();

    // Load today's fixtures
    await this.loadDate(0);
  },

  setupDateTabs() {
    document.querySelectorAll('.date-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const offset = parseInt(tab.dataset.offset);
        this.loadDate(offset);
      });
    });
  },

  setupFilters() {
    // League filter
    document.getElementById('league-filter')?.addEventListener('change', (e) => {
      Fixtures.filterByLeague(e.target.value);
    });

    // Pattern filter chips
    document.querySelectorAll('.filter-chip[data-pattern]').forEach(chip => {
      chip.addEventListener('click', () => {
        const pattern = chip.dataset.pattern;
        const isActive = chip.classList.contains('active');

        // Deactivate all chips
        document.querySelectorAll('.filter-chip[data-pattern]').forEach(c => c.classList.remove('active'));

        if (!isActive) {
          chip.classList.add('active');
          this.activePatternFilter = pattern;
          Fixtures.filterByPattern(pattern);
        } else {
          this.activePatternFilter = null;
          Fixtures.filterByPattern(null);
        }
      });
    });

    // Refresh button
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      const dateStr = UI.getDateStr(this.selectedDate);
      Cache.remove(`fixtures_date=${dateStr}`);
      this.loadDate(this.selectedDate);
      UI.showToast('A atualizar jogos...', 'info');
    });
  },

  async loadDate(offset) {
    this.selectedDate = offset;
    const dateStr = UI.getDateStr(offset);

    // Update active tab
    document.querySelectorAll('.date-tab').forEach(tab => {
      tab.classList.toggle('active', parseInt(tab.dataset.offset) === offset);
    });

    // Update date display
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const display = document.getElementById('date-display');
    if (display) display.textContent = UI.formatDate(d);

    // Reset filters
    this.activePatternFilter = null;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const leagueFilter = document.getElementById('league-filter');
    if (leagueFilter) leagueFilter.value = '';

    // Load fixtures
    await Fixtures.load(dateStr);

    // Show scanner sections with fixture data
    TopPicks.show(Fixtures.fixturesData);
    Corners.show(Fixtures.fixturesData);
  }
};

// Boot — auto-init if logged in or on localhost (Auth handles post-login init)
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn() || Auth.isLocalhost()) App.init();
});
