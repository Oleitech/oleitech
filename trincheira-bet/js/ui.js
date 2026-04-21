const UI = {
  el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html) e.innerHTML = html;
    return e;
  },

  updateRequestCounter() {
    const counter = document.getElementById('request-counter');
    if (!counter) return;
    const remaining = Cache.getRemainingRequests();
    const value = counter.querySelector('.header__counter-value');
    if (value) value.textContent = remaining;
    counter.classList.remove('warning', 'critical');
    if (remaining <= 20) counter.classList.add('critical');
    else if (remaining <= 50) counter.classList.add('warning');
  },

  showLoading(container) {
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      container.appendChild(this.el('div', 'skeleton skeleton-card'));
    }
  },

  hideLoading(container) {
    container.querySelectorAll('.skeleton').forEach(s => s.remove());
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = this.el('div', `toast ${type}`, message);
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  renderFormBadges(formString) {
    if (!formString) return '';
    return formString.split('').map(r => {
      if (r === '?') return '';
      return `<span class="form-badge ${r}">${r}</span>`;
    }).join('');
  },

  renderFormRow(label, formString) {
    return `
      <div class="form-row">
        <span class="form-row__label">${label}</span>
        <div class="form-badges">${this.renderFormBadges(formString)}</div>
      </div>
    `;
  },

  renderPatternBadge(pattern, isPicked = false) {
    const confidenceClass = `pattern-badge--${pattern.confidence}`;
    const pickedClass = isPicked ? 'picked' : '';
    return `
      <span class="pattern-badge ${confidenceClass} ${pickedClass}"
            data-pattern="${pattern.key}"
            title="${pattern.detail || ''}">
        ${pattern.label}
        <span class="pattern-badge__confidence">${pattern.confidencePercent || ''}</span>
      </span>
    `;
  },

  renderStatBar(label, homeVal, awayVal) {
    const total = (homeVal || 0) + (awayVal || 0);
    const homePct = total > 0 ? Math.round((homeVal / total) * 100) : 50;
    const awayPct = 100 - homePct;
    return `
      <div class="stat-bar">
        <div class="stat-bar__label">
          <span>${homePct}%</span>
          <span>${label}</span>
          <span>${awayPct}%</span>
        </div>
        <div class="stat-bar__track">
          <div class="stat-bar__fill-home" style="width:${homePct}%"></div>
          <div class="stat-bar__fill-away" style="width:${awayPct}%"></div>
        </div>
      </div>
    `;
  },

  renderMatchTime(fixture) {
    const status = fixture.fixture.status.short;
    if (LIVE_STATUSES.includes(status)) {
      const elapsed = fixture.fixture.status.elapsed;
      return `<span class="live">${elapsed || status}'</span>`;
    }
    if (FINISHED_STATUSES.includes(status)) {
      return STATUS_MAP[status] || status;
    }
    const date = new Date(fixture.fixture.date);
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  },

  renderScore(fixture) {
    const goals = fixture.goals;
    const status = fixture.fixture.status.short;
    if (status === 'NS' || status === 'TBD' || status === 'PST') return '';
    if (goals.home === null) return '';
    return `${goals.home} - ${goals.away}`;
  },

  formatDate(date) {
    return date.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  },

  getDateStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  },

  // New design: render a tip card
  renderTipCard({ home, away, homeLogo, awayLogo, league, time, marketKey, marketLabel, pick, odds, score, factors, learningFactors, stake }) {
    const MARKET_COLORS = {
      btts: 'var(--m-btts)', over25: 'var(--m-over)', cards: 'var(--m-cards)', corners: 'var(--m-corners)'
    };
    const MARKET_LABELS = {
      btts: 'Ambas marcam', over25: 'Mais de 2.5 golos', cards: 'Cartões', corners: 'Cantos'
    };
    const color = MARKET_COLORS[marketKey] || 'var(--accent)';
    const label = marketLabel || MARKET_LABELS[marketKey] || marketKey;
    const confLevel = score >= 80 ? 'Alta' : score >= 70 ? 'Média' : 'Baixa';
    const homeShort = (home || '').slice(0, 3).toUpperCase();
    const awayShort = (away || '').slice(0, 3).toUpperCase();

    // Build reasons list from factors
    const allFactors = [...(factors || []), ...(learningFactors || [])];
    const reasonsHtml = allFactors.length > 0 ? `
      <ul class="reasoning">
        ${allFactors.slice(0, 4).map(f => `<li>${f.replace(/^[✓⚠️🔥⚡✔️⭐●◯\u26A0\u2713\u2714\u2B50\u26BD\u2615\u2757]/g, '').trim()}</li>`).join('')}
      </ul>` : '';

    const card = this.el('article', 'tip');
    card.innerHTML = `
      <div class="tip-top">
        <div class="tip-league">
          <span class="flag" style="background:${color};opacity:0.6"></span>
          <span>${league || ''}</span>
        </div>
        <div class="tip-time">${time || ''}</div>
      </div>
      <div class="tip-fixture">
        <div class="team team--home">
          ${homeLogo ? `<img src="${homeLogo}" alt="" style="width:32px;height:32px;border-radius:50%;background:var(--bg-elev-3);object-fit:contain" onerror="this.outerHTML='<div class=\\'crest\\'>${homeShort}</div>'">` : `<div class="crest">${homeShort}</div>`}
          <div class="team-name">${home || ''}</div>
        </div>
        <div class="tip-vs">VS</div>
        <div class="team team--away">
          ${awayLogo ? `<img src="${awayLogo}" alt="" style="width:32px;height:32px;border-radius:50%;background:var(--bg-elev-3);object-fit:contain" onerror="this.outerHTML='<div class=\\'crest\\'>${awayShort}</div>'">` : `<div class="crest">${awayShort}</div>`}
          <div class="team-name">${away || ''}</div>
        </div>
      </div>
      <div class="tip-market">
        <div class="market-label">
          <span class="market-dot" style="background:${color}"></span>
          <span class="market-name">${label}</span>
        </div>
        <div class="market-pick">${pick || ''}</div>
      </div>
      ${reasonsHtml}
      <div class="tip-meta-row">
        <div class="odds">
          <span class="label">Odds</span>
          <span class="value num">${odds ? odds.toFixed(2) : '—'}</span>
        </div>
        <div class="stake">
          <span class="label">Stake</span>
          <span class="value num">${stake ? (typeof stake === 'object' ? (stake.multiplier * (typeof Bankroll !== 'undefined' ? Bankroll.baseStake : 4)).toFixed(0) + '€' : stake + '€') : '—'}</span>
        </div>
        <div></div>
        <div class="conf">
          <div class="conf-text">
            <span class="label">Confiança</span>
            <span class="value">${confLevel}</span>
          </div>
          ${Layout.renderConfRing(score)}
        </div>
      </div>
    `;
    return card;
  }
};
