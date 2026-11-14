/* Oleitech v2 — home: fita 3D, loader, HUD e cartão aberto (o site real num iframe). */
import { PROJECTS } from './projects.js';
window.__oleitechAlive = true; // o módulo correu: a rede de segurança do <head> já não cai na grelha estática

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- letra-a-letra nos [data-roll] ---------- */
function splitRoll(el) {
  const txt = el.textContent; el.setAttribute('aria-label', txt); el.textContent = '';
  [...txt].forEach((c, i) => {
    const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<span class="ch__a"></span><span class="ch__b"></span>`;
    s.firstChild.textContent = s.lastChild.textContent = c === ' ' ? ' ' : c; el.appendChild(s);
  });
}
document.querySelectorAll('[data-roll]').forEach(splitRoll);

/* ---------- menu (telemóvel) ---------- */
const menu = $('#menu'), menuBtn = $('#menu-btn');
let menuOpen = false;
function setMenu(open) {
  menuOpen = open; menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  menu.querySelectorAll('a').forEach((a) => a.tabIndex = open ? 0 : -1);
  if (open) menu.querySelector('a').focus({ preventScroll: true });
}
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); menuBtn.focus(); } });
window.matchMedia('(min-width: 821px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

/* ---------- modo estático: nada mais a fazer ---------- */
if (!html.classList.contains('webgl')) { window.__oleitechReady = true; }
else boot().catch((err) => { console.warn('Fita 3D indisponível, versão estática.', err); html.classList.remove('webgl', 'show-loader'); window.__oleitechReady = true; });

async function boot() {
  const showLoader = html.classList.contains('show-loader');
  const loader = $('#loader'), pctEl = $('#loader-pct'), statusEl = $('#loader-status'), countEl = $('#ticket-count'), cta = $('#loader-cta');
  const t0 = performance.now();
  let realImages = 0, fontsOK = false, ribbonOK = false;
  const setP = (p) => { loader.style.setProperty('--p', p.toFixed(4)); };

  /* Tudo em paralelo (imagens, fontes, three.js) e o loader mostra o progresso real desde o primeiro fotograma:
     numa rede lenta de telemóvel o carregamento demora o que demorar, sem cair na versão estática. */
  const imagesP = Promise.all(PROJECTS.map((p) => new Promise((res) => {
    const im = new Image(); im.decoding = 'async';
    const done = () => { realImages++; res(im); }; im.onload = done; im.onerror = done; im.src = `assets/images/projetos/${p.slug}.jpg`;
  })));
  const fontsP = Promise.all([document.fonts.load('600 40px "League Spartan"'), document.fonts.load('700 40px "League Spartan"'), document.fonts.load('400 16px Manrope'), document.fonts.load('700 16px Manrope')]).catch(() => {}).then(() => { fontsOK = true; });
  const modP = import('./ribbon.js');
  let ribbon = null;
  const canvas = $('#stage');

  /* ---------- loader (arranca já) ---------- */
  let entered = false, wantEnter = !showLoader;
  const enter = () => {
    if (!ribbon) { wantEnter = true; return; }
    if (entered) return; entered = true;
    html.classList.add('entered'); ribbon.startIntro();
    if (showLoader) { loader.classList.add('is-exiting'); setTimeout(() => { loader.classList.add('is-gone'); html.classList.remove('show-loader'); }, 1100); }
    try { sessionStorage.setItem('oleitech-loader', '1'); } catch (e) {}
    let hinted = false; try { hinted = !!sessionStorage.getItem('oleitech-hint'); } catch (e) {}
    if (!hinted) setTimeout(() => html.classList.add('hint-on'), 2400);
    const hash = location.hash.slice(1); const idx = PROJECTS.findIndex((p) => p.slug === hash);
    if (idx >= 0) setTimeout(() => ribbon.open(idx, [0.5, 0.5]), 2600);
  };
  if (showLoader) {
    let shown = 0, gate = false;
    const tick = () => {
      const real = (realImages / PROJECTS.length) * 0.82 + (fontsOK ? 0.08 : 0) + (ribbonOK ? 0.1 : 0);
      const ramp = Math.min(1, (performance.now() - t0) / 1900);       // nunca mais depressa que ~1,9 s
      const target = Math.min(real, 0.04 + ramp * 0.96);
      shown += (target - shown) * 0.12; if (target - shown < 0.0015) shown = target;
      const pct = Math.round(shown * 100);
      pctEl.textContent = String(pct); countEl.textContent = String(pct).padStart(3, '0'); setP(shown);
      statusEl.textContent = shown < 0.12 ? 'A carregar projetos' : shown < 0.995 ? `A carregar imagens · ${Math.min(realImages, PROJECTS.length)}/${PROJECTS.length}` : 'Pronto';
      if (shown >= 0.999 && !gate) {
        gate = true; loader.classList.add('is-gate'); cta.tabIndex = 0; loader.setAttribute('aria-busy', 'false');
      }
      if (!gate) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    cta.addEventListener('click', enter);
    window.addEventListener('keydown', (e) => { if (e.key === 'Enter' && loader.classList.contains('is-gate')) enter(); });
  }

  const [images, mod] = await Promise.all([imagesP, modP, fontsP]);
  ribbon = new mod.Ribbon({
    canvas, images, captions: PROJECTS.map((p) => p.caption), reduced: false,
    locked: () => menuOpen,
    onInteract: () => { html.classList.remove('hint-on'); try { sessionStorage.setItem('oleitech-hint', '1'); } catch (e) {} },
    onCenter: (i) => setNow(i),
    onOpen: (i, rect) => openSheet(i, rect),
    onClose: () => closeSheet(),
    onFrame: (rect) => placeSheet(rect),
  });
  ribbonOK = true; window.__ribbon = ribbon; // útil para testes locais
  html.dataset.ribbon = 'ready'; window.__oleitechReady = true;
  if (wantEnter) enter();

  /* ---------- título + contador ---------- */
  const nowTitle = $('#now-title'), nowCount = $('#now-count');
  let lastTitle = null;
  function mkLine(text) {
    const l = document.createElement('span'); l.className = 'now__line'; l.setAttribute('aria-hidden', 'true');
    [...text].forEach((c) => { const s = document.createElement('span'); s.className = 'now__ch'; s.textContent = c; l.appendChild(s); }); return l;
  }
  function setNow(i) {
    const p = PROJECTS[i]; const title = p.caption;
    nowCount.textContent = `${p.n} / ${String(PROJECTS.length).padStart(2, '0')}`;
    if (title === lastTitle) return;
    const g = window.gsap; const lines = [...nowTitle.querySelectorAll('.now__line')]; const line = mkLine(title);
    if (!lines.length || !g) { nowTitle.replaceChildren(line); lastTitle = title; return; }
    lines.slice(0, -1).forEach((l) => { g.killTweensOf(l.children); l.remove(); });
    const old = lines[lines.length - 1]; g.killTweensOf(old.children); nowTitle.appendChild(line);
    g.fromTo(line.children, { yPercent: 110 }, { yPercent: 0, duration: .6, ease: 'power3.out', stagger: .018 });
    g.to(old.children, { yPercent: -110, duration: .5, ease: 'power3.in', stagger: .012, onComplete: () => old.remove() });
    lastTitle = title;
  }

  /* ---------- cartão aberto = o site do projeto ----------
     Como no original, o cartão abre e o conteúdo dele passa a ser o projeto: aqui, o site real num iframe do tamanho
     do cartão (os 5 sites deixam ser embebidos: sem X-Frame-Options nem frame-ancestors, verificado a 14/11).
     A captura de página inteira (assets/sites/<slug>/) só aparece se o iframe falhar: sem "load" em 10 s, ou via file://. */
  const sheet = $('#sheet'), view = $('#sheet-view'), shot = $('#sheet-shot');
  let sheetTimer = 0, current = 0, mounted = false;
  function placeSheet(r) {
    const st = sheet.style;
    st.setProperty('--fl', r.left + 'px'); st.setProperty('--ft', r.top + 'px');
    st.setProperty('--fw', r.width + 'px'); st.setProperty('--fh', r.height + 'px'); st.setProperty('--fr', r.radius + 'px');
  }
  const site = (() => {
    let frame = null, timer = 0, token = 0;
    const canEmbed = location.protocol === 'http:' || location.protocol === 'https:';
    function unmount() { clearTimeout(timer); token++; if (frame) { frame.remove(); frame = null; } }
    function showShot(p) {
      unmount();
      const kind = view.clientWidth < 700 ? 'mobile' : 'desktop';
      const n = (p.shots && p.shots[kind]) || 1;
      shot.replaceChildren(...Array.from({ length: n }, (_, k) => {
        const im = document.createElement('img'); im.decoding = 'async'; im.loading = k ? 'lazy' : 'eager';
        im.src = `assets/sites/${p.slug}/${kind}${k ? '-' + (k + 1) : ''}.jpg`; im.alt = k ? '' : `Captura do site ${p.name}`; return im;
      }));
      shot.scrollTop = 0; sheet.classList.remove('is-loading', 'is-live'); sheet.classList.add('is-fallback');
    }
    function mount(p) {
      unmount(); const my = token;
      shot.replaceChildren(); sheet.classList.remove('is-live', 'is-fallback');
      if (!canEmbed) { showShot(p); return; }
      sheet.classList.add('is-loading');
      frame = document.createElement('iframe');
      frame.className = 'sheet__frame'; frame.title = `Site ${p.name}`;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.addEventListener('load', () => { if (my !== token) return; clearTimeout(timer); sheet.classList.remove('is-loading'); sheet.classList.add('is-live'); });
      timer = setTimeout(() => { if (my === token) showShot(p); }, 10000);
      view.appendChild(frame); frame.src = p.url; mountedAt = performance.now();
    }
    // com o foco dentro do iframe o Esc não chega cá: ao sair do site com o ponteiro devolve-se o foco ao cartão,
    // e se o próprio site puxar o foco ao carregar (sem o ponteiro lá dentro) também
    let inView = false, mountedAt = 0;
    view.addEventListener('pointerenter', () => { inView = true; });
    view.addEventListener('pointerleave', () => { inView = false; if (frame && document.activeElement === frame && !sheet.hidden) sheet.focus({ preventScroll: true }); });
    window.addEventListener('blur', () => setTimeout(() => {
      if (frame && document.activeElement === frame && !inView && !sheet.hidden && performance.now() - mountedAt < 6000 && matchMedia('(hover: hover)').matches) sheet.focus({ preventScroll: true });
    }, 0));
    window.__site = { mount, unmount, fallback: () => showShot(PROJECTS[current]) }; // testes locais
    return { mount, unmount };
  })();

  function openSheet(i, rect) {
    clearTimeout(sheetTimer); current = i; const p = PROJECTS[i];
    sheet.setAttribute('aria-label', `${p.name} — site do projeto`);
    sheet.hidden = false; sheet.classList.remove('is-on'); placeSheet(rect);
    site.unmount(); shot.replaceChildren(); sheet.classList.remove('is-live', 'is-fallback'); sheet.classList.add('is-loading');
    mounted = false; // o site só começa a carregar quando o cartão assenta, para não travar a abertura
    html.classList.add('sheet-open'); history.replaceState(null, '', '#' + p.slug);
  }
  function closeSheet() {
    sheet.classList.remove('is-on'); html.classList.remove('sheet-open');
    sheetTimer = setTimeout(() => { sheet.hidden = true; site.unmount(); shot.replaceChildren(); }, 250);
    document.activeElement && sheet.contains(document.activeElement) && document.activeElement.blur();
  }
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const a = b.dataset.act; if (a === 'close') ribbon.close(); else { sheet.classList.remove('is-on'); ribbon.step(a === 'next' ? 1 : -1); }
  });
  // deslizar na barra do cartão (fora do iframe): seguinte / anterior, como deslizar o cartão no original
  let sx = 0, sy = 0;
  const bar = sheet.querySelector('.sheet__bar');
  bar.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  bar.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { sheet.classList.remove('is-on'); ribbon.step(dx < 0 ? 1 : -1); }
  }, { passive: true });
  // tocar fora do cartão (no canvas) fecha
  document.addEventListener('pointerdown', (e) => { if (ribbon.isOpen && sheet.classList.contains('is-on') && e.target === canvas) { const r = ribbon.frame; if (e.clientX < r.left || e.clientX > r.left + r.width || e.clientY < r.top || e.clientY > r.top + r.height) ribbon.close(); } }, true);
  // o cartão aparece quando assenta (também depois de Anterior/Seguinte)
  ribbon.o.onSettled = () => {
    sheet.classList.add('is-on'); sheet.focus({ preventScroll: true });
    if (!mounted) { mounted = true; requestAnimationFrame(() => setTimeout(() => { if (!sheet.hidden) site.mount(PROJECTS[current]); }, 60)); }
  };
  setNow(0);
}
