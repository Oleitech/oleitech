/* Cursor do site: a bola amarela do hero (Figma 1:3935). Só com rato (pointer: fine); no touch fica o do sistema.
   Segue o rato com atraso suave. No hero tem o tamanho da bola do desenho e, sem rato, volta ao sítio dela.
   Fora do hero fica pequena; por cima de ligações e botões passa a anel, para não tapar o que está por baixo. */
(() => {
  if (!matchMedia('(pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const el = document.createElement('div');
  el.className = 'cursor is-hidden'; el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor');
  const SMALL = 18, RING = 52, INTERACTIVE = 'a, button, [role="tab"], summary, label';
  // x/y/d: estado desenhado; mx/my: rato; active: rato dentro da janela
  const C = window.__cursor = { x: 0, y: 0, d: SMALL, mx: 0, my: 0, active: false, ready: false };
  let raf = 0, prev = 0, link = false;

  function goal() {
    const hero = window.__cursorHero;
    let x = C.mx, y = C.my, show = C.active;
    if (!C.active && hero) { const h = hero.home(); if (h) { x = h.x; y = h.y; show = h.visible; } }
    const inHero = !!hero && hero.contains(x, y);
    return { x, y, show, inHero, d: inHero ? hero.d() : link ? RING : SMALL };
  }
  function tick(now) {
    raf = 0;
    const dt = Math.max(0, Math.min(.05, (now - prev) / 1000)); prev = now;
    const g = goal();
    if (!C.ready) { C.x = g.x; C.y = g.y; C.d = g.d; C.ready = true; }
    const k = reduce.matches ? 1 : 1 - Math.pow(1 - .2, dt * 60);
    C.x += (g.x - C.x) * k; C.y += (g.y - C.y) * k; C.d += (g.d - C.d) * k;
    el.style.width = el.style.height = C.d + 'px';
    el.style.transform = `translate3d(${C.x - C.d / 2}px, ${C.y - C.d / 2}px, 0)`;
    el.classList.toggle('is-ring', link && !g.inHero);
    el.classList.toggle('is-hidden', !g.show); C.hidden = !g.show;
    if (Math.abs(g.x - C.x) + Math.abs(g.y - C.y) + Math.abs(g.d - C.d) > .3) loop();
  }
  const loop = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(tick); } };
  C.kick = loop; C.moving = () => !!raf;

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    C.mx = e.clientX; C.my = e.clientY; C.active = true; loop();
  }, { passive: true });
  addEventListener('pointerover', e => { link = !!(e.target.closest && e.target.closest(INTERACTIVE)); loop(); });
  document.documentElement.addEventListener('mouseleave', () => { C.active = false; loop(); });
  addEventListener('scroll', loop, { passive: true });
  addEventListener('resize', loop);
  addEventListener('load', loop);
  loop();
})();
