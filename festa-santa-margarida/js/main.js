/* ============================================
   Festa de Santa Margarida — Scroll Animation
   1. Intro: flower blooms → drifts to banner → fades out
   2. Scroll: hero collapses into center → glow → reveal expands out
   ============================================ */

(function () {
  'use strict';

  var heroImg       = document.querySelector('.hero-img');
  var flower        = document.querySelector('.flower');
  var glow          = document.querySelector('.glow');
  var revealImg     = document.querySelector('.reveal-img');
  var revealImgV2   = document.querySelector('.reveal-img-v2');
  var scrollHint    = document.querySelector('.scroll-hint');
  var showcase      = document.querySelector('.showcase');

  var SX = 0.24, SY = 0.62;
  var BASE = 100;
  var AR   = 121.6 / 133.53;

  var introComplete = false;
  var introStart    = null;
  var INTRO_DUR     = 2000;

  /* --- Helpers --- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t)    { return a + (b - a) * clamp(t, 0, 1); }
  function ease(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
  function ptIn(el, fx, fy) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width * fx, y: r.top + r.height * fy };
  }
  function imgDiagonal(el) {
    var r = el.getBoundingClientRect();
    return Math.sqrt(r.width * r.width + r.height * r.height) / 2;
  }

  /* --- Floating particles --- */
  function createParticles() {
    for (var i = 0; i < 16; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var size = 2 + Math.random() * 5;
      var opacity = 0.06 + Math.random() * 0.1;
      p.style.width  = size + 'px';
      p.style.height = size + 'px';
      p.style.left   = Math.random() * 100 + '%';
      p.style.top    = (80 + Math.random() * 30) + '%';
      p.style.setProperty('--p-opacity', opacity);
      p.style.animationDuration = (12 + Math.random() * 18) + 's';
      p.style.animationDelay    = (Math.random() * 12) + 's';
      document.body.appendChild(p);
    }
  }
  createParticles();

  /* --- Flower transform (intro only) --- */
  function setFlowerTransform(fx, fy, sz, rot, op) {
    var sc = sz / BASE;
    var tx = fx - BASE / 2;
    var ty = fy - (BASE * AR) / 2;
    flower.style.opacity   = op;
    flower.style.transform =
      'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ') rotate(' + rot + 'deg)';
  }

  /* --- Soft circular mask helper --- */
  function setMask(el, radius) {
    var soft  = Math.min(60, Math.max(12, radius * 0.2));
    var inner = Math.max(0, radius - soft);
    var val   = 'radial-gradient(circle at 50% 50%, black ' + inner + 'px, transparent ' + radius + 'px)';
    el.style.webkitMaskImage = val;
    el.style.maskImage       = val;
  }
  function clearMask(el) {
    el.style.webkitMaskImage = '';
    el.style.maskImage       = '';
  }

  /* --- Intro animation --- */
  function runIntro(ts) {
    if (!introStart) introStart = ts;
    var t  = clamp((ts - introStart) / INTRO_DUR, 0, 1);
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cx = vw / 2;
    var cy = vh / 2;

    var p0     = ptIn(heroImg, SX, SY);
    var sRest  = clamp(vw * 0.08, 50, 120);
    var sLarge = clamp(vw * 0.14, 70, 180);

    var fOp, fSz, fRot, fx, fy;

    if (t < 0.5) {
      var bt = ease(t / 0.5);
      fx   = cx;
      fy   = cy;
      fOp  = clamp(t / 0.12, 0, 1);
      fSz  = lerp(0, sLarge, bt);
      fRot = lerp(-180, 0, bt);
    } else {
      var bt = ease((t - 0.5) / 0.5);
      fx   = lerp(cx, p0.x, bt);
      fy   = lerp(cy, p0.y, bt);
      fSz  = lerp(sLarge, sRest, bt);
      fRot = 0;
      fOp  = bt < 0.6 ? 1 : lerp(1, 0, (bt - 0.6) / 0.4);

      var bannerT = ease(clamp((t - 0.5) / 0.4, 0, 1));
      heroImg.style.opacity   = bannerT;
      heroImg.style.transform = 'scale(' + lerp(0.94, 1, bannerT) + ')';
    }

    setFlowerTransform(fx, fy, fSz, fRot, fOp);

    if (t < 1) {
      requestAnimationFrame(runIntro);
    } else {
      introComplete = true;
      flower.style.opacity = 0;
      flower.style.display = 'none';
    }
  }

  function startIntro() { requestAnimationFrame(runIntro); }
  if (heroImg.complete) startIntro();
  else heroImg.addEventListener('load', startIntro);

  /* --- Scroll handler --- */
  function onScroll() {
    var scrollY = window.scrollY;
    var vh = window.innerHeight;
    var vw = window.innerWidth;

    if (scrollHint) scrollHint.classList.toggle('hidden', scrollY > 60);

    if (!introComplete && scrollY > 10) {
      introComplete = true;
      heroImg.style.opacity   = 1;
      heroImg.style.transform = '';
      flower.style.opacity = 0;
      flower.style.display = 'none';
    }
    if (!introComplete) return;

    /* --- Showcase scroll progress --- */
    var sTop        = showcase.offsetTop;
    var scrollRange = showcase.offsetHeight - vh;
    var t           = clamp((scrollY - sTop) / scrollRange, 0, 1);

    /* =============================================
       Phase 1: Hero collapses into center (t 0.05→0.48)
       Phase 2: Glow flash (t ~0.42→0.58)
       Phase 3: Reveal v1 expands from center (t 0.52→0.88)
       Phase 4: Crossfade v1 → v2 (t 0.88→1.0)
       ============================================= */

    // --- HERO: mask shrinks from full → 0 ---
    var h0 = 0.05, h1 = 0.48;
    var ht = clamp((t - h0) / (h1 - h0), 0, 1);
    var he = ease(ht);

    if (ht <= 0) {
      // Fully visible, no mask
      heroImg.style.opacity = 1;
      clearMask(heroImg);
      heroImg.style.transform = '';
    } else if (ht >= 1) {
      // Fully gone
      heroImg.style.opacity = 0;
      clearMask(heroImg);
    } else {
      var heroMaxR  = imgDiagonal(heroImg);
      var heroR     = lerp(heroMaxR * 1.15, 0, he);

      heroImg.style.opacity = 1;
      setMask(heroImg, heroR);
      heroImg.style.transform =
        'scale(' + lerp(1, 1.06, he) + ') rotate(' + lerp(0, 1.2, he) + 'deg)';
    }

    // --- REVEAL V1: mask grows from 0 → full ---
    var r0 = 0.52, r1 = 0.88;
    var rt = clamp((t - r0) / (r1 - r0), 0, 1);
    var re = ease(rt);

    if (rt <= 0) {
      // Hidden
      revealImg.style.opacity = 0;
      clearMask(revealImg);
      revealImg.style.transform = '';
    } else if (rt >= 1) {
      // Fully visible, remove mask
      revealImg.style.opacity = 1;
      clearMask(revealImg);
      revealImg.style.transform = '';
    } else {
      var revMaxR = imgDiagonal(revealImg);
      var revR    = lerp(0, revMaxR * 1.15, re);

      revealImg.style.opacity = 1;
      setMask(revealImg, revR);
      revealImg.style.transform = 'scale(' + lerp(0.97, 1, re) + ')';
    }

    // --- REVEAL V2: smooth crossfade with downward slide ---
    if (revealImgV2) {
      var v0 = 0.78, v1end = 1.0;
      var vt = clamp((t - v0) / (v1end - v0), 0, 1);
      var ve = ease(vt);
      var slideY = lerp(-4, 0, ve);
      revealImgV2.style.opacity = ve;
      revealImgV2.style.transform = 'translateY(' + slideY + 'px)';
      if (vt > 0 && rt >= 1) {
        revealImg.style.opacity = 1 - ve;
      }
    }

    /* --- GLOW: peaks in the gap between the two phases --- */
    if (glow) {
      var glowT     = clamp(1 - Math.abs(t - 0.50) / 0.14, 0, 1);
      var glowOp    = ease(glowT) * 0.7;
      var glowScale = 1 + ease(glowT) * 1.8;

      glow.style.opacity   = glowOp;
      glow.style.transform =
        'translate(' + (vw / 2 - 250) + 'px,' + (vh / 2 - 250) + 'px) scale(' + glowScale + ')';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    if (introComplete) onScroll();
  }, { passive: true });
})();
