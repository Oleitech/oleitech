// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll(".card");

  // Check if cards exist
  if (!cards || cards.length === 0) {
    console.warn('No cards found in the DOM');
    return;
  }

  // Function to check if screen is mobile or tablet
  function isMobile() {
    return window.innerWidth <= 1024;
  }

  // Set initial card state
  function setInitialCardState() {
    cards.forEach((card, index) => {
      if (index === 0) {
        card.classList.add("is-active");
        card.classList.remove("is-inactive");
      } else {
        card.classList.add("is-inactive");
        card.classList.remove("is-active");
      }
    });
  }

  // Desktop hover logic - only initialized on desktop
  let desktopHoverListeners = null;

  function initDesktopCardHover() {
    if (isMobile()) return; // Don't initialize on mobile

    setInitialCardState();

    // Store listeners so we can remove them later if needed
    const onMouseEnter = (event) => {
      const card = event.target.closest(".card");
      if (card && cards) {
        cards.forEach(c => {
          c.classList.remove("is-active");
          c.classList.add("is-inactive");
        });
        card.classList.add("is-active");
        card.classList.remove("is-inactive");
      }
    };

    const onMouseLeave = (event) => {
      const card = event.target.closest(".card");
      if (card && cards) {
        setInitialCardState();
      }
    };

    const onClick = (event) => {
      const card = event.target.closest(".card");
      if (card && cards) {
        cards.forEach(c => c.classList.add("is-active"));
      }
    };

    document.addEventListener("mouseenter", onMouseEnter, true);
    document.addEventListener("mouseleave", onMouseLeave, true);
    document.addEventListener("click", onClick, true);

    desktopHoverListeners = {
      onMouseEnter,
      onMouseLeave,
      onClick
    };
  }

  function cleanupDesktopHover() {
    if (desktopHoverListeners) {
      document.removeEventListener("mouseenter", desktopHoverListeners.onMouseEnter, true);
      document.removeEventListener("mouseleave", desktopHoverListeners.onMouseLeave, true);
      document.removeEventListener("click", desktopHoverListeners.onClick, true);
      desktopHoverListeners = null;
    }
  }

  // Mobile scroll animation logic - optimized for performance
  let mobileObserver = null;

  function initMobileCardScroll() {
    if (!isMobile()) return; // Don't initialize on desktop

    // Cleanup any existing observer
    if (mobileObserver) {
      mobileObserver.disconnect();
      mobileObserver = null;
    }

    setInitialCardState();

    // Optimized Intersection Observer settings
    const observerOptions = {
      root: null,
      rootMargin: '-35% 0px -35% 0px', // Trigger when card is in middle 30% of viewport
      threshold: [0.2, 0.5, 0.8] // Fewer thresholds for better performance
    };

    let activeCardIndex = 0;
    let isUpdating = false;

    mobileObserver = new IntersectionObserver((entries) => {
      // Prevent rapid-fire updates
      if (isUpdating) return;

      // Find the most visible entry
      let mostVisible = null;
      let maxRatio = 0;

      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisible = entry.target;
        }
      });

      // Only update if we have a clear winner and it's different from current
      if (mostVisible && maxRatio > 0.2) {
        const newActiveIndex = Array.from(cards).indexOf(mostVisible);

        // Only update if the active card has changed
        if (newActiveIndex !== activeCardIndex) {
          isUpdating = true;
          activeCardIndex = newActiveIndex;

          cards.forEach((c, index) => {
            if (index === activeCardIndex) {
              c.classList.add("is-active");
              c.classList.remove("is-inactive");
            } else {
              c.classList.remove("is-active");
              c.classList.add("is-inactive");
            }
          });

          // Release lock after animation frame
          requestAnimationFrame(() => {
            isUpdating = false;
          });
        }
      }
    }, observerOptions);

    // Observe all cards
    cards.forEach(card => {
      mobileObserver.observe(card);
    });

    // Force check initial state after a brief delay to ensure first card shows properly
    setTimeout(() => {
      if (cards.length > 0) {
        const firstCard = cards[0];
        const firstCardRect = firstCard.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // If first card is at the top of viewport, ensure it's active with content visible
        if (firstCardRect.top < viewportHeight * 0.5) {
          activeCardIndex = 0;
          firstCard.classList.add("is-active");
          firstCard.classList.remove("is-inactive");

          // Make sure all other cards are inactive
          cards.forEach((card, index) => {
            if (index !== 0) {
              card.classList.remove("is-active");
              card.classList.add("is-inactive");
            }
          });
        }
      }
    }, 150);
  }

  function cleanupMobileScroll() {
    if (mobileObserver) {
      mobileObserver.disconnect();
      mobileObserver = null;
    }
  }

  // Initialize based on screen size
  function initCards() {
    // Clean up any existing listeners/observers
    cleanupDesktopHover();
    cleanupMobileScroll();

    // Initialize appropriate mode
    if (isMobile()) {
      initMobileCardScroll();
    } else {
      initDesktopCardHover();
    }
  }

  // Re-initialize on window resize with debouncing
  let resizeTimer;
  let currentMode = isMobile() ? 'mobile' : 'desktop';

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const newMode = isMobile() ? 'mobile' : 'desktop';

      // Only re-initialize if mode changed
      if (currentMode !== newMode) {
        currentMode = newMode;
        initCards();
      }
    }, 250);
  });

  // Initialize on page load
  initCards();
});

/* const heroVideo = document.getElementById("hero-video");

if (heroVideo) {
    heroVideo.addEventListener("mouseenter", () => {
        heroVideo.classList.add("is-hovered");
        const parentCol = heroVideo.closest(".col-md-6");
        if (parentCol) {
            parentCol.classList.remove("col-md-6");
            parentCol.classList.add("col-md-12");
        }
        const imageHeroCol6 = document.querySelector(".imageHeroCol6");
        if (imageHeroCol6) {
            imageHeroCol6.style.display = "none";
        }
    });

    heroVideo.addEventListener("mouseleave", () => {
        heroVideo.classList.remove("is-hovered");
        const parentCol = heroVideo.closest(".col-md-12");
        if (parentCol) {
            parentCol.classList.remove("col-md-12");
            parentCol.classList.add("col-md-6");
        }
        const imageHeroCol6 = document.querySelector(".imageHeroCol6");
        if (imageHeroCol6) {
            imageHeroCol6.style.display = "";
        }
    });
} */

// ============================================
// Menu Functionality
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Get menu elements
    const menuOverlay = document.getElementById('menuOverlay');
    const menuOpenBtn = document.querySelector('.btn_verde');
    const menuCloseBtn = document.getElementById('menuClose');
    const menuItems = document.querySelectorAll('.menu-item');
    const submenuContents = document.querySelectorAll('.submenu-content');
    const menuUnderline = document.getElementById('menuUnderline');
    const menuImages = document.querySelectorAll('.menu-image');
    const body = document.body;

    // Underline images for each menu item
    const underlineImages = {
        'empresa': 'assets/menu-underline-empresa.svg',
        'areas': 'assets/menu-underline-areas.svg',
        'sustentabilidade': 'assets/menu-underline-sustentabilidade.svg',
        'contactos': 'assets/menu-underline-contactos.svg'
    };

    // Function to update underline position and style
    function updateUnderline(menuItem) {
        const menuId = menuItem.getAttribute('data-menu');
        const span = menuItem.querySelector('span');
        const spanRect = span.getBoundingClientRect();
        const menuListRect = menuItem.closest('.menu-list').getBoundingClientRect();

        // Calculate position relative to menu list
        const top = spanRect.top - menuListRect.top + spanRect.height + 2;
        const left = spanRect.left - menuListRect.left;

        // Set underline image
        menuUnderline.style.backgroundImage = `url('${underlineImages[menuId]}')`;
        menuUnderline.style.top = top + 'px';
        menuUnderline.style.left = left + 'px';
        menuUnderline.style.width = spanRect.width + 'px'; // Full width of text
        menuUnderline.classList.add('active');
    }

    // Function to update menu image based on selected menu
    function updateMenuImage(menuId) {
        // Hide all images
        menuImages.forEach(image => {
            image.classList.remove('active');
        });

        // Show the image corresponding to the selected menu
        const imageToShow = document.querySelector(`.menu-image[data-menu-image="${menuId}"]`);
        if (imageToShow) {
            imageToShow.classList.add('active');
        }
    }

    // Function to open menu
    function openMenu() {
        menuOverlay.classList.add('active');
        body.classList.add('menu-open');

        // Set first menu item as active by default
        if (!document.querySelector('.menu-item.active')) {
            menuItems[0].classList.add('active');
            const firstSubmenu = menuItems[0].getAttribute('data-menu');
            document.getElementById(`submenu-${firstSubmenu}`).classList.add('active');
            updateUnderline(menuItems[0]);
            updateMenuImage(firstSubmenu);
        }
    }

    // Function to close menu
    function closeMenu() {
        menuOverlay.classList.remove('active');
        body.classList.remove('menu-open');
    }

    // Function to switch submenu
    function switchSubmenu(menuItem) {
        // Remove active class from all menu items and submenus
        menuItems.forEach(item => item.classList.remove('active'));
        submenuContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked menu item
        menuItem.classList.add('active');

        // Get menu ID
        const submenuId = menuItem.getAttribute('data-menu');

        // Update underline
        updateUnderline(menuItem);

        // Update menu image
        updateMenuImage(submenuId);

        // Show corresponding submenu
        const submenuToShow = document.getElementById(`submenu-${submenuId}`);
        if (submenuToShow) {
            submenuToShow.classList.add('active');
        }
    }

    // Event Listeners
    if (menuOpenBtn) {
        menuOpenBtn.addEventListener('click', openMenu);
    }

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeMenu);
    }

    // Menu item click handlers
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            switchSubmenu(this);
        });
    });

    // Close menu when clicking outside (on overlay background)
    menuOverlay.addEventListener('click', function(e) {
        if (e.target === menuOverlay) {
            closeMenu();
        }
    });

    // Close menu on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuOverlay.classList.contains('active')) {
            closeMenu();
        }
    });
});

// ============================================
// Mission Title Scroll Reveal Animation
// ============================================

function initMissionTitleReveal() {
    const missionTitle = document.querySelector('.mission-title');
    const missionLines = document.querySelectorAll('.mission-line');

    if (!missionTitle || missionLines.length === 0) return;

    function updateMissionTitleReveal() {
        const rect = missionTitle.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Calculate when element is in viewport
        const elementTop = rect.top;
        const elementBottom = rect.bottom;

        // Start revealing earlier - when element enters viewport
        const startReveal = windowHeight * 1.0; // Start when element enters bottom of viewport
        const endReveal = windowHeight * 0.2;   // Complete when 20% down the viewport

        if (elementBottom < 0 || elementTop > windowHeight) {
            // Element is out of viewport
            return;
        }

        // Calculate overall reveal progress (0 to 1)
        let progress = 0;

        if (elementTop < startReveal && elementTop > endReveal) {
            progress = (startReveal - elementTop) / (startReveal - endReveal);
        } else if (elementTop <= endReveal) {
            progress = 1;
        }

        // Clamp progress between 0 and 1
        progress = Math.max(0, Math.min(1, progress));

        // Animate each line sequentially
        const linesCount = missionLines.length;
        const progressPerLine = 1 / linesCount;

        missionLines.forEach((line, index) => {
            // Calculate progress for this specific line
            const lineStartProgress = index * progressPerLine;
            const lineEndProgress = (index + 1) * progressPerLine;

            let lineProgress = 0;

            if (progress >= lineEndProgress) {
                lineProgress = 1;
            } else if (progress > lineStartProgress) {
                lineProgress = (progress - lineStartProgress) / progressPerLine;
            }

            // Update background position for this line (from 100% 0 to 0% 0)
            const backgroundPosition = 100 - (lineProgress * 100);
            line.style.backgroundPosition = `${backgroundPosition}% 0`;
        });
    }

    // Update on scroll
    window.addEventListener('scroll', updateMissionTitleReveal);

    // Update on resize
    window.addEventListener('resize', updateMissionTitleReveal);

    // Initial update
    updateMissionTitleReveal();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMissionTitleReveal);
} else {
    initMissionTitleReveal();
}

// ============================================
// Growing Cards Counter Animation
// ============================================

function initGrowingCardsCounter() {
    const cardsContainer = document.querySelector('.growing-cards-indv');

    if (!cardsContainer) return;

    const counterElements = cardsContainer.querySelectorAll('.growingCards-title');
    let hasAnimated = false;

    // Parse the target value from the element, handling different formats
    function parseTargetValue(element) {
        const text = element.textContent.trim();
        const numberMatch = text.match(/\d+/);
        const number = numberMatch ? parseInt(numberMatch[0]) : 0;
        const suffix = text.replace(/\d+/g, '').trim(); // Get everything except numbers

        return { number, suffix };
    }

    // Animate a counter from 0 to target value
    function animateCounter(element, targetNumber, suffix, duration = 2000) {
        const startTime = performance.now();
        const startValue = 0;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation (easeOutExpo)
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            const currentValue = Math.floor(startValue + (targetNumber - startValue) * easeProgress);

            // Update the element with current value and suffix
            element.textContent = currentValue + (suffix ? ' ' + suffix : '');

            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                // Ensure final value is exact
                element.textContent = targetNumber + (suffix ? ' ' + suffix : '');
            }
        }

        requestAnimationFrame(update);
    }

    // Store original values for each counter
    const countersData = Array.from(counterElements).map(element => {
        const { number, suffix } = parseTargetValue(element);
        return { element, targetNumber: number, suffix };
    });

    // Set initial values to 0
    countersData.forEach(({ element, suffix }) => {
        element.textContent = '0' + (suffix ? ' ' + suffix : '');
    });

    // Intersection Observer to trigger animation when section is visible
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.3 // Trigger when 30% of the section is visible
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasAnimated) {
                hasAnimated = true;

                // Start animating all counters with slight delays for staggered effect
                countersData.forEach(({ element, targetNumber, suffix }, index) => {
                    setTimeout(() => {
                        animateCounter(element, targetNumber, suffix);
                    }, index * 100); // 100ms delay between each counter
                });

                // Stop observing after animation starts
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    observer.observe(cardsContainer);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrowingCardsCounter);
} else {
    initGrowingCardsCounter();
}

// ============================================
// Stacked Cards Scroll Animation
// ============================================

function initStackedCards() {
    const stackedSection = document.querySelector('.stacked-cards-section');
    
    if (!stackedSection) return;
    
    // Scope card selection to within the section
    const stackCards = stackedSection.querySelectorAll('.stack-card');

    if (stackCards.length === 0) return;

    let currentCardIndex = 0;
    let isLocked = false;
    let isCentering = false;
    let lastScrollY = window.pageYOffset;
    let wheelThrottle = false;

    function setActiveCard(index) {
        currentCardIndex = index;
        stackCards.forEach((card, i) => {
            card.classList.remove('active', 'scrolled-past');
            if (i === currentCardIndex) {
                card.classList.add('active');
            } else if (i < currentCardIndex) {
                card.classList.add('scrolled-past');
            }
        });
        
        // Update navigation button states for all cards
        stackCards.forEach((card) => {
            const prevBtn = card.querySelector('.card-nav-prev');
            const nextBtn = card.querySelector('.card-nav-next');
            
            if (prevBtn) {
                if (currentCardIndex === 0) {
                    prevBtn.classList.add('nav-disabled');
                } else {
                    prevBtn.classList.remove('nav-disabled');
                }
            }
            if (nextBtn) {
                if (currentCardIndex === stackCards.length - 1) {
                    nextBtn.classList.add('nav-disabled');
                } else {
                    nextBtn.classList.remove('nav-disabled');
                }
            }
        });
    }

    function centerSection(startCard = 0) {
        if (isCentering) return;

        isCentering = true;
        const sectionRect = stackedSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const sectionTop = sectionRect.top + window.pageYOffset;
        const sectionHeight = sectionRect.height;
        const targetScroll = sectionTop - (windowHeight / 2) + (sectionHeight / 2);

        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });

        // Wait for smooth scroll to finish
        setTimeout(() => {
            isLocked = true;
            isCentering = false;
            setActiveCard(startCard);
        }, 600);
    }

    function checkSectionPosition() {
        const currentScrollY = window.pageYOffset;
        const scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
        lastScrollY = currentScrollY;

        const sectionRect = stackedSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const viewportCenter = windowHeight / 2;
        const sectionCenter = sectionRect.top + sectionRect.height / 2;

        // If currently centering, don't do anything
        if (isCentering) return;

        // Section is entering from top (scrolling down)
        if (!isLocked && scrollDirection === 'down' &&
            sectionRect.top < windowHeight * 0.5 && sectionRect.top > 0) {
            // Trigger animation if we're on the first card (haven't completed going down yet)
            // Don't trigger if we're on the last card (already completed going down)
            if (currentCardIndex !== stackCards.length - 1) {
                centerSection(0); // Start with first card
                return;
            }
        }

        // Section is entering from bottom (scrolling up from below)
        if (!isLocked && scrollDirection === 'up' &&
            sectionRect.bottom > windowHeight * 0.5 && sectionRect.bottom < windowHeight) {
            // Trigger animation if we're on the last card (haven't completed going up yet)
            // Don't trigger if we're on the first card (already completed going up)
            if (currentCardIndex !== 0) {
                centerSection(stackCards.length - 1); // Start with last card
                return;
            }
        }

        // Check if we should unlock because section moved away from center
        if (isLocked) {
            const distanceFromCenter = Math.abs(sectionCenter - viewportCenter);

            // If section moved significantly away from center, unlock
            if (distanceFromCenter > 200) {
                isLocked = false;
            }
        }
    }

    // Handle wheel events for card navigation
    let deltaAccumulator = 0;
    const DELTA_THRESHOLD = 50; // Amount of scroll needed to trigger card change

    function handleWheel(e) {
        if (isCentering) {
            e.preventDefault();
            return;
        }

        const sectionRect = stackedSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const viewportCenter = windowHeight / 2;
        const sectionCenter = sectionRect.top + sectionRect.height / 2;
        const isCentered = Math.abs(sectionCenter - viewportCenter) < 200;

        // Only handle if locked and centered
        if (!isLocked || !isCentered) return;

        // Always prevent default scroll when locked and centered
        e.preventDefault();

        // If already throttled, just prevent scroll but don't change cards
        if (wheelThrottle) return;

        // Accumulate scroll delta
        deltaAccumulator += e.deltaY;

        // Check if we've accumulated enough scroll to change card
        if (Math.abs(deltaAccumulator) >= DELTA_THRESHOLD) {
            const direction = deltaAccumulator > 0 ? 'down' : 'up';
            deltaAccumulator = 0; // Reset accumulator

            // Apply throttle
            wheelThrottle = true;
            setTimeout(() => { wheelThrottle = false; }, 600);

            // Scrolling down
            if (direction === 'down') {
                if (currentCardIndex < stackCards.length - 1) {
                    setActiveCard(currentCardIndex + 1);
                } else {
                    // Last card - unlock and allow scroll to continue
                    isLocked = false;
                    wheelThrottle = false;
                    // Allow the next scroll event to pass through
                    setTimeout(() => {
                        deltaAccumulator = 0;
                    }, 100);
                }
            }
            // Scrolling up
            else if (direction === 'up') {
                if (currentCardIndex > 0) {
                    setActiveCard(currentCardIndex - 1);
                } else {
                    // First card - unlock and allow scroll to continue
                    isLocked = false;
                    wheelThrottle = false;
                    // Allow the next scroll event to pass through
                    setTimeout(() => {
                        deltaAccumulator = 0;
                    }, 100);
                }
            }
        }
    }

    // Handle navigation buttons
    stackCards.forEach((card, cardIndex) => {
        const prevBtn = card.querySelector('.card-nav-prev');
        const nextBtn = card.querySelector('.card-nav-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentCardIndex > 0) {
                    setActiveCard(currentCardIndex - 1);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentCardIndex < stackCards.length - 1) {
                    setActiveCard(currentCardIndex + 1);
                }
            });
        }

        // Handle dot indicator clicks
        const dots = card.querySelectorAll('.card-dot');
        dots.forEach((dot) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetCard = parseInt(dot.getAttribute('data-dot')) - 1;
                if (targetCard >= 0 && targetCard < stackCards.length) {
                    setActiveCard(targetCard);
                }
            });
        });
    });

    // Listen for scroll to check section position
    window.addEventListener('scroll', checkSectionPosition);

    // Listen for wheel events to handle card navigation when locked
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Set first card as active on page load
    setActiveCard(0);

    // Initial check
    checkSectionPosition();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStackedCards);
} else {
    initStackedCards();
}

// Vagas Accordion
function initVagasAccordion() {
    const accordionItems = document.querySelectorAll('.vagas-accordion__item');
    
    if (!accordionItems || accordionItems.length === 0) return;
    
    accordionItems.forEach(item => {
        const header = item.querySelector('.vagas-accordion__header');
        
        header.addEventListener('click', () => {
            const isOpen = item.classList.contains('is-open');
            
            // Close all items
            accordionItems.forEach(i => i.classList.remove('is-open'));
            
            // If it wasn't open, open it
            if (!isOpen) {
                item.classList.add('is-open');
            }
        });
    });
}

// Initialize accordion when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVagasAccordion);
} else {
    initVagasAccordion();
}
