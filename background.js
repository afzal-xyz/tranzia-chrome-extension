// Tranzia Chrome Extension - Background Service Worker
// Handles API calls and caching

const API_BASE = 'https://tranzia.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for scores
const scoreCache = new Map();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getScore') {
        handleGetScore(request.url, request.mode)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }

    if (request.action === 'clearCache') {
        scoreCache.clear();
        sendResponse({ success: true });
        return true;
    }
});

/**
 * Get safety score for a URL, with caching
 */
async function handleGetScore(url, mode = 'driving') {
    const cacheKey = `${url}|${mode}`;

    // Check cache first
    if (scoreCache.has(cacheKey)) {
        const cached = scoreCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('[Tranzia] Cache hit:', cacheKey);
            return cached.data;
        }
        // Cache expired, remove it
        scoreCache.delete(cacheKey);
    }

    console.log('[Tranzia] Fetching score for:', url);

    try {
        const response = await fetch(`${API_BASE}/v1/score-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, mode })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();

        // Cache the result
        scoreCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (error) {
        console.error('[Tranzia] API error:', error);
        throw error;
    }
}

// Log when extension is installed/updated
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Tranzia] Extension installed/updated:', details.reason);
});
