// Historia Timeline Scroll Animation

document.addEventListener('DOMContentLoaded', function() {
    // Get all timeline entries
    const timelineEntries = document.querySelectorAll('.timeline-entry');
    const progressLine = document.querySelector('.timeline-progress-line');
    const timelineContainer = document.querySelector('.timeline-container');
    const timelineSection = document.querySelector('.history-scroll-section');

    let lastScrollY = window.pageYOffset;

    // Use scroll position based detection
    function checkVisibility() {
        const windowHeight = window.innerHeight;
        const currentScrollY = window.pageYOffset;
        const scrollingDown = currentScrollY > lastScrollY;
        
        timelineEntries.forEach((entry) => {
            const rect = entry.getBoundingClientRect();
            
            if (scrollingDown) {
                // When scrolling down, show entries as they come into view
                if (rect.top < windowHeight * 0.85) {
                    entry.classList.add('visible');
                }
            } else {
                // When scrolling up, hide entries that go below viewport
                if (rect.top > windowHeight) {
                    entry.classList.remove('visible');
                }
            }
        });
        
        lastScrollY = currentScrollY;
    }

    // Update progress line on scroll
    let ticking = false;

    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                checkVisibility();
                updateProgressLine();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Update progress line based on scroll position
    function updateProgressLine() {
        if (!progressLine || !timelineContainer || !timelineSection) return;

        const sectionTop = timelineSection.offsetTop;
        const sectionHeight = timelineSection.offsetHeight;
        const scrolled = window.pageYOffset;
        const windowHeight = window.innerHeight;

        // Calculate how far we've scrolled into the section
        const scrollStart = sectionTop - windowHeight / 2;
        const scrollEnd = sectionTop + sectionHeight - windowHeight / 2;
        const scrollProgress = (scrolled - scrollStart) / (scrollEnd - scrollStart);

        // Clamp between 0 and 1
        const clampedProgress = Math.max(0, Math.min(1, scrollProgress));

        // Update the line height
        const containerHeight = timelineContainer.offsetHeight;
        const lineHeight = containerHeight * clampedProgress;
        progressLine.style.height = `${lineHeight}px`;
    }

    // Initial calls
    checkVisibility();
    updateProgressLine();

    // Update on window resize
    window.addEventListener('resize', function() {
        checkVisibility();
        updateProgressLine();
    });
});
