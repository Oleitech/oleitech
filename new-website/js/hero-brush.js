/* Hero. Tudo em unidades do frame do Figma (1:2991, 3653 de largura; o 1.º ecrã tem 3653x2055).
   Camadas: grelha + foco (canvas) -> camada amarela (SVG) -> menu -> cursor -> cópia antracite do menu/seta.
   - Grelha (1:3448) estende-se a todo o ecrã; o gradiente elíptico 1:3933 é um foco que segue o rato.
   - Começa estático (composição do Figma). O hover activa células da grelha; células + bug + bola passam por um
     filtro "goo" (desfocar + cortar o alfa) e formam UMA forma com a mesma cor lisa do original. Encolhem e desaparecem.
   - A cópia antracite do menu e da seta é recortada pela zona amarela, para o texto se ler sempre. */
(() => {
  const hero = document.querySelector('[data-brush]');
  if (!hero) return;
  const cv = hero.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const BUG_D = 'M51.7409 0H230.676L231.107 0.257316C236.111 3.18926 243.003 4.72774 248.223 7.65755C272.07 21.0413 280.583 46.2133 282.738 71.6537C284.649 94.2271 297.951 118.277 318.197 128.849C346.42 145.082 375.876 131.841 400.197 157.481C409.982 166.781 414.956 171.62 419.103 186.076C422.395 197.549 421.365 214.541 421.303 226.685L421.169 296.733C421.159 335.237 416.588 384.766 455.248 407.194C471.741 416.763 486.374 416.503 503.965 419.556C545.492 426.762 564.007 461.068 565.657 500.504C566.383 517.884 580.31 540.26 595.595 548.607C626.907 566.555 658.507 551.839 684.433 580.519C717.476 617.076 707.784 676.406 662.045 696.836C643.801 704.985 621.622 702.705 601.823 702.711L538.501 702.698H502.024C482.471 702.739 474.859 704.124 457.181 694.17C436.547 682.549 426.167 668.668 420.398 645.639C415.61 626.613 417.068 601.549 417.092 581.334L417.174 511.437C417.185 499.759 418.052 481.638 415.022 471.032C410.651 455.732 400.25 441.338 386.591 433.2C358.156 415.569 321.163 428.208 298.167 400.459C291.534 392.456 282.188 379.979 280.918 369.981C276.982 338.986 277.784 312.926 247.938 293.622C218.127 274.342 174.647 289.457 153.062 254.343C147.434 246.177 142.819 237.866 140.19 228.126C138.175 220.658 138.469 211.563 137.471 204.051C135.058 185.153 125.835 163.672 108.386 154.194C102.59 151.045 88.491 143.626 82.8986 143.346C52.6007 141.831 30.7055 137.679 10.8292 112.467C5.70465 105.967 3.56267 96.0698 0 91.3464V51.804C1.73206 48.9771 4.07642 40.9478 5.86621 37.345C17.0132 14.9061 30.0269 8.43408 51.7409 0Z';
  const F = { w: 3653, h: 2055 };
  const G = { x: 276.7, y: 255, pitch: 140.7, cell: 142 };
  const BUG = { x: 1123, y: 678 }, DOT = { x: 2035.5, y: 1172.5, r: 70.5 };
  const SPOT = { x: 141 + 1272.65, y: 255 + 735.8, m: [341.22, -431.974, 873.591, 690.047] }; // gradiente do 1:3933
  const COMP = { cx: 1614.5, cy: 1030, w: 983 };                                                // bug + bola
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
  const crisp = el('g', { fill: ACCENT }, svg);
  for (const p of [goo, crisp, clip]) {
    el('path', { d: BUG_D, transform: `translate(${BUG.x} ${BUG.y})` }, p);
    if (!cur) el('circle', { cx: DOT.x, cy: DOT.y, r: DOT.r }, p);   // com rato, a bola é o cursor
  }
  const ball = cur ? el('circle', { r: 0 }, clip) : null;
  hero.appendChild(svg);

  // cópia antracite do menu e da seta, só visível dentro da zona amarela
  const ink = document.createElement('div');
  ink.className = 'hero__ink'; ink.setAttribute('aria-hidden', 'true'); ink.inert = true;
  const hdr = document.querySelector('.header--over'), cue = hero.querySelector('.cue');
  for (const src of [hdr, cue]) if (src) {
    const c = src.cloneNode(true);
    c.querySelectorAll('img').forEach(i => { i.src = i.src.replace('logo-header.svg', 'logo-header-ink.svg'); i.alt = ''; });
    c.querySelectorAll('a').forEach(a => a.setAttribute('tabindex', '-1'));
    ink.appendChild(c);
  }
  ink.style.clipPath = 'url(#hero-clip)'; ink.style.webkitClipPath = 'url(#hero-clip)';
  hero.appendChild(ink);

  let W = 0, H = 0, dpr = 1, s = 1, tx = 0, ty = 0, c0 = 0, c1 = 0, r0 = 0, r1 = 0;
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
    const still = mq.matches, p = pointer();
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

  // para o cursor: sítio da bola no desenho, tamanho no hero e se um ponto está dentro do hero
  window.__cursorHero = {
    home() { const b = hero.getBoundingClientRect(); return { x: b.left + tx + DOT.x * s, y: b.top + ty + DOT.y * s, visible: b.bottom > 0 && b.top < innerHeight }; },
    d: () => 2 * DOT.r * s,
    contains(x, y) { const b = hero.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; },
  };
  size();
  if (cur) cur.kick();
  if (location.search.includes('debug')) { window.__heroAlive = () => cells.size; window.__paint = paintAt; window.__spot = () => ({ ...spot }); }
})();
