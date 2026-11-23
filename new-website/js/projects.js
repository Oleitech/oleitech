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

  // o bug anda sozinho (tempo real), no ecrã visível da secção, por trás dos cartões.
  // Rumo: velocidade angular com ruído suavizado (Ornstein-Uhlenbeck); velocidade com alvos aleatórios e pausas.
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(6.2832 * Math.random());
  function newBug(W, H, bw, bh) {
    const m = bw * .3;
    return { x: m + Math.random() * Math.max(1, W - 2 * m), y: m + Math.random() * Math.max(1, H - 2 * m), a: Math.random() * 6.2832,
      w: 0, v: 0, vt: 20 + Math.random() * 45, tNext: 1 + Math.random() * 3, pause: 0, W, H, bw, bh };
  }
  function stepBug(B, dt) {
    const sc = B.bw / 360;                                    // velocidades em px a 1920, escaladas ao tamanho do bug
    B.w += -0.4 * B.w * dt + 0.32 * Math.sqrt(dt) * gauss();   // OU: média 0, desvio ~0.35 rad/s (metade da ronda 3) (curvas largas, percorre a secção)
    B.tNext -= dt;
    if (B.tNext <= 0) { B.tNext = 1.5 + Math.random() * 3.5; B.vt = Math.random() < .12 ? 0 : (30 + Math.random() * 45) * sc; }   // metade da velocidade (ronda 5)
    B.v += (B.vt - B.v) * (1 - Math.exp(-1.6 * dt));
    // afasta-se suavemente das bordas (força proporcional à penetração na margem)
    const m = B.bw * .55, hx = Math.cos(B.a), hy = Math.sin(B.a);
    const px = Math.max(0, m - B.x) - Math.max(0, B.x - (B.W - m)), py = Math.max(0, m - B.y) - Math.max(0, B.y - (B.H - m));
    if (px || py) { const k = Math.min(1, Math.hypot(px, py) / m), want = Math.atan2(py, px); B.w += Math.sin(want - B.a) * 5 * k * dt * 6; }
    B.a += B.w * dt;
    B.x += Math.cos(B.a) * B.v * dt; B.y += Math.sin(B.a) * B.v * dt;
    B.x = Math.min(B.W - B.bw * .2, Math.max(B.bw * .2, B.x)); B.y = Math.min(B.H - B.bh * .2, Math.max(B.bh * .2, B.y));
  }
  let B = null, bprev = 0, braf = 0, bvis = true, t = 0;
  function bugFrame(now) {
    braf = 0;
    const dt = Math.max(0, Math.min(.05, (now - bprev) / 1000)); bprev = now; t += dt;
    const W = stage.clientWidth, H = stage.clientHeight, bw = bug.offsetWidth, bh = bug.offsetHeight;
    if (!B) B = newBug(W, H, bw, bh); else { B.W = W; B.H = H; B.bw = bw; B.bh = bh; }
    stepBug(B, dt);
    bug.style.transform = `translate3d(${B.x - bw / 2}px,${B.y - bh / 2}px,0)`;
    const wob = Math.sin(t * 14) * 3 * Math.min(1, B.v / 40);
    body.style.transform = `rotate(${B.a * 180 / Math.PI + 90 + wob}deg) scale(${1 + Math.sin(t * 28) * .012})`;
    bugLoop();
  }
  const bugLoop = () => { if (!braf && bvis && !reduce && !document.hidden) { bprev = performance.now(); braf = requestAnimationFrame(bugFrame); } };
  new IntersectionObserver(([e]) => { bvis = e.isIntersecting; if (bvis) bugLoop(); else if (braf) { cancelAnimationFrame(braf); braf = 0; } }).observe(sec);
  document.addEventListener('visibilitychange', bugLoop);
  if (reduce) { bug.style.transform = `translate3d(${stage.clientWidth * .4 - bug.offsetWidth / 2}px,${stage.clientHeight * .5 - bug.offsetHeight / 2}px,0)`; body.style.transform = 'rotate(70deg)'; }
  else bugLoop();
  if (location.search.includes('debug')) window.__bugSim = (sec, W = 1920, H = 1080, bw = 360) => { // simulação sem render: médias das velocidades
    const b = newBug(W, H, bw, bw), n = Math.round(sec * 60); let sx = 0, sy = 0, mn = [1e9, 1e9], mx = [-1e9, -1e9];
    for (let i = 0; i < n; i++) { const px = b.x, py = b.y; stepBug(b, 1 / 60); sx += (b.x - px) * 60; sy += (b.y - py) * 60; mn = [Math.min(mn[0], b.x), Math.min(mn[1], b.y)]; mx = [Math.max(mx[0], b.x), Math.max(mx[1], b.y)]; }
    return { meanVx: sx / n, meanVy: sy / n, xRange: [mn[0], mx[0]], yRange: [mn[1], mx[1]] };
  };

  // teclado: ao focar um cartão fora do ecrã, leva o scroll até ele
  track.addEventListener('focusin', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    const want = Math.min(dist, Math.max(0, c.offsetLeft - vw * .15));
    scrollTo({ top: top + (want / dist) * (sec.offsetHeight - vh), behavior: 'auto' });
  });
})();
