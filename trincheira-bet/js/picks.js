const Picks = {
  STORAGE_KEY: 'tb_picks',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  save(picks) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(picks));
    this.render();
    this.updateFab();
  },

  add(pick) {
    const picks = this.getAll();
    const exists = picks.find(p => p.fixtureId === pick.fixtureId && p.patternKey === pick.patternKey);
    if (exists) {
      this.remove(pick.fixtureId, pick.patternKey);
      return false;
    }
    picks.push(pick);
    this.save(picks);
    UI.showToast(`${pick.patternLabel} adicionado`, 'success');
    return true;
  },

  remove(fixtureId, patternKey) {
    const picks = this.getAll().filter(p => !(p.fixtureId === fixtureId && p.patternKey === patternKey));
    this.save(picks);
  },

  clear() {
    this.save([]);
    UI.showToast('Picks limpos', 'info');
  },

  isPicked(fixtureId, patternKey) {
    return this.getAll().some(p => p.fixtureId === fixtureId && p.patternKey === patternKey);
  },

  render() {
    const list = document.getElementById('picks-list');
    const count = document.getElementById('picks-count');
    const empty = document.getElementById('picks-empty');
    if (!list) return;

    const picks = this.getAll();
    if (count) count.textContent = picks.length;

    if (picks.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';
    list.innerHTML = picks.map(p => `
      <div class="pick-item" data-fixture="${p.fixtureId}" data-pattern="${p.patternKey}">
        <div class="pick-item__info">
          <div class="pick-item__teams">${p.homeTeam} vs ${p.awayTeam}</div>
          <div class="pick-item__pattern">${p.patternLabel} ${p.confidencePercent || ''}</div>
        </div>
        <button class="pick-item__remove" data-action="remove-pick">&times;</button>
      </div>
    `).join('');
  },

  updateFab() {
    const fab = document.getElementById('picks-fab');
    if (!fab) return;
    const count = this.getAll().length;
    fab.textContent = count || '0';
    fab.style.display = count > 0 || window.innerWidth < 1024 ? 'flex' : 'none';
  },

  init() {
    this.render();
    this.updateFab();

    // Clear button
    document.getElementById('picks-clear')?.addEventListener('click', () => this.clear());

    // FAB toggle
    document.getElementById('picks-fab')?.addEventListener('click', () => {
      document.getElementById('picks-sidebar')?.classList.toggle('open');
    });

    // Sidebar backdrop close
    document.getElementById('picks-sidebar')?.addEventListener('click', (e) => {
      if (e.target.id === 'picks-sidebar') {
        e.target.classList.remove('open');
      }
    });

    // Remove pick delegation
    document.getElementById('picks-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-pick"]');
      if (!btn) return;
      const item = btn.closest('.pick-item');
      const fixtureId = parseInt(item.dataset.fixture);
      const patternKey = item.dataset.pattern;
      this.remove(fixtureId, patternKey);
    });
  }
};
