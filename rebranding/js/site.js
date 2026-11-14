/* Oleitech v2 — páginas interiores: transição de fumo entre páginas, revelações, cursor, menu, formulário.
   Com data-home (index.html) só corre a transição. */
(function () {
  'use strict';
  var html = document.documentElement;
  var me = document.currentScript;
  var HOME = !!(me && me.hasAttribute('data-home'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function tween(ms, fn, ease) {
    ease = ease || easeIO;
    return new Promise(function (res) {
      var t0 = performance.now();
      (function step(now) { var k = Math.min(1, (now - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(step); else res(); })(t0);
    });
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* O loader da home só passa na primeira página da sessão: quem entra por uma página interior já não o vê. */
  if (!HOME) store.set('oleitech-loader', '1');

  /* ================= Véu de fumo (transição) =================
     0–480 ms o fumo come a página a partir das margens · logótipo acende · navega ·
     na página nova: logótipo pulsa e apaga · o fumo recua e revela (≈1,6 s no total). */
  var veil = document.getElementById('veil');
  if (!veil) { veil = document.createElement('div'); veil.className = 'veil'; veil.id = 'veil'; veil.setAttribute('aria-hidden', 'true'); document.body.appendChild(veil); }
  veil.innerHTML = '<canvas></canvas><div class="veil__flat"></div><svg class="veil__logo" viewBox="0 0 4726.79 724"><use href="#logo"/></svg>';
  var vCanvas = veil.querySelector('canvas'), vFlat = veil.querySelector('.veil__flat'), vLogo = veil.querySelector('.veil__logo');
  var smoke = makeSmoke(vCanvas);
  if (!smoke) vCanvas.remove();
  function cover(p) { if (smoke) smoke.draw(p); else vFlat.style.opacity = p; }

  function makeSmoke(canvas) {
    var gl; try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) {}
    if (!gl) return null;
    var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var fs = [
      'precision mediump float;uniform vec2 r;uniform float p;uniform float s;',
      'float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}',
      'float fbm(vec2 q){float v=0.,a=.5;for(int k=0;k<5;k++){v+=a*n(q);q=q*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
      'void main(){vec2 uv=gl_FragCoord.xy/r;float asp=r.x/r.y;vec2 c=(uv-.5)*vec2(asp,1.);',
      ' float e=length(c)/length(vec2(asp,1.)*.5);',
      ' float f=fbm(c*2.4+vec2(s*3.1,-s*1.7)+fbm(c*1.3-s)*1.2);',
      ' float v=(1.-e)*.9+(f-.5)*1.1;',          // margens primeiro, fumo pelo meio
      ' float th=-.75+p*2.4;',
      ' float a=1.-smoothstep(th-.16,th+.02,v);',
      ' float edge=smoothstep(th-.16,th-.05,v)*a;', // franja de fumo mais clara
      ' vec3 col=mix(vec3(.0784),vec3(.17),edge*.55);',
      ' gl_FragColor=vec4(col*a,a);}'
    ].join('\n');
    function sh(t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'r'), uP = gl.getUniformLocation(pr, 'p'), uS = gl.getUniformLocation(pr, 's');
    var seed = Math.random() * 10;
    return {
      draw: function (p) {
        // ponytail: meia resolução chega para fumo desfocado
        var w = Math.max(2, Math.round(innerWidth / 2)), hgt = Math.max(2, Math.round(innerHeight / 2));
        if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
        gl.uniform2f(uR, w, hgt); gl.uniform1f(uP, p); gl.uniform1f(uS, seed + p * .35);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }

  var leaving = false;
  function leave(href) {
    if (leaving) return; leaving = true;
    veil.classList.add('is-on'); html.classList.add('is-leaving');
    vLogo.style.opacity = 0; vLogo.style.transform = 'scale(.96)';
    tween(480, cover)
      .then(function () { return tween(260, function (k) { vLogo.style.opacity = k; vLogo.style.transform = 'scale(' + (.96 + .04 * k) + ')'; }); })
      .then(function () { store.set('oleitech-veil', String(Date.now())); location.href = href; });
  }

  var arrived = Promise.resolve();
  if (html.classList.contains('veil-on')) {
    store.del('oleitech-veil');
    veil.classList.add('is-on'); cover(1); vLogo.style.opacity = 1;
    html.classList.remove('veil-on');
    arrived = (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(600)]) : wait(0))
      .then(function () { return wait(120); })
      .then(function () { return tween(420, function (k) { vLogo.style.opacity = 1 - k; vLogo.style.transform = 'scale(' + (1 + .05 * k) + ')'; }); })
      .then(function () { return tween(560, function (k) { cover(1 - k); }); })
      .then(function () { veil.classList.remove('is-on'); });
  }
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return; // voltar atrás com bfcache: tirar o véu
    leaving = false; html.classList.remove('is-leaving', 'veil-on'); veil.classList.remove('is-on'); cover(0); vLogo.style.opacity = 0;
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reduce.matches) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname) return;            // âncora na mesma página: comportamento normal
    if (!/(\.html?|\/)$/.test(url.pathname)) return;
    e.preventDefault(); leave(url.href);
  });

  if (HOME) return; // na home, o resto (menu, letras, loader) é do home.js

  /* ================= Letra-a-letra nos botões ([data-roll]) ================= */
  $$('[data-roll]').forEach(function (el) {
    if (el.querySelector('.ch')) return;
    var txt = el.textContent; el.setAttribute('aria-label', txt); el.textContent = '';
    Array.prototype.forEach.call(txt, function (c, i) {
      var s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<span class="ch__a"></span><span class="ch__b"></span>';
      s.firstChild.textContent = s.lastChild.textContent = c === ' ' ? ' ' : c; el.appendChild(s);
    });
  });

  /* ================= Menu (telemóvel) ================= */
  var menu = document.getElementById('menu'), menuBtn = document.getElementById('menu-btn'), menuOpen = false;
  function setMenu(open) {
    menuOpen = open; menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    $$('a', menu).forEach(function (a) { a.tabIndex = open ? 0 : -1; });
    html.classList.toggle('menu-open', open);
    if (open) { html.classList.remove('hud-hide'); menu.querySelector('a').focus({ preventScroll: true }); }
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); menuBtn.focus(); } });
    window.matchMedia('(min-width: 821px)').addEventListener('change', function (e) { if (e.matches && menuOpen) setMenu(false); });
  }

  /* ================= Header: fundo ao fazer scroll, esconde a descer ================= */
  var lastY = scrollY;
  function onScroll() {
    var y = scrollY;
    html.classList.toggle('is-scrolled', y > 24);
    if (!menuOpen && !html.classList.contains('menu-open')) html.classList.toggle('hud-hide', y > lastY && y > 320);
    if (y < lastY - 4 || y < 320) html.classList.remove('hud-hide');
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.hud')) html.classList.remove('hud-hide'); });

  /* ================= Relógio de Oleiros ([data-clock]) ================= */
  var clocks = $$('[data-clock]');
  if (clocks.length) {
    var fmt = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    var tick = function () { var t = fmt.format(new Date()); clocks.forEach(function (c) { c.textContent = t; }); };
    tick(); setInterval(tick, 1000);
  }

  /* ================= Formulário mailto (#agendar) ================= */
  var form = document.getElementById('agendar');
  var subjectEl = document.querySelector('[data-subject]');
  var subject = function () { return (location.hash === '#agendar' || /[?&]conversa/.test(location.search)) ? 'Pedido de reunião' : 'Contacto pelo site'; };
  function syncSubject() { if (subjectEl) subjectEl.textContent = subject(); }
  syncSubject(); addEventListener('hashchange', syncSubject);
  if (form && form.dataset.mailto) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // a validação nativa (required/email) já correu antes deste evento
      var fd = new FormData(form), v = function (k) { return String(fd.get(k) || '').trim(); };
      var body = 'Nome: ' + v('Nome') + '\nEmail: ' + v('Email') + '\nTelefone: ' + (v('Telefone') || '—') +
        '\nEmpresa: ' + (v('Empresa') || '—') + '\n\nMensagem:\n' + v('Mensagem');
      var url = 'mailto:' + form.dataset.mailto + '?subject=' + encodeURIComponent(subject()) + '&body=' + encodeURIComponent(body);
      form.dataset.sent = url; // útil para testes
      location.href = url;
    });
  }

  /* ================= Cursor (só rato, sem movimento reduzido) ================= */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  function setupCursor(g) {
    if (!fine.matches || reduce.matches) return;
    var c = document.createElement('div'); c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="cursor__ring"></span><span class="cursor__dot"></span>';
    document.body.appendChild(c); html.classList.add('has-cursor', 'cursor-out');
    var dot = c.lastChild, ring = c.firstChild;
    var dx = g.quickTo(dot, 'x', { duration: .08 }), dy = g.quickTo(dot, 'y', { duration: .08 });
    var rx = g.quickTo(ring, 'x', { duration: .45, ease: 'power3.out' }), ry = g.quickTo(ring, 'y', { duration: .45, ease: 'power3.out' });
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      html.classList.remove('cursor-out'); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      var t = e.target;
      html.classList.toggle('cursor-text', !!t.closest('input, textarea, select'));
      html.classList.toggle('cursor-link', !!t.closest('a, button, [tabindex="0"]'));
    }, { passive: true });
    document.addEventListener('pointerleave', function () { html.classList.add('cursor-out'); });
  }

  /* ================= Revelações (GSAP: SplitText em linhas, imagens, fades) ================= */
  function scramble(el, finals) {
    // só baralha um nó com o texto original e uma vez (o SplitText pode voltar a partir as linhas a meio)
    var final = el.textContent;
    if (el.__sw || finals.indexOf(final) < 0) return;
    el.__sw = true;
    var glyphs = 'OLEITECH0123456789/#+<>', t0 = performance.now(), dur = 900;
    el.classList.add('sw');
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), fixed = Math.floor(k * final.length), out = '';
      for (var i = 0; i < final.length; i++) out += (i < fixed || final[i] === ' ') ? final[i] : glyphs[(Math.random() * glyphs.length) | 0];
      el.textContent = out;
      if (k < 1) requestAnimationFrame(step); else { el.textContent = final; el.classList.remove('sw'); }
    })(t0);
  }

  function reveals() {
    var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
    if (!g || !ST || !Split || reduce.matches) { html.classList.add('reveal-ready'); if (g && !reduce.matches) setupCursor(g); return; }
    g.registerPlugin(ST, Split);
    setupCursor(g);
    var start = 'top 88%';
    $$('[data-split]').forEach(function (el) {
      var finals = $$('[data-swap]', el).map(function (s) { return s.textContent; });
      Split.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'ln', autoSplit: true,
        onSplit: function (self) {
          if (el.__shown) return; // nova partição por resize: não repetir a revelação
          return g.from(self.lines, { yPercent: 115, duration: 1.1, ease: 'power4.out', stagger: .09,
            scrollTrigger: { trigger: el, start: start, once: true },
            onComplete: function () { el.__shown = true; $$('[data-swap]', el).forEach(function (s) { scramble(s, finals); }); } });
        }
      });
    });
    $$('[data-reveal]').forEach(function (el) {
      var img = el.querySelector('img');
      var tl = g.timeline({ scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power3.inOut', clearProps: 'clipPath' });
      if (img) tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'power3.out', clearProps: 'scale' }, 0);
    });
    var fades = $$('[data-fade]');
    g.set(fades, { autoAlpha: 0, y: 26 });
    ST.batch(fades, { start: 'top 92%', once: true, onEnter: function (b) { g.to(b, { autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .08, clearProps: 'transform' }); } });
    html.classList.add('reveal-ready');
    // as imagens lazy mudam a altura da página: recalcular quando carregam
    $$('img[loading="lazy"]').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { ST.refresh(); }, { once: true }); });
  }

  /* espera pelo GSAP (defer), pelas fontes (para partir as linhas certas) e pelo véu */
  var ready = new Promise(function (r) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r); else r(); });
  ready
    .then(function () { return document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(1200)]) : null; })
    .then(function () { return arrived; })
    .then(reveals)
    .catch(function () { html.classList.add('reveal-ready'); });
})();
