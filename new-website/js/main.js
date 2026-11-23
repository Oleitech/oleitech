const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Serviços: selector tipo separadores (clique, setas, Home/End) */
(() => {
  const tabs = [...document.querySelectorAll('.svc')];
  if (!tabs.length) return;
  const select = (t, focus) => {
    tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      else if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
})();

/* Contacto: botão (pílula) -> círculo com o símbolo da marca -> botão. Uma só animação contínua e reversível:
   p (0..1) avança com o hover ou o foco e recua ao sair, a partir de onde estiver. No touch, entrar no ecrã leva a 1.
   A forma amarela nunca desaparece: a largura vai da pílula ao diâmetro (= altura da pílula). */
(() => {
  const c = document.querySelector('.contact');
  if (!c) return;
  const ghost = c.querySelector('.contact__ghost'), label = c.querySelector('.contact__label'), text = c.querySelector('.contact__text');
  const tr = c.querySelector('.contact__sym--tr'), bl = c.querySelector('.contact__sym--bl');
  const T = .9;
  const ease = (x1, y1, x2, y2) => t => {          // cubic-bezier(x1, y1, x2, y2)
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
      if (Math.abs(x) < 1e-5) break;
      const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
      u = Math.min(1, Math.max(0, u - x / (dx || 1e-6)));
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const E = ease(.65, 0, .35, 1), lerp = (a, b, t) => a + (b - a) * t, cl = x => Math.min(1, Math.max(0, x));
  let M = null, p = 0, target = 0, raf = 0, prev = 0;

  function measure() { M = { w: ghost.offsetWidth, h: ghost.offsetHeight }; apply(); }
  function apply() {
    const e = E(p), { w: pw, h: D } = M, aw = c.offsetWidth, ah = c.offsetHeight;
    const w = lerp(pw, D, e);
    label.style.width = w + 'px'; label.style.height = D + 'px';
    text.style.opacity = 1 - cl(e / .45);
    text.style.transform = `scale(${lerp(1, .85, cl(e / .45))})`;
    // parêntesis: começam nos cantos da pílula e encaixam-se no símbolo (50% do círculo, afastados 5% como manda a marca)
    const S = .5 * D, inset = lerp(.16, .225, e) * D, sc = lerp(.42, 1, e);
    const L = (aw - w) / 2, Tp = (ah - D) / 2;
    tr.style.width = tr.style.height = bl.style.width = bl.style.height = S + 'px';
    tr.style.transform = `translate(${L + w - inset - S * sc}px, ${Tp + inset}px) scale(${sc})`;
    bl.style.transform = `translate(${L + inset}px, ${Tp + D - inset - S * sc}px) scale(${sc})`;
    c.dataset.state = p === 0 ? 'button' : p === 1 ? 'circle' : 'moving';
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (now - prev) / 1000)); prev = now;
    p = reduce ? target : target > p ? Math.min(target, p + dt / T) : Math.max(target, p - dt / T);
    apply();
    if (p !== target) go();
  }
  const go = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(tick); } };
  const to = v => { target = v; go(); };

  if (matchMedia('(hover: hover)').matches) {
    c.addEventListener('pointerenter', () => to(1));
    c.addEventListener('pointerleave', () => { if (!c.matches(':focus-visible')) to(0); });
  } else {
    new IntersectionObserver(([e]) => to(e.intersectionRatio >= .8 ? 1 : e.isIntersecting ? target : 0), { threshold: [0, .8] }).observe(c);
  }
  c.addEventListener('focus', () => { if (c.matches(':focus-visible')) to(1); });
  c.addEventListener('blur', () => { if (!c.matches(':hover')) to(0); });
  new ResizeObserver(measure).observe(ghost);
  measure();
})();

/* Números: contagem ao entrar no ecrã (instantânea com reduced motion) */
(() => {
  const nums = [...document.querySelectorAll('[data-count]')];
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, t0 = performance.now(), dur = 1600;
    if (reduce) return;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  nums.forEach(n => { n.textContent = fmt(+n.dataset.count); if (!reduce) { n.textContent = '0'; } io.observe(n); });
})();
