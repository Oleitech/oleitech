/* Hero. Tudo em unidades do frame do Figma (1:2991, 3653 de largura; o 1.º ecrã tem 3653x2055).
   Camadas: grelha + foco (canvas) -> camada amarela (SVG) -> menu -> cursor -> cópia antracite do menu/seta.
   - Grelha (1:3448) estende-se a todo o ecrã; o gradiente elíptico 1:3933 é um foco que segue o rato.
   - Começa só com a grelha e o foco (H1 e B1 da ronda 16: sem forma e sem bola; a bola é o cursor e só nasce no rato).
     O hover activa células da grelha, que passam por um filtro "goo" (desfocar + cortar o alfa) e formam UMA forma lisa.
     Encolhem e desaparecem.
   - H2: células que tocam na barra do topo (.header--over) não se acendem; o fundo da barra mede-se no browser.
   - A cópia antracite do menu e da seta é recortada pela zona amarela, para o texto se ler sempre. */
(() => {
  const hero = document.querySelector('[data-brush]');
  if (!hero) return;
  const cv = hero.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const F = { w: 3653, h: 2055 };
  const G = { x: 276.7, y: 255, pitch: 140.7, cell: 142 };
  const DOT = { r: 70.5 };                                  // raio da bola do desenho (o cursor tem este tamanho no hero)
  const SPOT = { x: 141 + 1272.65, y: 255 + 735.8, m: [341.22, -431.974, 873.591, 690.047] }; // gradiente do 1:3933
  const COMP = { cx: 1614.5, cy: 1030, w: 983 };                                                // composição do Figma: dá a escala abaixo de 700px
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const ACCENT = tok('--accent', '#E9EB78'), LINE = tok('--grid-line', 'rgba(129,129,129,.66)');
  const P = { life: [6, 8], grow: .05, shrinkFrom: .65, nb: .15, dprMax: 2, spot: .08 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const cur = window.__cursor || null;                 // só existe com rato
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  // camada amarela
  const svg = el('svg', { class: 'hero__fill', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  const defs = el('defs', {}, svg);
  const f = el('filter', { id: 'hero-goo', x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' }, defs);
  el('feGaussianBlur', { stdDeviation: G.cell * .2 }, f);
  el('feColorMatrix', { type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -14' }, f);
  const clip = el('clipPath', { id: 'hero-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
  const goo = el('g', { filter: 'url(#hero-goo)', fill: ACCENT }, svg);
  const ball = cur ? el('circle', { r: 0 }, clip) : null;
  hero.appendChild(svg);

  // cópia antracite do menu e da seta, só visível dentro da zona amarela
  const ink = document.createElement('div');
  ink.className = 'hero__ink'; ink.setAttribute('aria-hidden', 'true'); ink.inert = true;
  const hdr = document.querySelector('.header--over'), cue = hero.querySelector('.cue');
  for (const src of [hdr, cue]) if (src) {
    const c = src.cloneNode(true);
    c.querySelectorAll('img').forEach(i => { i.src = i.src.replace('logo-header.svg', 'logo-header-ink.svg'); i.alt = ''; });
    [c, ...c.querySelectorAll('a, button')].forEach(a => { if (a.matches('a, button')) a.setAttribute('tabindex', '-1'); });
    c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));   // a cópia não duplica ids (L4)
    c.querySelectorAll('[aria-controls]').forEach(e => e.removeAttribute('aria-controls'));
    ink.appendChild(c);
  }
  ink.style.clipPath = 'url(#hero-clip)'; ink.style.webkitClipPath = 'url(#hero-clip)';
  hero.appendChild(ink);

  let bar = 0, W = 0, H = 0, dpr = 1, s = 1, tx = 0, ty = 0, c0 = 0, c1 = 0, r0 = 0, r1 = 0;
  const cells = new Map(), pool = [];
  const spot = { x: SPOT.x, y: SPOT.y }, aim = { x: SPOT.x, y: SPOT.y };
  let touched = false, last = null, raf = 0, prev = 0, visible = true, drawn = null, touchAt = 0;

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, P.dprMax);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (W < 700) { s = Math.min((W - 80) / COMP.w, H * .45 / 703); tx = W / 2 - COMP.cx * s; ty = H / 2 - COMP.cy * s; }
    else { s = W / F.w; tx = 0; ty = (H - F.h * s) / 2; }
    c0 = Math.floor((-tx / s - G.x) / G.pitch) - 1; c1 = Math.ceil(((W - tx) / s - G.x) / G.pitch);
    r0 = Math.floor((-ty / s - G.y) / G.pitch) - 1; r1 = Math.ceil(((H - ty) / s - G.y) / G.pitch);
    bar = hdr ? hdr.getBoundingClientRect().bottom - hero.getBoundingClientRect().top : 0;   // fundo da barra, em px do hero
    svg.setAttribute('viewBox', `${-tx / s} ${-ty / s} ${W / s} ${H / s}`);
    clip.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
    for (const [, c] of cells) free(c);
    cells.clear(); last = null; drawn = null;
    draw(); render();
  }

  // grelha + foco elíptico (as linhas desaparecem fora do foco, como no Figma)
  function draw() {
    if (drawn && Math.abs(drawn.x - spot.x) + Math.abs(drawn.y - spot.y) < .4) return;
    drawn = { x: spot.x, y: spot.y };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const p = G.pitch * s, cl = G.cell * s;
    ctx.beginPath();
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const x = tx + (G.x + c * G.pitch) * s, y = ty + (G.y + r * G.pitch) * s;
      ctx.rect(x + .5, y + .5, cl, cl);
      ctx.moveTo(x + cl, y + cl / 2); ctx.arc(x + cl / 2, y + cl / 2, cl / 2, 0, 6.2832);
    }
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);
    const m = SPOT.m; ctx.transform(m[0], m[1], m[2], m[3], spot.x, spot.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(28,27,27,0)'); g.addColorStop(1, 'rgb(28,27,27)');
    ctx.fillStyle = g; ctx.fillRect(-80, -80, 160, 160);
  }

  function take() { return pool.pop() || [el('rect', {}, goo), el('rect', {}, clip)]; }
  function free(c) { for (const r of c.el) r.setAttribute('width', 0); pool.push(c.el); }
  function activate(c, r) {
    if (c < c0 || r < r0 || c > c1 || r > r1) return;
    if (ty + (G.y + r * G.pitch + G.cell * (.5 - .54)) * s < bar) return;   // H2: a célula (desenhada a 1,08) tocava na barra
    const k = c + ',' + r, x = cells.get(k);
    if (!x) cells.set(k, { c, r, age: 0, dur: rnd(P.life[0], P.life[1]), el: take() });
    else x.age = Math.min(x.age, P.grow * x.dur);
  }
  function paintAt(px, py) {   // px/py em píxeis do hero
    const c = Math.floor(((px - tx) / s - G.x) / G.pitch), r = Math.floor(((py - ty) / s - G.y) / G.pitch);
    if (px < 0 || py < 0 || px > W || py > H) { last = null; return; }
    if (last && last.c === c && last.r === r) return;
    const from = last || { c, r }, n = Math.max(Math.abs(c - from.c), Math.abs(r - from.r), 1);
    let pc = from.c, pr = from.r;
    for (let k = 1; k <= n; k++) {
      const cc = Math.round(from.c + (c - from.c) * k / n), rr = Math.round(from.r + (r - from.r) * k / n);
      if (cc !== pc && rr !== pr) activate(cc, pr);  // só ligações ortogonais: forma "escada"
      activate(cc, rr); pc = cc; pr = rr;
    }
    if (Math.random() < P.nb) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; activate(c + d[0], r + d[1]); }
    last = { c, r };
  }

  const sizeOf = x => {
    const t = x.age / x.dur;
    if (t < P.grow) return 1 - Math.pow(1 - t / P.grow, 3);
    if (t < P.shrinkFrom) return 1;
    const u = (t - P.shrinkFrom) / (1 - P.shrinkFrom); return Math.pow(1 - u, 2);
  };
  function render() {
    for (const [, x] of cells) {
      const sz = sizeOf(x) * G.cell * 1.08;
      const cx = G.x + x.c * G.pitch + G.cell / 2, cy = G.y + x.r * G.pitch + G.cell / 2;
      for (const r of x.el) { r.setAttribute('x', cx - sz / 2); r.setAttribute('y', cy - sz / 2); r.setAttribute('width', sz); r.setAttribute('height', sz); r.setAttribute('rx', sz * .15); }
    }
  }

  // posição do cursor/dedo em píxeis do hero, ou null
  function pointer() {
    const b = hero.getBoundingClientRect();
    if (cur && cur.ready && cur.active) return { x: cur.x - b.left, y: cur.y - b.top, d: cur.d };
    if (touch) return { x: touch.x - b.left, y: touch.y - b.top, d: 0 };
    return null;
  }
  let touch = null;

  function tick(now) {
    raf = 0; if (!visible) return;
    const dt = Math.max(0, Math.min(.05, (now - prev) / 1000)); prev = now;
    const still = mq.matches || document.documentElement.classList.contains('is-loading'), p = pointer();   // ponto 8: nada pinta por baixo do loading
    const inside = p && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
    if (inside && !still) paintAt(p.x, p.y); else last = null;
    if (inside && !still) { aim.x = (p.x - tx) / s; aim.y = (p.y - ty) / s; touched = true; }
    else if (!touched || still) { aim.x = SPOT.x; aim.y = SPOT.y; }   // depois do 1.º movimento o foco fica onde o rato saiu
    const k = still ? 1 : 1 - Math.pow(1 - P.spot, dt * 60);
    spot.x += (aim.x - spot.x) * k; spot.y += (aim.y - spot.y) * k;
    if (ball) {   // a bola (cursor) também revela o menu em antracite
      if (cur.ready) { const b = hero.getBoundingClientRect(); ball.setAttribute('cx', (cur.x - b.left - tx) / s); ball.setAttribute('cy', (cur.y - b.top - ty) / s); ball.setAttribute('r', cur.hidden ? 0 : cur.d / 2 / s); }
    }
    for (const [key, x] of cells) { x.age += dt; if (x.age >= x.dur) { free(x); cells.delete(key); } }
    draw(); render();
    const moving = Math.abs(aim.x - spot.x) + Math.abs(aim.y - spot.y) > .5 || (cur && cur.moving && cur.moving());
    if (cells.size || moving || (inside && !still)) loop();
  }
  const loop = () => { if (!raf && visible && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); } };

  addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { loop(); return; }
    touch = { x: e.clientX, y: e.clientY }; touchAt = performance.now(); loop();
  }, { passive: true });
  const endTouch = e => { if (e.pointerType !== 'mouse') { touch = null; loop(); } };
  addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
  document.documentElement.addEventListener('mouseleave', loop);
  addEventListener('scroll', loop, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(hero);
  document.addEventListener('visibilitychange', loop);
  new ResizeObserver(size).observe(hero);
  mq.addEventListener('change', () => { for (const [, c] of cells) free(c); cells.clear(); render(); loop(); });

  // para o cursor: tamanho da bola do desenho no hero e se um ponto está dentro do hero
  window.__cursorHero = {
    d: () => 2 * DOT.r * s,
    contains(x, y) { const b = hero.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; },
  };
  size();
  if (cur) cur.kick();
  if (location.search.includes('debug')) { window.__heroAlive = () => cells.size; window.__paint = paintAt; window.__spot = () => ({ ...spot }); }
})();
