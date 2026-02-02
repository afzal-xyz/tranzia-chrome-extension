// Tranzia Chrome Extension - Content Script
// Injects safety scores into Google Maps directions pages

(function () {
    'use strict';

    const TRANZIA_BADGE_CLASS = 'tranzia-safety-badge';
    const DEBOUNCE_MS = 500;

    let lastUrl = '';
    let debounceTimer = null;
    let isProcessing = false;

    console.log('[Tranzia] Content script loaded');

    /**
     * Check if current page is a directions page
     */
    function isDirectionsPage() {
        return window.location.pathname.includes('/maps/dir/') ||
            window.location.href.includes('dir/') ||
            document.querySelector('[data-trip-index]') !== null;
    }

    /**
     * Parse origin and destination from URL
     */
    function parseDirectionsUrl(url) {
        try {
            // Pattern: /maps/dir/Origin/Destination/...
            const dirMatch = url.match(/\/maps\/dir\/([^\/]+)\/([^\/]+)/);
            if (dirMatch) {
                return {
                    origin: decodeURIComponent(dirMatch[1].replace(/\+/g, ' ')),
                    destination: decodeURIComponent(dirMatch[2].replace(/\+/g, ' '))
                };
            }

            // Pattern with coordinates: @lat,lng
            const coordMatch = url.match(/\/maps\/dir\/([^@]+)\/([^@]+)@/);
            if (coordMatch) {
                return {
                    origin: decodeURIComponent(coordMatch[1].replace(/\+/g, ' ')),
                    destination: decodeURIComponent(coordMatch[2].replace(/\+/g, ' '))
                };
            }

            return null;
        } catch (e) {
            console.error('[Tranzia] Error parsing URL:', e);
            return null;
        }
    }

    /**
     * Detect current travel mode from Google Maps UI
     */
    function detectTravelMode() {
        // Check for active mode buttons
        const modeSelectors = {
            'driving': '[data-travel_mode="0"][aria-checked="true"], [data-value="Driving"][aria-selected="true"]',
            'transit': '[data-travel_mode="3"][aria-checked="true"], [data-value="Transit"][aria-selected="true"]',
            'walking': '[data-travel_mode="2"][aria-checked="true"], [data-value="Walking"][aria-selected="true"]',
            'cycling': '[data-travel_mode="1"][aria-checked="true"], [data-value="Cycling"][aria-selected="true"]'
        };

        for (const [mode, selector] of Object.entries(modeSelectors)) {
            if (document.querySelector(selector)) {
                return mode;
            }
        }

        // Default to driving
        return 'driving';
    }

    /**
     * Find route cards in the Google Maps UI
     */
    function findRouteCards() {
        // Multiple selectors for different Google Maps layouts
        const selectors = [
            '[data-trip-index]',                    // Main route cards
            '.section-directions-trip',             // Alternative layout
            '[role="listitem"][data-index]',        // List items
            '.directions-mode-group-list-item'      // Another layout
        ];

        for (const selector of selectors) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                return Array.from(cards);
            }
        }

        return [];
    }

    /**
     * Create safety badge element
     */
    function createBadge(score, label, isSafest = false) {
        const badge = document.createElement('div');
        badge.className = TRANZIA_BADGE_CLASS;

        // Determine color based on score
        let bgColor, textColor, emoji;
        if (score >= 7) {
            bgColor = '#10B981'; // Green
            textColor = 'white';
            emoji = '🛡️';
        } else if (score >= 5) {
            bgColor = '#F59E0B'; // Amber
            textColor = 'white';
            emoji = '⚠️';
        } else {
            bgColor = '#EF4444'; // Red
            textColor = 'white';
            emoji = '🚨';
        }

        badge.innerHTML = `
      <span class="tranzia-emoji">${emoji}</span>
      <span class="tranzia-score">${score.toFixed(1)}</span>
      <span class="tranzia-label">${label}</span>
      ${isSafest ? '<span class="tranzia-safest">✓ Safest</span>' : ''}
    `;

        badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 4px 0;
      border-radius: 6px;
      background: ${bgColor};
      color: ${textColor};
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      transition: opacity 0.2s;
    `;

        badge.title = 'Click for full safety report on Tranzia';
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://tranzia.com?url=${encodeURIComponent(window.location.href)}`, '_blank');
        });

        return badge;
    }

    /**
     * Create loading badge
     */
    function createLoadingBadge() {
        const badge = document.createElement('div');
        badge.className = TRANZIA_BADGE_CLASS;
        badge.innerHTML = `
      <span class="tranzia-loading">🛡️ Loading safety score...</span>
    `;
        badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 4px 0;
      border-radius: 6px;
      background: #E5E7EB;
      color: #6B7280;
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
        return badge;
    }

    /**
     * Create error badge
     */
    function createErrorBadge(message) {
        const badge = document.createElement('div');
        badge.className = TRANZIA_BADGE_CLASS;
        badge.innerHTML = `
      <span class="tranzia-error">⚠️ ${message}</span>
    `;
        badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 4px 0;
      border-radius: 6px;
      background: #FEE2E2;
      color: #991B1B;
      font-size: 11px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
        return badge;
    }

    /**
     * Remove all existing Tranzia badges
     */
    function removeBadges() {
        document.querySelectorAll(`.${TRANZIA_BADGE_CLASS}`).forEach(el => el.remove());
    }

    /**
     * Inject badges into route cards
     */
    async function injectBadges() {
        if (isProcessing) return;
        if (!isDirectionsPage()) return;

        const currentUrl = window.location.href;
        if (currentUrl === lastUrl) return;

        lastUrl = currentUrl;
        isProcessing = true;

        console.log('[Tranzia] Processing directions page');

        // Remove old badges
        removeBadges();

        // Find route cards
        const routeCards = findRouteCards();
        if (routeCards.length === 0) {
            console.log('[Tranzia] No route cards found');
            isProcessing = false;
            return;
        }

        console.log(`[Tranzia] Found ${routeCards.length} route cards`);

        // Add loading badges
        routeCards.forEach(card => {
            const loadingBadge = createLoadingBadge();
            // Try to find a good insertion point
            const insertPoint = card.querySelector('[role="heading"]') ||
                card.querySelector('h1, h2, h3') ||
                card.firstChild;
            if (insertPoint) {
                insertPoint.parentNode.insertBefore(loadingBadge, insertPoint.nextSibling);
            } else {
                card.appendChild(loadingBadge);
            }
        });

        // Fetch score from API
        const mode = detectTravelMode();

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getScore',
                url: currentUrl,
                mode: mode
            });

            // Remove loading badges
            removeBadges();

            if (response.error) {
                console.error('[Tranzia] API error:', response.error);
                routeCards.forEach(card => {
                    const errorBadge = createErrorBadge(response.error);
                    const insertPoint = card.querySelector('[role="heading"]') || card.firstChild;
                    if (insertPoint) {
                        insertPoint.parentNode.insertBefore(errorBadge, insertPoint.nextSibling);
                    }
                });
            } else if (response.success === false) {
                // API returned success: false with error message
                console.error('[Tranzia] API returned error:', response.error);
                routeCards.forEach(card => {
                    const errorBadge = createErrorBadge(response.error || 'Could not score route');
                    const insertPoint = card.querySelector('[role="heading"]') || card.firstChild;
                    if (insertPoint) {
                        insertPoint.parentNode.insertBefore(errorBadge, insertPoint.nextSibling);
                    }
                });
            } else if (response.routes && response.routes.length > 0) {
                // Find the safest route
                const maxScore = Math.max(...response.routes.map(r => r.score || 0));

                // Inject score badges
                routeCards.forEach((card, index) => {
                    const routeData = response.routes[index] || response.routes[0];
                    const score = routeData.score || 5;
                    // API returns 'label' not 'risk_label'
                    const label = routeData.label || 'Moderate';
                    const isSafest = routeCards.length > 1 && score === maxScore;

                    const badge = createBadge(score, label, isSafest);

                    const insertPoint = card.querySelector('[role="heading"]') ||
                        card.querySelector('h1, h2, h3') ||
                        card.firstChild;
                    if (insertPoint) {
                        insertPoint.parentNode.insertBefore(badge, insertPoint.nextSibling);
                    } else {
                        card.appendChild(badge);
                    }
                });

                console.log('[Tranzia] Badges injected successfully');
            } else {
                // No routes in response
                console.log('[Tranzia] No routes in response:', response);
            }
        } catch (error) {
            console.error('[Tranzia] Error fetching score:', error);
            removeBadges();
        }

        isProcessing = false;
    }

    /**
     * Debounced URL change handler
     */
    function handleUrlChange() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            injectBadges();
        }, DEBOUNCE_MS);
    }

    // Watch for URL changes (Google Maps is a SPA)
    let previousUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== previousUrl) {
            previousUrl = window.location.href;
            handleUrlChange();
        }
    });

    urlObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also watch for route card changes
    const routeObserver = new MutationObserver((mutations) => {
        // Check if any mutation added route cards
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const hasRouteCards = findRouteCards().length > 0;
                const hasBadges = document.querySelectorAll(`.${TRANZIA_BADGE_CLASS}`).length > 0;
                if (hasRouteCards && !hasBadges) {
                    handleUrlChange();
                    break;
                }
            }
        }
    });

    routeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check
    if (isDirectionsPage()) {
        setTimeout(injectBadges, 1000); // Wait for page to fully load
    }

})();
