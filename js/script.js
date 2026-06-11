document.addEventListener('DOMContentLoaded', () => {
    let matchData = [];
    let currentMatch = null;
    const video = document.getElementById('video-player');
    let hls = new Hls();

    // Load Configuration
    async function loadConfig() {
        try {
            const response = await fetch('config.json');
            const data = await response.json();
            matchData = data.matches;
            renderFixtures();
        } catch (error) {
            console.error("Error loading config:", error);
            document.getElementById('fixture-list').innerHTML = '<div class="error">Failed to load matches. Please try again.</div>';
        }
    }

    // Render Fixture List
    function renderFixtures() {
        const container = document.getElementById('fixture-list');
        container.innerHTML = '';

        matchData.forEach(match => {
            const card = document.createElement('div');
            card.className = 'match-card';
            
            const isLive = match.status === 'live';
            const timeStr = isLive ? 'LIVE' : formatTime(match.startTime);

            card.innerHTML = `
                <div class="match-header">
                    <span>${match.group}</span>
                    <span>${isLive ? '<span class="live-badge">LIVE</span>' : 'Upcoming'}</span>
                </div>
                <div class="match-main">
                    <div class="team">
                        <img src="${match.flagA}" alt="${match.teamA}">
                        <span>${match.teamA}</span>
                    </div>
                    <div class="match-status">
                        <div class="time">${timeStr}</div>
                    </div>
                    <div class="team">
                        <img src="${match.flagB}" alt="${match.teamB}">
                        <span>${match.teamB}</span>
                    </div>
                </div>
            `;

            card.onclick = () => openStream(match);
            container.appendChild(card);
        });
    }

    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Navigation Logic
    window.navigateTo = (pageId) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if(item.getAttribute('data-page') === pageId) item.classList.add('active');
        });

        if (pageId !== 'stream-section') {
            video.pause();
        }
    };

    // Video Player Logic
    function openStream(match) {
        currentMatch = match;
        navigateTo('stream-section');
        
        document.getElementById('current-match-title').innerText = `${match.teamA} vs ${match.teamB}`;
        document.getElementById('current-match-group').innerText = match.group;
        
        // Set initial quality to HD
        switchQuality('HD');
    }

    window.switchQuality = (quality) => {
        if (!currentMatch) return;
        
        const streamUrl = currentMatch.streams[quality];
        if (!streamUrl) {
            alert("This quality is currently unavailable.");
            return;
        }

        // Update active button UI
        document.querySelectorAll('.q-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.getAttribute('data-quality') === quality) btn.classList.add('active');
        });

        // Load HLS stream
        if (Hls.isSupported()) {
            hls.destroy();
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play();
        }
    };

    // Bind Quality Buttons
    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => switchQuality(btn.getAttribute('data-quality'));
    });

    // PiP and Fullscreen
    document.getElementById('pip-btn').onclick = async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (err) {
            alert("PiP not supported in this browser.");
        }
    };

    document.getElementById('fullscreen-btn').onclick = () => {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        }
    };

    loadConfig();
});
