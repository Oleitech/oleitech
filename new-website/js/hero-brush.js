/* Pincel do hero. Camadas: grelha (canvas) -> vinheta (só a grelha) -> camada amarela em SVG.
   Começa estático (composição do Figma). O hover activa células da grelha; as células activas + o bug e o ponto
   passam por um filtro "goo" (desfocar + cortar o alfa) e formam UMA forma arredondada com a mesma cor lisa do original.
   Por cima fica uma cópia nítida, sem filtro, do bug e do ponto. As células encolhem até desaparecer. */
(() => {
  const hero = document.querySelector('[data-brush]');
  if (!hero) return;
  const cv = hero.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const BUG_D = 'M51.7409 0H230.676L231.107 0.257316C236.111 3.18926 243.003 4.72774 248.223 7.65755C272.07 21.0413 280.583 46.2133 282.738 71.6537C284.649 94.2271 297.951 118.277 318.197 128.849C346.42 145.082 375.876 131.841 400.197 157.481C409.982 166.781 414.956 171.62 419.103 186.076C422.395 197.549 421.365 214.541 421.303 226.685L421.169 296.733C421.159 335.237 416.588 384.766 455.248 407.194C471.741 416.763 486.374 416.503 503.965 419.556C545.492 426.762 564.007 461.068 565.657 500.504C566.383 517.884 580.31 540.26 595.595 548.607C626.907 566.555 658.507 551.839 684.433 580.519C717.476 617.076 707.784 676.406 662.045 696.836C643.801 704.985 621.622 702.705 601.823 702.711L538.501 702.698H502.024C482.471 702.739 474.859 704.124 457.181 694.17C436.547 682.549 426.167 668.668 420.398 645.639C415.61 626.613 417.068 601.549 417.092 581.334L417.174 511.437C417.185 499.759 418.052 481.638 415.022 471.032C410.651 455.732 400.25 441.338 386.591 433.2C358.156 415.569 321.163 428.208 298.167 400.459C291.534 392.456 282.188 379.979 280.918 369.981C276.982 338.986 277.784 312.926 247.938 293.622C218.127 274.342 174.647 289.457 153.062 254.343C147.434 246.177 142.819 237.866 140.19 228.126C138.175 220.658 138.469 211.563 137.471 204.051C135.058 185.153 125.835 163.672 108.386 154.194C102.59 151.045 88.491 143.626 82.8986 143.346C52.6007 141.831 30.7055 137.679 10.8292 112.467C5.70465 105.967 3.56267 96.0698 0 91.3464V51.804C1.73206 48.9771 4.07642 40.9478 5.86621 37.345C17.0132 14.9061 30.0269 8.43408 51.7409 0Z';
  const BUG_SIZE = 704, FW = 3412.5, FH = 1594.5;
  const G = { x: 135.7, pitch: 140.7, cell: 142, cols: 22, rows: 11 };
  const BUGPOS = { x: 982, y: 423 }, DOT = { x: 1824 + 70.5, y: 847 + 70.5, r: 70.5 };
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const ACCENT = tok('--accent', '#E9EB78'), LINE = tok('--grid-line', 'rgba(129,129,129,.66)');
  const P = { life: [6, 8], grow: .05, shrinkFrom: .65, nb: .15, dprMax: 2 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  // camada amarela (SVG, coordenadas do Figma)
  const svg = el('svg', { class: 'hero__fill', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  const defs = el('defs', {}, svg);
  const f = el('filter', { id: 'hero-goo', x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' }, defs);
  const blur = el('feGaussianBlur', { stdDeviation: G.cell * .2 }, f);
  el('feColorMatrix', { type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -14' }, f);
  const goo = el('g', { filter: 'url(#hero-goo)', fill: ACCENT }, svg);
  const shapes = (p) => { el('path', { d: BUG_D, transform: `translate(${BUGPOS.x} ${BUGPOS.y})` }, p); el('circle', { cx: DOT.x, cy: DOT.y, r: DOT.r }, p); };
  shapes(goo);
  const cellsG = el('g', {}, goo);
  const rects = [];
  for (let i = 0; i < G.cols * G.rows; i++) rects.push(el('rect', { width: 0, height: 0 }, cellsG));
  const crisp = el('g', { fill: ACCENT }, svg); shapes(crisp);
  hero.appendChild(svg);

  let W = 0, H = 0, dpr = 1, s = 1, tx = 0, pitch = 0, cell = 0, gx = 0, under = null;
  let age, dur, alive = 0, last = null, raf = 0, prev = 0, visible = true;

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, P.dprMax);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (W < 700) { s = Math.min(H / FH, (W - 80) / 983); tx = W / 2 - 1473.5 * s; } else { s = W / FW; tx = 0; }
    pitch = G.pitch * s; cell = G.cell * s; gx = tx + G.x * s;
    svg.setAttribute('viewBox', `${-tx / s} 0 ${W / s} ${H / s}`);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) {
      const x = gx + c * pitch, y = r * pitch;
      ctx.strokeRect(x + .5, y + .5, cell, cell);
      ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell / 2, 0, 6.2832); ctx.stroke();
    }
    age = new Float32Array(G.cols * G.rows).fill(-1); dur = new Float32Array(G.cols * G.rows); alive = 0;
    rects.forEach(r => { r.setAttribute('width', 0); r.setAttribute('height', 0); });
  }

  const idx = (c, r) => r * G.cols + c;
  function activate(c, r) {
    if (c < 0 || r < 0 || c >= G.cols || r >= G.rows) return;
    const i = idx(c, r);
    if (age[i] < 0) { age[i] = 0; dur[i] = rnd(P.life[0], P.life[1]); alive++; }
    else age[i] = Math.min(age[i], P.grow * dur[i]);
  }
  function paintAt(x, y) {
    const c = Math.floor((x - gx) / pitch), r = Math.floor(y / pitch);
    if (c < 0 || r < 0 || c >= G.cols || r >= G.rows) { last = null; return; }
    if (last && last.c === c && last.r === r) return;
    const from = last || { c, r }, n = Math.max(Math.abs(c - from.c), Math.abs(r - from.r), 1);
    let pc = from.c, pr = from.r;
    for (let k = 1; k <= n; k++) {
      const cc = Math.round(from.c + (c - from.c) * k / n), rr = Math.round(from.r + (r - from.r) * k / n);
      if (cc !== pc && rr !== pr) activate(cc, pr);  // só ligações ortogonais: forma "escada"
      activate(cc, rr); pc = cc; pr = rr;
    }
    if (Math.random() < P.nb) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; activate(c + d[0], r + d[1]); }
    last = { c, r }; loop();
  }

  const sizeOf = i => {
    const t = age[i] / dur[i];
    if (t < P.grow) return 1 - Math.pow(1 - t / P.grow, 3);
    if (t < P.shrinkFrom) return 1;
    const u = (t - P.shrinkFrom) / (1 - P.shrinkFrom); return Math.pow(1 - u, 2);
  };
  function render() {
    for (let i = 0; i < age.length; i++) {
      const r = rects[i];
      if (age[i] < 0) { if (r._on) { r.setAttribute('width', 0); r.setAttribute('height', 0); r._on = false; } continue; }
      const sz = sizeOf(i) * G.cell * 1.08, c = i % G.cols, row = (i / G.cols) | 0;
      const cx = G.x + c * G.pitch + G.cell / 2, cy = row * G.pitch + G.cell / 2;
      r.setAttribute('x', cx - sz / 2); r.setAttribute('y', cy - sz / 2); r.setAttribute('width', sz); r.setAttribute('height', sz); r.setAttribute('rx', sz * .3);
      r._on = true;
    }
  }

  function tick(now) {
    raf = 0; if (!visible || mq.matches) return;
    const dt = Math.max(0, Math.min(.05, (now - prev) / 1000)); prev = now;
    for (let i = 0; i < age.length; i++) if (age[i] >= 0) { age[i] += dt; if (age[i] >= dur[i]) { age[i] = -1; alive--; } }
    render();
    if (alive > 0) loop();
  }
  const loop = () => { if (!raf && visible && !mq.matches && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); } };

  hero.addEventListener('pointermove', e => {
    if (mq.matches) return;
    const b = hero.getBoundingClientRect(); paintAt(e.clientX - b.left, e.clientY - b.top);
  });
  hero.addEventListener('pointerleave', () => { last = null; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(hero);
  document.addEventListener('visibilitychange', loop);
  new ResizeObserver(size).observe(hero);
  mq.addEventListener('change', () => { age.fill(-1); alive = 0; render(); });
  size();
  if (location.search.includes('debug')) { window.__heroAlive = () => alive; window.__paint = paintAt; }
})();
