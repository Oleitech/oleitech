/* Projetos: scroll vertical empurra a pista na horizontal (secção fixa); o bug anda por trás dos cartões. */
(() => {
  const sec = document.querySelector('.projects');
  if (!sec) return;
  const stage = sec.querySelector('.projects__stage');
  const track = sec.querySelector('.projects__track');
  const bug = sec.querySelector('.insect');
  const body = bug.querySelector('.insect__body');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SLOW = 1.4; // px de scroll vertical por px de pista
  let dist = 0, vw = 0, vh = 0, top = 0, ticking = false;

  function measure() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    const trackW = [...track.querySelectorAll('.pcard')].reduce((m, c) => Math.max(m, c.offsetLeft + c.offsetWidth), 0) + vw * 0.08;
    dist = Math.max(0, trackW - vw);
    sec.style.height = (vh + Math.max(dist * SLOW, vh * 2.5)) + 'px';
    top = sec.getBoundingClientRect().top + scrollY;
    update();
  }
  function update() {
    ticking = false;
    const p = Math.min(1, Math.max(0, (scrollY - top) / (sec.offsetHeight - vh || 1)));
    track.style.transform = `translate3d(${-p * dist}px,-50%,0)`;
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  measure();

  // o bug vive na pista, com os cartões (comportamento E7, 2.ª versão): o scroll só o desloca por estar no mesmo translate.
  // O andar é só pelo relógio, em coordenadas da pista; não lê o scroll. Fica na zona do meio.
  // E8: não salta. Anda e pára, com acelerações suaves; vira a rodar no sítio ou em curva, com velocidade de rotação
  // limitada (sem estalos). As patas rodam à volta de onde se prendem, com a passada dada pela distância andada.
  const R = (a, b) => a + Math.random() * (b - a), gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(6.2832 * Math.random());
  const ZX = .15, ZY = .2;                                    // margem: 15% de um ecrã nas pontas da pista; 20% do palco em cima e em baixo
  const TURN = 2.4;                                           // rad/s, rotação máxima do corpo (~140°/s)
  // zona em coordenadas da pista: x pela parte da pista que chega a ver-se (0 … dist + ecrã), y à altura do meio do palco
  const zone = (vw, vh, len, th) => { const top = th / 2 - vh / 2; return { x0: vw * ZX, x1: len - vw * ZX, y0: top + vh * ZY, y1: top + vh * (1 - ZY) }; };
  function newBug(Z, vw, bw, bh) {                            // começa à vista no 1.º ecrã
    const a = Math.random() * 6.2832;
    return { x: vw * R(ZX + .1, 1 - ZX - .1), y: Z.y0 + (Z.y1 - Z.y0) * R(.15, .85), a, h: a, w: 0, v: 0, vt: 0, mode: 'walk', t: 0, step: 0, Z, bw, bh };
  }
  const walk = (B, sc) => { B.mode = 'walk'; B.t = R(1, 3.2); B.vt = R(40, 58) * sc; };
  function nextLeg(B, sc) {                                   // velocidades em px a 1920, escaladas ao tamanho do bug
    if (B.mode === 'walk' && Math.random() < .25) { B.mode = 'pause'; B.t = R(.5, 1.8); B.vt = 0; }
    else walk(B, sc);
    if (Math.random() < .45) B.h = B.a + (Math.random() < .5 ? -1 : 1) * R(.6, 2.4);   // muda de rumo; o corpo roda até lá
  }
  function stepBug(B, dt) {
    const sc = Math.pow(B.bw / 298, .3);                     // 298 = largura do bug a 1920; a 1440 fica ~0,95
    B.t -= dt; if (B.t <= 0) nextLeg(B, sc);
    // a andar, o rumo desejado deriva um pouco; parado, não
    if (B.mode !== 'pause') { B.w += -2 * B.w * dt + .9 * Math.sqrt(dt) * gauss(); B.h += B.w * dt; }
    // fora da zona do meio: o rumo desejado aponta para dentro e não pára
    const { x0, x1, y0, y1 } = B.Z;
    if (B.x < x0 || B.x > x1 || B.y < y0 || B.y > y1) {
      const want = Math.atan2((B.y < y0) - (B.y > y1), (B.x < x0) - (B.x > x1));   // para dentro pelo lado que passou; só corrige se estiver a ir para fora
      if (Math.cos(B.h - want) < .5) B.h = want + R(-.6, .6);
      if (B.mode === 'pause') walk(B, sc);
    }
    // o corpo roda para o rumo com velocidade limitada; com uma viragem grande quase pára e roda no sítio
    const d = Math.atan2(Math.sin(B.h - B.a), Math.cos(B.h - B.a));
    const da = Math.max(-TURN * dt, Math.min(TURN * dt, d * (1 - Math.exp(-5 * dt))));
    B.a += da;
    const turn = Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(d) * 1.2)));
    B.v += (B.vt * turn - B.v) * (1 - Math.exp(-3 * dt));
    const ds = B.v * dt;
    B.x += Math.cos(B.a) * ds; B.y += Math.sin(B.a) * ds;
    B.step += (ds + Math.abs(da) * B.bw * .3) / (B.bw * .14) * 6.2832;   // passada: distância andada (e rodada), não o relógio
    const m = B.bw * .1;                                      // nunca sai da zona por mais de um pouco
    B.x = Math.min(x1 + m, Math.max(x0 - m, B.x)); B.y = Math.min(y1 + m, Math.max(y0 - m, B.y));
  }
  // patas e antenas: grupos do SVG inline, rodados à volta do ponto onde se prendem (data-o), em trípode (data-p)
  const legs = [...bug.querySelectorAll('.insect__leg')].map(g => ({ g, o: g.dataset.o, p: +g.dataset.p * Math.PI }));
  const ants = [...bug.querySelectorAll('.insect__ant')].map((g, i) => ({ g, o: g.dataset.o, k: i * 2.1 }));
  function pose(B, t) {
    for (const L of legs) L.g.setAttribute('transform', `rotate(${(9 * Math.sin(B.step + L.p)).toFixed(2)} ${L.o})`);
    const still = B.mode === 'pause' ? 1 : .35;
    for (const A of ants) A.g.setAttribute('transform', `rotate(${(2.5 * still * Math.sin(t * 1.3 + A.k)).toFixed(2)} ${A.o})`);
  }
  let B = null, bprev = 0, braf = 0, bvis = true, t = 0;
  function bugFrame(now) {
    braf = 0;
    const dt = Math.max(0, Math.min(.05, (now - bprev) / 1000)); bprev = now; t += dt;
    const Z = zone(vw, vh, dist + vw, track.offsetHeight), bw = bug.offsetWidth, bh = bug.offsetHeight;
    if (!B) B = newBug(Z, vw, bw, bh); else { B.Z = Z; B.bw = bw; B.bh = bh; }
    stepBug(B, dt);
    bug.style.transform = `translate3d(${B.x - bw / 2}px,${B.y - bh / 2}px,0)`;
    body.style.transform = `rotate(${B.a * 180 / Math.PI + 90}deg)`;   // plano: só roda (sem escala, sem abanar)
    pose(B, t);
    bugLoop();
  }
  const bugLoop = () => { if (!braf && bvis && !reduce && !document.hidden) { bprev = performance.now(); braf = requestAnimationFrame(bugFrame); } };
  new IntersectionObserver(([e]) => { bvis = e.isIntersecting; if (bvis) bugLoop(); else if (braf) { cancelAnimationFrame(braf); braf = 0; } }).observe(sec);
  document.addEventListener('visibilitychange', bugLoop);
  if (reduce) { bug.style.transform = `translate3d(${vw * .4 - bug.offsetWidth / 2}px,${track.offsetHeight / 2 - bug.offsetHeight / 2}px,0)`; body.style.transform = 'rotate(70deg)'; }
  else bugLoop();
  if (location.search.includes('debug')) window.__bugSim = (sec, W = 1920, H = 1080, bw = 298) => { // simulação sem render: médias das velocidades
    const b = newBug(zone(W, H, W * 3, H), W, bw, bw), n = Math.round(sec * 60); let sx = 0, sy = 0, sp = 0, mn = [1e9, 1e9], mx = [-1e9, -1e9];
    for (let i = 0; i < n; i++) { const px = b.x, py = b.y; stepBug(b, 1 / 60); sx += (b.x - px) * 60; sy += (b.y - py) * 60; sp += Math.hypot(b.x - px, b.y - py) * 60; mn = [Math.min(mn[0], b.x), Math.min(mn[1], b.y)]; mx = [Math.max(mx[0], b.x), Math.max(mx[1], b.y)]; }
    return { speed: sp / n, meanVx: sx / n, meanVy: sy / n, xRange: [mn[0], mx[0]], yRange: [mn[1], mx[1]] };
  };

  // teclado: ao focar um cartão fora do ecrã, leva o scroll até ele
  track.addEventListener('focusin', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    const want = Math.min(dist, Math.max(0, c.offsetLeft - vw * .15));
    scrollTo({ top: top + (want / dist) * (sec.offsetHeight - vh), behavior: 'auto' });
  });
})();
