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

/* Contacto: texto grande -> botão -> ícone (os parêntesis encaixam-se no símbolo da marca) */
(() => {
  const c = document.querySelector('.contact');
  if (!c) return;
  if (reduce) { c.classList.add('is-btn', 'is-icon'); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(() => c.classList.add('is-btn'), 350);
    setTimeout(() => c.classList.add('is-icon'), 350 + 900 + 300);
  }, { threshold: .8 });
  io.observe(c);
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
