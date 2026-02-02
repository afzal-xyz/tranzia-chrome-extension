// Tranzia Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const scoreContainer = document.getElementById('score-container');
    const scoreValue = document.getElementById('score-value');
    const scoreLabel = document.getElementById('score-label');
    const refreshBtn = document.getElementById('refresh-btn');
    const openTranziaBtn = document.getElementById('open-tranzia-btn');

    // Check current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && isGoogleMapsDirections(tab.url)) {
        // Update Open Tranzia button to pass the current URL
        openTranziaBtn.href = `https://www.tranzia.com?url=${encodeURIComponent(tab.url)}`;

        statusIcon.textContent = '🗺️';
        statusText.textContent = 'Analyzing route safety...';

        // Request score from background
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getScore',
                url: tab.url,
                mode: 'driving'
            });

            if (response.error) {
                statusIcon.textContent = '⚠️';
                statusText.textContent = response.error;
            } else if (response.routes && response.routes.length > 0) {
                const route = response.routes[0];
                // API returns 'label' not 'risk_label'
                displayScore(route.score, route.label);
            } else {
                statusIcon.textContent = '❓';
                statusText.textContent = 'Could not analyze this route';
            }
        } catch (error) {
            statusIcon.textContent = '❌';
            statusText.textContent = 'Error: ' + error.message;
        }
    } else {
        statusIcon.textContent = '📍';
        statusText.textContent = 'Open Google Maps directions to see safety scores';
    }

    // Refresh button
    refreshBtn.addEventListener('click', async () => {
        // Clear cache and reload
        await chrome.runtime.sendMessage({ action: 'clearCache' });

        // Reload the popup
        window.location.reload();
    });

    function isGoogleMapsDirections(url) {
        return url.includes('google.com/maps') &&
            (url.includes('/dir/') || url.includes('dir='));
    }

    function displayScore(score, label) {
        document.getElementById('status-container').style.display = 'none';
        scoreContainer.classList.remove('hidden');

        scoreValue.textContent = score.toFixed(1);
        scoreLabel.textContent = label || getRiskLabel(score);

        // Apply color class
        if (score >= 7) {
            scoreLabel.className = 'score-label low-risk';
        } else if (score >= 5) {
            scoreLabel.className = 'score-label moderate-risk';
        } else {
            scoreLabel.className = 'score-label high-risk';
        }
    }

    function getRiskLabel(score) {
        if (score >= 7) return 'Low Risk';
        if (score >= 5) return 'Moderate Risk';
        return 'High Risk';
    }
});
