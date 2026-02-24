/* ============================================
   AIGP Caniçal — Coming Soon Page
   Tree growth loop + floating leaf particles
   ============================================ */

(function () {
  'use strict';

  /* --- Floating leaf particles --- */
  var LEAF_COUNT = 18;
  var LEAF_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 8.5-3.5 9-12z" ' +
    'fill="currentColor"/></svg>';
  var COLORS = ['#044D41', '#044D41', '#2D6B45', '#D6E189', '#D6E189', '#EA5912'];

  function createParticles() {
    var container = document.querySelector('.particles');
    if (!container) return;

    for (var i = 0; i < LEAF_COUNT; i++) {
      var leaf = document.createElement('div');
      leaf.classList.add('leaf-particle');
      leaf.innerHTML = LEAF_SVG;
      leaf.style.left = Math.random() * 100 + '%';
      leaf.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      leaf.style.animationDuration = (14 + Math.random() * 16) + 's';
      leaf.style.animationDelay = (Math.random() * 12) + 's';
      var size = (12 + Math.random() * 16) + 'px';
      leaf.style.width = size;
      leaf.style.height = size;
      container.appendChild(leaf);
    }
  }

  /* --- Tree growth animation loop --- */
  var GROW_DURATION = 2200;
  var PAUSE_DURATION = 3000;
  var FADE_DURATION = 800;
  var RESTART_DELAY = 800;

  var svg = null;

  function setHidden() {
    if (!svg) return;
    svg.classList.remove('growing', 'grown', 'fading');

    // Reset trunk
    var trunk = svg.querySelector('.trunk');
    if (trunk) {
      trunk.style.strokeDashoffset = '190';
      trunk.removeAttribute('class');
      trunk.setAttribute('class', 'trunk');
    }

    // Reset branches
    svg.querySelectorAll('.branch').forEach(function (b) {
      b.style.strokeDashoffset = '80';
    });

    // Reset circles
    svg.querySelectorAll('.leaf-circle').forEach(function (c) {
      c.style.opacity = '0';
      c.style.transform = 'scale(0)';
    });

    // Remove transitions from previous fading phase
    svg.querySelectorAll('.trunk, .branch, .leaf-circle').forEach(function (el) {
      el.style.removeProperty('transition');
    });

    // Force reflow
    void svg.offsetWidth;
  }

  function clearInlineStyles() {
    var trunk = svg.querySelector('.trunk');
    if (trunk) trunk.style.removeProperty('stroke-dashoffset');

    svg.querySelectorAll('.branch').forEach(function (b) {
      b.style.removeProperty('stroke-dashoffset');
    });

    svg.querySelectorAll('.leaf-circle').forEach(function (c) {
      c.style.removeProperty('opacity');
      c.style.removeProperty('transform');
    });

  }

  function setFullyVisible() {
    // Ensure everything is fully solid with inline styles
    var trunk = svg.querySelector('.trunk');
    if (trunk) trunk.style.strokeDashoffset = '0';

    svg.querySelectorAll('.branch').forEach(function (b) {
      b.style.strokeDashoffset = '0';
    });

    svg.querySelectorAll('.leaf-circle').forEach(function (c) {
      c.style.opacity = '1';
      c.style.transform = 'scale(1)';
    });

  }

  function runCycle() {
    // Phase 1: Reset to hidden
    setHidden();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // Phase 2: Start growth
        clearInlineStyles();
        svg.classList.add('growing');

        // Phase 3: After growth, switch to fully visible "grown" state
        setTimeout(function () {
          svg.classList.remove('growing');
          // Set inline styles to guarantee everything is fully filled
          setFullyVisible();
          svg.classList.add('grown');

          // Phase 4: After pause, fade out
          setTimeout(function () {
            svg.classList.remove('grown');
            svg.classList.add('fading');

            // Phase 5: Restart
            setTimeout(function () {
              svg.classList.remove('fading');
              runCycle();
            }, FADE_DURATION + RESTART_DELAY);

          }, PAUSE_DURATION);
        }, GROW_DURATION);
      });
    });
  }

  function init() {
    createParticles();
    svg = document.querySelector('.tree-svg');
    if (svg) runCycle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
