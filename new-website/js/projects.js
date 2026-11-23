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

  // o bug anda sozinho (tempo real), no espaço da pista, por trás dos cartões
  const B = { x: 0, y: 0, a: 0, turn: 0, ready: false };
  let bprev = 0, braf = 0, bvis = true, t = 0;
  function bugStep(now) {
    braf = 0;
    const dt = Math.min(.05, (now - bprev) / 1000); bprev = now; t += dt;
    const W = track.offsetWidth, H = track.offsetHeight, bw = bug.offsetWidth, bh = bug.offsetHeight;
    if (!B.ready) { B.x = W * .35; B.y = H * .5; B.a = 0; B.ready = true; }
    const speed = bw * .35;                                   // px/s
    B.turn += (Math.random() - .5) * 5 * dt; B.turn = Math.max(-.9, Math.min(.9, B.turn));
    B.a += B.turn * dt;
    const m = bw * .6;                                        // afasta-se das bordas da pista
    const out = B.x < m || B.x > W - m || B.y < m || B.y > H - m;
    if (out) { const want = Math.atan2(H / 2 - B.y, W / 2 - B.x); let d = Math.atan2(Math.sin(want - B.a), Math.cos(want - B.a)); B.a += d * Math.min(1, 2.5 * dt); }
    B.x += Math.cos(B.a) * speed * dt; B.y += Math.sin(B.a) * speed * dt;
    bug.style.transform = `translate3d(${B.x - bw / 2}px,${B.y - bh / 2}px,0)`;
    body.style.transform = `rotate(${B.a * 180 / Math.PI + 90 + Math.sin(t * 14) * 3}deg) scale(${1 + Math.sin(t * 28) * .012})`;
    bugLoop();
  }
  const bugLoop = () => { if (!braf && bvis && !reduce && !document.hidden) { bprev = performance.now(); braf = requestAnimationFrame(bugStep); } };
  new IntersectionObserver(([e]) => { bvis = e.isIntersecting; if (bvis) bugLoop(); else if (braf) { cancelAnimationFrame(braf); braf = 0; } }).observe(sec);
  document.addEventListener('visibilitychange', bugLoop);
  if (reduce) { bug.style.transform = `translate3d(${track.offsetWidth * .35 - bug.offsetWidth / 2}px,${track.offsetHeight * .5 - bug.offsetHeight / 2}px,0)`; body.style.transform = 'rotate(70deg)'; }
  else bugLoop();

  // teclado: ao focar um cartão fora do ecrã, leva o scroll até ele
  track.addEventListener('focusin', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    const want = Math.min(dist, Math.max(0, c.offsetLeft - vw * .15));
    scrollTo({ top: top + (want / dist) * (sec.offsetHeight - vh), behavior: 'auto' });
  });
})();
