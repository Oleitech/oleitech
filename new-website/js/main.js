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

/* Contacto: texto -> botão (pílula) -> ícone (os parêntesis encaixam-se no símbolo da marca).
   Uma linha temporal reversível p (0..1): o hover (ou o foco) leva-a a 1, sair leva-a a 0, a partir de onde estiver.
   No touch, entrar no ecrã leva a 1 e sair leva a 0. O <a> mantém o tamanho do texto grande: a área não encolhe. */
(() => {
  const c = document.querySelector('.contact');
  if (!c) return;
  const ghost = c.querySelector('.contact__ghost'), label = c.querySelector('.contact__label');
  const tr = c.querySelector('.contact__sym--tr'), bl = c.querySelector('.contact__sym--bl');
  const T = 1.4;                                   // 0.7 s por fase
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
  const E = ease(.7, 0, .2, 1), lerp = (a, b, t) => a + (b - a) * t, cl = x => Math.min(1, Math.max(0, x));
  let M = null, p = 0, target = 0, raf = 0, prev = 0;

  function measure() {
    label.removeAttribute('style');
    const g = getComputedStyle(label);
    const rest = { fs: parseFloat(g.fontSize), pt: parseFloat(g.paddingTop), pb: parseFloat(g.paddingBottom), px: parseFloat(g.paddingLeft) };
    label.style.fontSize = 'var(--fs-label)';
    label.style.padding = 'max(14px, calc(42 * var(--k))) max(26px, calc(99 * var(--k)))';
    const h = getComputedStyle(label);
    const pill = { fs: parseFloat(h.fontSize), pt: parseFloat(h.paddingTop), pb: parseFloat(h.paddingBottom), px: parseFloat(h.paddingLeft) };
    M = { rest, pill, S: parseFloat(getComputedStyle(tr).width) };
    apply();
  }
  function apply() {
    const a = E(cl(p * 2)), b = E(cl(p * 2 - 1)), { rest: r, pill: q } = M;
    const k = 1 - b, st = label.style;
    st.fontSize = lerp(r.fs, q.fs, a) * k + 'px';
    st.padding = `${lerp(r.pt, q.pt, a) * k}px ${lerp(r.px, q.px, a) * k}px ${lerp(r.pb, q.pb, a) * k}px`;
    st.letterSpacing = .02 * a + 'em';
    st.backgroundColor = `rgba(233, 235, 120, ${a})`;
    st.color = `rgb(${lerp(238, 28, a)}, ${lerp(236, 27, a)}, ${lerp(233, 27, a)})`;
    st.opacity = 1 - cl((b - .5) * 2);
    // parêntesis: cantos do texto/pílula -> símbolo ao centro (afastados 5% como manda a marca)
    const aw = c.offsetWidth, ah = c.offsetHeight, lw = label.offsetWidth, lh = label.offsetHeight, S = M.S;
    const L = (aw - lw) / 2, Tp = (ah - lh) / 2, off = 12 * a, gap = .05 * S;
    const sc = lerp(lerp(.7, .45, a), 1, b);
    const trX = lerp(L + lw + off, aw / 2 + S / 2 + gap, b), trY = lerp(Tp - off, ah / 2 - S / 2 - gap, b);
    const blX = lerp(L - off, aw / 2 - S / 2 - gap, b), blY = lerp(Tp + lh + off, ah / 2 + S / 2 + gap, b);
    tr.style.transform = `translate(${trX - S * sc}px, ${trY}px) scale(${sc})`;
    bl.style.transform = `translate(${blX}px, ${blY - S * sc}px) scale(${sc})`;
    c.dataset.state = p === 0 ? 'text' : p === 1 ? 'icon' : 'moving';
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
