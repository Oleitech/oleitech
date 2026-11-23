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
    const trackW = [...track.children].reduce((m, c) => Math.max(m, c.offsetLeft + c.offsetWidth), 0) + vw * 0.08;
    dist = Math.max(0, trackW - vw);
    sec.style.height = (vh + Math.max(dist * SLOW, vh * 2.5)) + 'px';
    top = sec.getBoundingClientRect().top + scrollY;
    update();
  }
  function update() {
    ticking = false;
    const p = Math.min(1, Math.max(0, (scrollY - top) / (sec.offsetHeight - vh || 1)));
    track.style.transform = `translate3d(${-p * dist}px,-50%,0)`;
    // caminho do bug: atravessa o ecrã com uma onda; a rotação segue a tangente
    const bw = bug.offsetWidth, bh = bug.offsetHeight;
    const pos = q => ({ x: -bw * .4 + q * (vw + bw * .5), y: vh * (.5 + .2 * Math.sin(q * 6.2832 * 1.5 + .6)) - bh / 2 });
    const a = pos(p), b = pos(Math.min(1, p + .004)), c = pos(Math.max(0, p - .004));
    const ang = Math.atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI + 90;
    bug.style.transform = `translate3d(${a.x}px,${a.y}px,0)`;
    const wob = reduce ? 0 : Math.sin(p * dist / 18) * 4;
    body.style.transform = `rotate(${ang + wob}deg) scale(${1 + (reduce ? 0 : Math.sin(p * dist / 9) * .015)})`;
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  measure();

  // teclado: ao focar um cartão fora do ecrã, leva o scroll até ele
  track.addEventListener('focusin', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    const want = Math.min(dist, Math.max(0, c.offsetLeft - vw * .15));
    scrollTo({ top: top + (want / dist) * (sec.offsetHeight - vh), behavior: 'auto' });
  });
})();
