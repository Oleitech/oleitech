const Corners = {
  MAX_ANALYZE: 30,
  analyzed: [],
  isAnalyzing: false,

  // Get fixtures from corner-friendly leagues, sorted by league avg corners
  getCornersFixtures(fixtures) {
    return fixtures
      .filter(f => {
        const status = f.fixture.status.short;
        if (status !== 'NS' && status !== 'TBD') return false;
        const league = LEAGUES[f.league.id];
        return league && league.priority <= 3;
      })
      .sort((a, b) => {
        const cA = LEAGUES[a.league.id]?.avgCorners || 0;
        const cB = LEAGUES[b.league.id]?.avgCorners || 0;
        return cB - cA;
      });
  },

  show(fixtures) {
    const section = document.getElementById('corners-section');
    const grid = document.getElementById('corners-grid');
    const btn = document.getElementById('btn-corners');
    const costSpan = document.getElementById('corners-cost');

    const cornersFixtures = this.getCornersFixtures(fixtures);
    if (cornersFixtures.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    const toFetch = Math.min(cornersFixtures.length, this.MAX_ANALYZE);
    let cached = 0;
    cornersFixtures.slice(0, toFetch).forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      if (Cache.get(`predictions_${qs}`)) cached++;
    });
    const cost = toFetch - cached;

    costSpan.textContent = cost > 0 ? `(${cost} requests)` : '(em cache)';
    btn.style.display = '';
    grid.innerHTML = '';
    this.analyzed = [];

    if (cached > 0) {
      this.showCachedResults(cornersFixtures.slice(0, toFetch));
    }
  },

  showCachedResults(fixtures) {
    const results = [];
    fixtures.forEach(f => {
      const qs = new URLSearchParams({ fixture: f.fixture.id }).toString();
      const cached = Cache.get(`predictions_${qs}`);
      if (cached && cached.length > 0) {
        const analysis = this.analyzeCorners(cached[0], f);
        if (analysis && analysis.score >= THRESHOLDS.CORNERS_MEDIUM) {
          results.push({ fixture: f, prediction: cached[0], corners: analysis, cornersOdds: null });
        }
      }
    });

    // Check cached odds
    results.forEach(r => {
      const qs = new URLSearchParams({ fixture: r.fixture.fixture.id }).toString();
      const cachedOdds = Cache.get(`odds_${qs}`);
      if (cachedOdds) {
        r.cornersOdds = this.extractCornersOdds(cachedOdds);
      }
    });

    if (results.length > 0) {
      results.sort((a, b) => b.corners.score - a.corners.score);
      this.analyzed = results;
      this.renderResults(results);
    }
  },

  // ===================== CORNERS ANALYSIS =====================
  analyzeCorners(prediction, fixture) {
    if (!prediction) return null;

    const teams = prediction.teams;
    const comp = Analysis.getComparison(prediction);
    const h2h = prediction.h2h || [];
    const leagueId = fixture.league.id;
    const leagueData = LEAGUES[leagueId];

    const homeGoalsFor = parseFloat(teams?.home?.league?.goals?.for?.average?.total || 0);
    const homeGoalsAgainst = parseFloat(teams?.home?.league?.goals?.against?.average?.total || 0);
    const awayGoalsFor = parseFloat(teams?.away?.league?.goals?.for?.average?.total || 0);
    const awayGoalsAgainst = parseFloat(teams?.away?.league?.goals?.against?.average?.total || 0);

    let score = 0;
    const factors = [];

    // === Factor 1: League average corners ===
    const leagueAvg = leagueData?.avgCorners || 9.5;
    if (leagueAvg >= 10.5) {
      score += 15;
      factors.push(`Liga alta em cantos (${leagueAvg}/jogo)`);
    } else if (leagueAvg >= 9.8) {
      score += 10;
      factors.push(`Liga acima da média (${leagueAvg}/jogo)`);
    } else if (leagueAvg >= 9.3) {
      score += 5;
    } else {
      score -= 3;
    }

    // === Factor 2: Combined attacking strength (proxy for corners) ===
    // Teams that attack more generate more corners
    const combinedAttack = (homeGoalsFor + awayGoalsFor) / 2;
    if (combinedAttack >= 1.8) {
      score += 15;
      factors.push(`Ambas equipas muito ofensivas (${combinedAttack.toFixed(1)} golos/jogo média)`);
    } else if (combinedAttack >= 1.4) {
      score += 10;
    } else if (combinedAttack >= 1.1) {
      score += 5;
    }

    // === Factor 3: Both teams concede = open game = more corners ===
    const combinedConceded = (homeGoalsAgainst + awayGoalsAgainst) / 2;
    if (combinedConceded >= 1.5) {
      score += 12;
      factors.push(`Defesas permeáveis (${combinedConceded.toFixed(1)} sofridos/jogo média)`);
    } else if (combinedConceded >= 1.2) {
      score += 8;
    } else if (combinedConceded >= 1.0) {
      score += 4;
    }

    // Penalty: very tight defenses = fewer attacking plays = fewer corners
    if (homeGoalsAgainst < 0.7 || awayGoalsAgainst < 0.7) {
      score -= 8;
      factors.push('⚠ Uma equipa sofre muito poucos golos');
    }

    // === Factor 4: Attack comparison (both teams pushing forward) ===
    if (comp.homeAtt >= 50 && comp.awayAtt >= 50) {
      score += 10;
      factors.push('Ambos ataques fortes na comparação');
    } else if (comp.homeAtt >= 45 && comp.awayAtt >= 45) {
      score += 5;
    }

    // One dominant attacker also generates corners (they pressure, corners come)
    if (comp.homeAtt >= 65 || comp.awayAtt >= 65) {
      score += 5;
      factors.push('Uma equipa com ataque dominante (pressão alta = cantos)');
    }

    // === Factor 5: Match competitiveness ===
    // Close matches generate more corners (both teams pushing)
    const totalDiff = Math.abs(comp.homeTotal - comp.awayTotal);
    if (totalDiff < 10) {
      score += 10;
      factors.push('Jogo muito equilibrado (ambos vão atacar)');
    } else if (totalDiff < 20) {
      score += 5;
    } else if (totalDiff > 35) {
      // Very one-sided can still generate corners (dominant team presses)
      score += 2;
    }

    // === Factor 6: Form — teams in good form attack more ===
    const homeForm = Analysis.parseForm(teams?.home?.league?.form);
    const awayForm = Analysis.parseForm(teams?.away?.league?.form);

    const homeActive = homeForm.wins + homeForm.draws;
    const awayActive = awayForm.wins + awayForm.draws;

    if (homeActive >= 3 && awayActive >= 3) {
      score += 8;
      factors.push('Ambas equipas em boa forma (jogam para a frente)');
    } else if (homeActive >= 3 || awayActive >= 3) {
      score += 3;
    }

    // === Factor 7: H2H corners (from past match stats) ===
    if (h2h.length >= 3) {
      const h2hGoals = this.calculateH2HGoals(h2h);
      // High-scoring H2H = likely high corners too
      if (h2hGoals.avgGoals >= 3.5) {
        score += 10;
        factors.push(`H2H alto: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo (${h2hGoals.total} jogos)`);
      } else if (h2hGoals.avgGoals >= 2.8) {
        score += 5;
        factors.push(`H2H: ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      } else if (h2hGoals.avgGoals < 2.0) {
        score -= 5;
        factors.push(`⚠ H2H baixo: apenas ${h2hGoals.avgGoals.toFixed(1)} golos/jogo`);
      }
    }

    // === Factor 8: Total goals expected (high goals = high corners correlation) ===
    const totalGoalsExpected = homeGoalsFor + awayGoalsFor;
    if (totalGoalsExpected >= 3.5) {
      score += 8;
      factors.push(`Esperados ${totalGoalsExpected.toFixed(1)} golos combinados`);
    } else if (totalGoalsExpected >= 2.8) {
      score += 4;
    }

    // === Factor 9: Learning from historical results ===
    let learningFactors = [];
    if (typeof Learning !== 'undefined' && Learning.ready) {
      const adj = Learning.getCornersAdjustment();
      score += adj.delta;
      learningFactors = adj.factors;
    }

    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    if (score < THRESHOLDS.CORNERS_MEDIUM) return null;

    const confidence = score >= THRESHOLDS.CORNERS_FIRE ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.CORNERS_HIGH ? CONFIDENCE.HIGH :
                       score >= THRESHOLDS.CORNERS_MEDIUM ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

    // Estimate expected corners based on league avg + adjustments
    const attackBonus = (combinedAttack - 1.2) * 1.5;
    const openBonus = (combinedConceded - 1.0) * 0.8;
    const estimatedCorners = Math.max(7, leagueAvg + attackBonus + openBonus).toFixed(1);

    return {
      score,
      confidence,
      factors,
      learningFactors,
      estimatedCorners: parseFloat(estimatedCorners),
      leagueAvg,
      stats: {
        homeGoalsFor,
        homeGoalsAgainst,
        awayGoalsFor,
        awayGoalsAgainst,
        combinedAttack: combinedAttack.toFixed(1),
        combinedConceded: combinedConceded.toFixed(1),
        homeForm: homeForm.str,
        awayForm: awayForm.str,
        totalDiff
      }
    };
  },

  calculateH2HGoals(h2hMatches) {
    const relevant = h2hMatches.slice(0, 6);
    let totalGoals = 0;
    relevant.forEach(m => {
      totalGoals += (m.goals.home || 0) + (m.goals.away || 0);
    });
    return {
      avgGoals: totalGoals / relevant.length,
      total: relevant.length
    };
  },

  extractCornersOdds(oddsData) {
    if (!oddsData || !Array.isArray(oddsData)) return null;

    for (const bookmakerEntry of oddsData) {
      const bookmakers = bookmakerEntry?.bookmakers || [];
      for (const bk of bookmakers) {
        // Corners Over/Under — try common names
        const cornersBet = bk.bets?.find(b =>
          b.name === 'Total Corners' ||
          b.name === 'Corners Over Under' ||
          b.name === 'Corners Over/Under' ||
          (b.name && b.name.toLowerCase().includes('corner'))
        );
        if (cornersBet && cornersBet.values) {
          // Find the 9.5 line (or closest)
          const overVal = cornersBet.values.find(v =>
            v.value === 'Over 9.5' || v.value === 'Over 10.5' || v.value === 'Over 8.5'
          );
          const underVal = cornersBet.values.find(v =>
            v.value === 'Under 9.5' || v.value === 'Under 10.5' || v.value === 'Under 8.5'
          );
          if (overVal) {
            const line = parseFloat(overVal.value.replace('Over ', ''));
            return {
              line,
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

    const grid = document.getElementById('corners-grid');
    const loading = document.getElementById('corners-loading');
    const progressBar = document.getElementById('corners-progress-bar');
    const progressText = document.getElementById('corners-progress-text');
    const btn = document.getElementById('btn-corners');

    const cornersFixtures = this.getCornersFixtures(fixtures);
    const toAnalyze = cornersFixtures.slice(0, this.MAX_ANALYZE);

    btn.style.display = 'none';
    loading.style.display = 'flex';
    grid.innerHTML = '';

    const results = [];
    let done = 0;

    // Phase 1: Fetch predictions
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
        const analysis = this.analyzeCorners(data[0], f);
        if (analysis && analysis.score >= THRESHOLDS.CORNERS_MEDIUM) {
          results.push({ fixture: f, prediction: data[0], corners: analysis, cornersOdds: null });
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    // Phase 2: Fetch odds for top candidates
    const topCandidates = results
      .sort((a, b) => b.corners.score - a.corners.score)
      .slice(0, 8);

    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;

      progressText.textContent = `A buscar odds ${oddsCount + 1}/${topCandidates.length}...`;
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;

      if (oddsData) {
        r.cornersOdds = this.extractCornersOdds(oddsData);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.corners.score - a.corners.score);
    this.analyzed = results;

    loading.style.display = 'none';
    progressBar.style.width = '100%';

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="corners-empty">
          Sem jogos com padrão forte de cantos identificado hoje
        </div>`;
    } else {
      this.renderResults(results);
    }

    this.isAnalyzing = false;
  },

  renderResults(results) {
    const grid = document.getElementById('corners-grid');
    grid.innerHTML = '';

    const filtered = results.filter(r => {
      if (r.cornersOdds && r.cornersOdds.over > 0 && r.cornersOdds.over < THRESHOLDS.CORNERS_MIN_ODDS) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="corners-empty">
          Todos os jogos filtrados (odds &lt; ${THRESHOLDS.CORNERS_MIN_ODDS})
        </div>`;
      return;
    }

    filtered.slice(0, 15).forEach((r, idx) => {
      const card = this.renderCard(r, idx + 1);
      grid.appendChild(card);
    });
  },

  renderCard(result, rank) {
    const { fixture, prediction, corners, cornersOdds } = result;
    const home = fixture.teams.home;
    const away = fixture.teams.away;
    const time = new Date(fixture.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const leagueInfo = LEAGUES[fixture.league.id];
    const leagueName = leagueInfo?.name || fixture.league.name;

    const homeForm = prediction.teams?.home?.league?.form?.slice(-5) || '';
    const awayForm = prediction.teams?.away?.league?.form?.slice(-5) || '';

    const card = UI.el('div', 'corners-card');
    card.dataset.fixtureId = fixture.fixture.id;

    const tier = corners.score >= THRESHOLDS.CORNERS_FIRE ? 'fire' :
                 corners.score >= THRESHOLDS.CORNERS_HIGH ? 'hot' : 'warm';

    const scoreColor = corners.score >= THRESHOLDS.CORNERS_FIRE ? 'var(--amber)' :
                       corners.score >= THRESHOLDS.CORNERS_HIGH ? 'var(--blue)' : 'var(--purple)';

    // Suggested bet line
    const suggestedLine = corners.estimatedCorners >= 11 ? 'Over 10.5' :
                          corners.estimatedCorners >= 10 ? 'Over 9.5' :
                          corners.estimatedCorners >= 9 ? 'Over 8.5' : 'Over 7.5';

    // Odds display
    let oddsHtml = '';
    if (cornersOdds && cornersOdds.over > 0) {
      const oddsClass = cornersOdds.over >= 1.70 ? 'corners-odds--value' :
                        cornersOdds.over >= 1.50 ? 'corners-odds--fair' : 'corners-odds--low';
      oddsHtml = `
        <div class="corners-card__odds ${oddsClass}">
          <span class="corners-card__odds-label">Over ${cornersOdds.line} Cantos</span>
          <span class="corners-card__odds-value">${cornersOdds.over.toFixed(2)}</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="corners-card__header">
        <div class="corners-card__rank">#${rank}</div>
        <div class="corners-card__tier">
          ${tier === 'fire' ? '&#128293;' : tier === 'hot' ? '&#11088;' : '&#9898;'}
        </div>
        <div class="corners-card__score-ring" style="--score-color:${scoreColor}">
          <span class="corners-card__score-value">${corners.score}</span>
          <span class="corners-card__score-label">CRN</span>
        </div>
      </div>

      <div class="corners-card__league">${leagueName} &middot; ${time}</div>

      <div class="corners-card__matchup">
        <div class="corners-card__team">
          <img src="${home.logo}" alt="" class="corners-card__team-logo" onerror="this.style.display='none'">
          <span>${home.name}</span>
        </div>
        <span class="corners-card__vs">vs</span>
        <div class="corners-card__team">
          <img src="${away.logo}" alt="" class="corners-card__team-logo" onerror="this.style.display='none'">
          <span>${away.name}</span>
        </div>
      </div>

      ${oddsHtml}

      <div class="corners-card__estimate">
        <div class="corners-card__estimate-bar">
          <div class="corners-card__estimate-fill" style="width:${Math.min(100, (corners.estimatedCorners / 14) * 100)}%"></div>
          <span class="corners-card__estimate-value">${corners.estimatedCorners}</span>
        </div>
        <div class="corners-card__estimate-labels">
          <span>Cantos estimados</span>
          <span class="corners-card__suggestion">${suggestedLine}</span>
        </div>
      </div>

      <div class="corners-card__stats-grid">
        <div class="corners-card__stat">
          <span class="corners-card__stat-label">Liga média</span>
          <span class="corners-card__stat-value">${corners.leagueAvg}/jogo</span>
        </div>
        <div class="corners-card__stat">
          <span class="corners-card__stat-label">Ataque comb.</span>
          <span class="corners-card__stat-value">${corners.stats.combinedAttack} golos</span>
        </div>
        <div class="corners-card__stat">
          <span class="corners-card__stat-label">Def. fraca</span>
          <span class="corners-card__stat-value">${corners.stats.combinedConceded} sofr.</span>
        </div>
        <div class="corners-card__stat">
          <span class="corners-card__stat-label">Equilíbrio</span>
          <span class="corners-card__stat-value">${corners.stats.totalDiff < 15 ? '&#10003; Sim' : '&#10007; Não'}</span>
        </div>
      </div>

      <div class="corners-card__form">
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${home.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(homeForm)}</div>
        </div>
        <div class="form-row">
          <span class="form-row__label" style="min-width:auto;max-width:60px">${away.name.split(' ')[0]}</span>
          <div class="form-badges">${UI.renderFormBadges(awayForm)}</div>
        </div>
      </div>

      ${corners.factors.length > 0 ? `
        <div class="corners-card__factors">
          ${corners.factors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="corners-card__factor ${isWarning ? 'corners-card__factor--warning' : ''}">
              ${isWarning ? '' : '&#10003; '}${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${(corners.learningFactors && corners.learningFactors.length > 0) ? `
        <div class="corners-card__learning">
          <div class="corners-card__learning-title">&#9889; Aprendizagem</div>
          ${corners.learningFactors.map(f => {
            const isWarning = f.startsWith('\u26A0');
            return `<div class="corners-card__learning-item ${isWarning ? 'corners-card__learning-item--warning' : 'corners-card__learning-item--boost'}">
              ${f}
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${Bankroll.renderBadge(Bankroll.getCornersStake(corners.score))}
    `;

    return card;
  },

  init() {
    document.getElementById('btn-corners')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
