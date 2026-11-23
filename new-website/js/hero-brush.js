/* Pincel do hero: carimbos em forma do "bug" da marca, encaixados na grelha.
   Comportamento reconstruído do zero a partir de specs/animation-reference.md. */
(() => {
  const hero = document.querySelector('[data-brush]');
  if (!hero) return;
  const cv = hero.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const BUG = new Path2D('M51.7409 0H230.676L231.107 0.257316C236.111 3.18926 243.003 4.72774 248.223 7.65755C272.07 21.0413 280.583 46.2133 282.738 71.6537C284.649 94.2271 297.951 118.277 318.197 128.849C346.42 145.082 375.876 131.841 400.197 157.481C409.982 166.781 414.956 171.62 419.103 186.076C422.395 197.549 421.365 214.541 421.303 226.685L421.169 296.733C421.159 335.237 416.588 384.766 455.248 407.194C471.741 416.763 486.374 416.503 503.965 419.556C545.492 426.762 564.007 461.068 565.657 500.504C566.383 517.884 580.31 540.26 595.595 548.607C626.907 566.555 658.507 551.839 684.433 580.519C717.476 617.076 707.784 676.406 662.045 696.836C643.801 704.985 621.622 702.705 601.823 702.711L538.501 702.698H502.024C482.471 702.739 474.859 704.124 457.181 694.17C436.547 682.549 426.167 668.668 420.398 645.639C415.61 626.613 417.068 601.549 417.092 581.334L417.174 511.437C417.185 499.759 418.052 481.638 415.022 471.032C410.651 455.732 400.25 441.338 386.591 433.2C358.156 415.569 321.163 428.208 298.167 400.459C291.534 392.456 282.188 379.979 280.918 369.981C276.982 338.986 277.784 312.926 247.938 293.622C218.127 274.342 174.647 289.457 153.062 254.343C147.434 246.177 142.819 237.866 140.19 228.126C138.175 220.658 138.469 211.563 137.471 204.051C135.058 185.153 125.835 163.672 108.386 154.194C102.59 151.045 88.491 143.626 82.8986 143.346C52.6007 141.831 30.7055 137.679 10.8292 112.467C5.70465 105.967 3.56267 96.0698 0 91.3464V51.804C1.73206 48.9771 4.07642 40.9478 5.86621 37.345C17.0132 14.9061 30.0269 8.43408 51.7409 0Z');
  const BUG_SIZE = 704;
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const COL = { accent: tok('--accent', '#E9EB78'), dying: tok('--accent-deep', '#5E6030'), line: tok('--grid-line', 'rgba(129,129,129,.66)') };
  const P = { life: [2, 3], stampHz: 30, perStamp: 1, dyingAt: 0.14, timeout: 1.6, turn: 0.5, speed: 0.18, bx: [0.05, 0.95], by: [0.1, 0.9], dprMax: 2 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mq = matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0, H = 0, dpr = 1, cell = 40, ox = 0, oy = 0, cols = 0, rows = 0, grid = null;
  let wins = [], ptr = null, lastPtrT = -1e9, wander = { x: 0.5, y: 0.4, a: rnd(0, 6.28) };
  let head = null, acc = 0, prev = 0, raf = 0, visible = true, still = false;

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, P.dprMax);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cell = W < 700 ? 40 : W / 22.5;
    cols = Math.max(1, Math.round(W / cell)); rows = Math.max(1, Math.round(H / cell));
    ox = (W - cols * cell) / 2; oy = (H - rows * cell) / 2;
    // grelha: quadrado + círculo inscrito, desenhada uma vez
    grid = document.createElement('canvas'); grid.width = cv.width; grid.height = cv.height;
    const g = grid.getContext('2d'); g.scale(dpr, dpr); g.strokeStyle = COL.line; g.lineWidth = 1;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = ox + c * cell, y = oy + r * cell;
      g.strokeRect(x + .5, y + .5, cell, cell);
      g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell / 2, 0, 6.2832); g.stroke();
    }
    wins = []; head = null;
    if (still) { buildStill(); draw(); }
  }

  function stamp(cx, cy, r, dyingFlag) {
    const a = rnd(0, 6.2832), d = Math.sqrt(Math.random()) * r;
    const s = cell * rnd(1.1, 2.3);
    const x = Math.round((cx + Math.cos(a) * d - ox) / cell) * cell + ox - s / 2;
    const y = Math.round((cy + Math.sin(a) * d - oy) / cell) * cell + oy - s / 2;
    const life = rnd(P.life[0], P.life[1]);
    wins.push({ x, y, s, rot: Math.floor(rnd(0, 4)) * Math.PI / 2, flip: Math.random() < .5 ? -1 : 1, life: 1, decay: 1 / life, dead: dyingFlag });
  }

  function stepWander(h) {
    const w = wander, k = P.speed * h;
    w.a += (Math.random() - .5) * P.turn;
    w.x += Math.cos(w.a) * k; w.y += Math.sin(w.a) * k * (W / H);
    if (w.x < P.bx[0] || w.x > P.bx[1]) { w.a = Math.PI - w.a; w.x = Math.min(P.bx[1], Math.max(P.bx[0], w.x)); }
    if (w.y < P.by[0] || w.y > P.by[1]) { w.a = -w.a; w.y = Math.min(P.by[1], Math.max(P.by[0], w.y)); }
  }

  function buildStill() {
    wins = []; const w = { x: .5, y: .4, a: rnd(0, 6.28) };
    for (let i = 0; i < 120; i++) {
      w.a += (Math.random() - .5) * .6; w.x += Math.cos(w.a) * .012; w.y += Math.sin(w.a) * .012 * (W / H);
      w.x = Math.min(.92, Math.max(.08, w.x)); w.y = Math.min(.85, Math.max(.1, w.y));
      stamp(w.x * W, w.y * H, Math.max(44, .045 * W), Math.random() < .2);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(grid, 0, 0, W, H);
    for (const w of wins) {
      const dying = still ? w.dead : w.life <= P.dyingAt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(w.x + w.s / 2, w.y + w.s / 2); ctx.rotate(w.rot); ctx.scale(w.flip, 1);
      ctx.scale(w.s / BUG_SIZE, w.s / BUG_SIZE); ctx.translate(-BUG_SIZE / 2, -BUG_SIZE / 2);
      ctx.fillStyle = dying ? COL.dying : COL.accent; ctx.fill(BUG);
    }
    if (head && !still) { // célula-"cabeça" que segue o pincel
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = COL.accent;
      ctx.beginPath(); ctx.arc(head.x, head.y, cell / 2, 0, 6.2832); ctx.fill();
    }
  }

  function tick(now) {
    raf = 0; if (!visible || still) return;
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    for (const w of wins) w.life -= dt * w.decay;
    wins = wins.filter(w => w.life > 0);
    acc += dt; const step = 1 / P.stampHz;
    let tx, ty, usingPtr = ptr && now - lastPtrT < P.timeout * 1000;
    if (!usingPtr && ptr) { wander.x = ptr.x / W; wander.y = ptr.y / H; ptr = null; } // entrega sem salto
    while (acc >= step) {
      acc -= step;
      if (usingPtr) { tx = ptr.x; ty = ptr.y; } else { stepWander(step); tx = wander.x * W; ty = wander.y * H; }
      const r = usingPtr ? Math.max(48, .045 * W) : Math.max(44, .04 * W);
      for (let i = 0; i < P.perStamp; i++) stamp(tx, ty, r);
    }
    if (tx === undefined) { tx = usingPtr ? ptr.x : wander.x * W; ty = usingPtr ? ptr.y : wander.y * H; }
    const sx = Math.round((tx - ox - cell / 2) / cell) * cell + ox + cell / 2, sy = Math.round((ty - oy - cell / 2) / cell) * cell + oy + cell / 2;
    head = head || { x: sx, y: sy };
    const f = 1 - Math.exp(-12 * dt); head.x += (sx - head.x) * f; head.y += (sy - head.y) * f;
    draw(); loop();
  }
  const loop = () => { if (!raf && visible && !still && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); } };

  function onMove(e) {
    const b = hero.getBoundingClientRect();
    ptr = { x: e.clientX - b.left, y: e.clientY - b.top }; lastPtrT = performance.now();
  }
  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerleave', () => { if (ptr) { wander.x = ptr.x / W; wander.y = ptr.y / H; ptr = null; } });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  new ResizeObserver(() => { size(); loop(); }).observe(hero);

  function mode() { still = mq.matches; if (still) { if (raf) cancelAnimationFrame(raf), raf = 0; size(); } else { wins = []; loop(); } }
  mq.addEventListener('change', mode);
  size(); mode();
  if (location.search.includes('debug')) setInterval(() => console.log('janelas', wins.length), 1000);
})();
