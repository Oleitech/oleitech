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
    const grid = document.getElementById('corners-grid');
    if (!grid) return;

    const cornersFixtures = this.getCornersFixtures(fixtures);
    if (cornersFixtures.length === 0) return;

    grid.innerHTML = '';
    this.analyzed = [];

    const toFetch = Math.min(cornersFixtures.length, this.MAX_ANALYZE);
    this.showCachedResults(cornersFixtures.slice(0, toFetch));

    if (this.analyzed.length === 0) {
      this.analyze(cornersFixtures);
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
    if (grid) grid.innerHTML = '';

    const updateProgress = (text) => {
      if (typeof App !== 'undefined' && App.updateScanProgress) App.updateScanProgress(text);
    };

    const cornersFixtures = this.getCornersFixtures(fixtures);
    const toAnalyze = cornersFixtures.slice(0, this.MAX_ANALYZE);

    const results = [];
    let done = 0;

    for (const f of toAnalyze) {
      if (Cache.getRemainingRequests() <= 5) {
        UI.showToast('A guardar requests — análise parcial', 'info');
        break;
      }
      updateProgress(`Cantos ${done + 1}/${toAnalyze.length}`);
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

    const topCandidates = results.sort((a, b) => b.corners.score - a.corners.score).slice(0, 8);
    let oddsCount = 0;
    for (const r of topCandidates) {
      if (Cache.getRemainingRequests() <= 3) break;
      updateProgress(`Cantos odds ${oddsCount + 1}/${topCandidates.length}`);
      const oddsData = await API.getOdds(r.fixture.fixture.id);
      oddsCount++;
      if (oddsData) r.cornersOdds = this.extractCornersOdds(oddsData);
      await new Promise(r => setTimeout(r, 120));
    }

    results.sort((a, b) => b.corners.score - a.corners.score);
    this.analyzed = results;
    if (results.length > 0) this.renderResults(results);
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
    const odds = cornersOdds?.over || null;
    const suggestedLine = corners.estimatedCorners >= 11 ? 'Over 10.5' :
                          corners.estimatedCorners >= 10 ? 'Over 9.5' :
                          corners.estimatedCorners >= 9 ? 'Over 8.5' : 'Over 7.5';
    const stake = Bankroll.getCornersStake(corners.score);

    return UI.renderTipCard({
      home: home.name, away: away.name,
      homeLogo: home.logo, awayLogo: away.logo,
      league: leagueName, time,
      marketKey: 'corners', pick: suggestedLine,
      odds, score: corners.score,
      factors: corners.factors,
      learningFactors: corners.learningFactors,
      stake
    });
  },

  init() {
    document.getElementById('btn-corners')?.addEventListener('click', () => {
      if (Fixtures.fixturesData.length > 0) {
        this.analyze(Fixtures.fixturesData);
      }
    });
  }
};
