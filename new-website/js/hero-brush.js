/* Pincel do hero: começa estático (composição do Figma) e preenche-se com carimbos em forma de "bug" quando há hover/toque.
   Reconstruído do zero a partir de specs/animation-reference.md. Sem movimento autónomo. */
(() => {
  const hero = document.querySelector('[data-brush]');
  if (!hero) return;
  const cv = hero.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const BUG = new Path2D('M51.7409 0H230.676L231.107 0.257316C236.111 3.18926 243.003 4.72774 248.223 7.65755C272.07 21.0413 280.583 46.2133 282.738 71.6537C284.649 94.2271 297.951 118.277 318.197 128.849C346.42 145.082 375.876 131.841 400.197 157.481C409.982 166.781 414.956 171.62 419.103 186.076C422.395 197.549 421.365 214.541 421.303 226.685L421.169 296.733C421.159 335.237 416.588 384.766 455.248 407.194C471.741 416.763 486.374 416.503 503.965 419.556C545.492 426.762 564.007 461.068 565.657 500.504C566.383 517.884 580.31 540.26 595.595 548.607C626.907 566.555 658.507 551.839 684.433 580.519C717.476 617.076 707.784 676.406 662.045 696.836C643.801 704.985 621.622 702.705 601.823 702.711L538.501 702.698H502.024C482.471 702.739 474.859 704.124 457.181 694.17C436.547 682.549 426.167 668.668 420.398 645.639C415.61 626.613 417.068 601.549 417.092 581.334L417.174 511.437C417.185 499.759 418.052 481.638 415.022 471.032C410.651 455.732 400.25 441.338 386.591 433.2C358.156 415.569 321.163 428.208 298.167 400.459C291.534 392.456 282.188 379.979 280.918 369.981C276.982 338.986 277.784 312.926 247.938 293.622C218.127 274.342 174.647 289.457 153.062 254.343C147.434 246.177 142.819 237.866 140.19 228.126C138.175 220.658 138.469 211.563 137.471 204.051C135.058 185.153 125.835 163.672 108.386 154.194C102.59 151.045 88.491 143.626 82.8986 143.346C52.6007 141.831 30.7055 137.679 10.8292 112.467C5.70465 105.967 3.56267 96.0698 0 91.3464V51.804C1.73206 48.9771 4.07642 40.9478 5.86621 37.345C17.0132 14.9061 30.0269 8.43408 51.7409 0Z');
  const BUG_SIZE = 704;
  /* 1473.5 = centro x de bug + ponto (largura 983) */
  const FW = 3412.5, FH = 1594.5;                 // caixa do hero no Figma (unidades Figma)
  const G = { x: 135.7, pitch: 140.7, cell: 142, cols: 22, rows: 11 }; // grelha
  const BUGPOS = { x: 982, y: 423 }, DOT = { x: 1824 + 70.5, y: 847 + 70.5, r: 70.5 };
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const COL = { accent: tok('--accent', '#E9EB78'), dying: tok('--accent-deep', '#5E6030'), line: tok('--grid-line', 'rgba(129,129,129,.66)') };
  const P = { life: [6, 8], stampHz: 30, dyingAt: 0.2, hold: 0.35, dprMax: 2 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mq = matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0, H = 0, dpr = 1, s = 1, tx = 0, pitch = 0, cell = 0, gx = 0;
  let under = null, over = null, wins = [], ptr = null, lastPtrT = -1e9, acc = 0, prev = 0, raf = 0, visible = true;

  const layer = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; };

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, P.dprMax);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (W < 700) { s = Math.min(H / FH, (W - 80) / 983); tx = W / 2 - 1473.5 * s; } else { s = W / FW; tx = 0; }
    pitch = G.pitch * s; cell = G.cell * s; gx = tx + G.x * s;
    // por baixo: grelha (quadrado + círculo inscrito)
    let u; [under, u] = layer(); u.strokeStyle = COL.line; u.lineWidth = 1;
    for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) {
      const x = gx + c * pitch, y = r * pitch;
      u.strokeRect(x + .5, y + .5, cell, cell);
      u.beginPath(); u.arc(x + cell / 2, y + cell / 2, cell / 2, 0, 6.2832); u.stroke();
    }
    // por cima: o bug e o ponto do Figma (nunca desaparecem)
    let o; [over, o] = layer(); o.fillStyle = COL.accent;
    o.save(); o.translate(tx + BUGPOS.x * s, BUGPOS.y * s); o.scale(s, s); o.fill(BUG); o.restore();
    o.beginPath(); o.arc(tx + DOT.x * s, DOT.y * s, DOT.r * s, 0, 6.2832); o.fill();
    wins = []; draw();
  }

  function stamp(cx, cy, r) {
    const a = rnd(0, 6.2832), d = Math.sqrt(Math.random()) * r;
    const sz = pitch * rnd(1.1, 2.3);
    const x = Math.round((cx + Math.cos(a) * d - gx) / pitch) * pitch + gx - sz / 2;
    const y = Math.round((cy + Math.sin(a) * d) / pitch) * pitch - sz / 2;
    wins.push({ x, y, s: sz, rot: Math.floor(rnd(0, 4)) * Math.PI / 2, flip: Math.random() < .5 ? -1 : 1, life: 1, decay: 1 / rnd(P.life[0], P.life[1]) });
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(under, 0, 0);
    for (const w of wins) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(w.x + w.s / 2, w.y + w.s / 2); ctx.rotate(w.rot); ctx.scale(w.flip, 1);
      ctx.scale(w.s / BUG_SIZE, w.s / BUG_SIZE); ctx.translate(-BUG_SIZE / 2, -BUG_SIZE / 2);
      ctx.fillStyle = w.life <= P.dyingAt ? COL.dying : COL.accent; ctx.fill(BUG);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(over, 0, 0);
  }

  function tick(now) {
    raf = 0; if (!visible || mq.matches) return;
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    for (const w of wins) w.life -= dt * w.decay;
    wins = wins.filter(w => w.life > 0);
    const active = ptr && now - lastPtrT < P.hold * 1000;
    if (active) { acc += dt; const step = 1 / P.stampHz; while (acc >= step) { acc -= step; stamp(ptr.x, ptr.y, Math.max(pitch * 1.4, 40)); } } else acc = 0;
    draw();
    if (wins.length || active) loop();
  }
  const loop = () => { if (!raf && visible && !mq.matches && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); } };

  hero.addEventListener('pointermove', e => {
    if (mq.matches) return;
    const b = hero.getBoundingClientRect();
    ptr = { x: e.clientX - b.left, y: e.clientY - b.top }; lastPtrT = performance.now(); loop();
  });
  hero.addEventListener('pointerleave', () => { ptr = null; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(hero);
  document.addEventListener('visibilitychange', loop);
  new ResizeObserver(size).observe(hero);
  mq.addEventListener('change', () => { wins = []; draw(); });
  size();
  if (location.search.includes('debug')) setInterval(() => console.log('janelas', wins.length), 1000);
})();
