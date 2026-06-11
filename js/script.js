document.addEventListener('DOMContentLoaded', () => {
    let matchData = [];
    let currentMatch = null;
    const video = document.getElementById('video-player');
    let hls = new Hls();

    async function loadConfig() {
        try {
            const response = await fetch('config.json');
            const data = await response.json();
            matchData = data;
            renderHome();
            renderChannels();
        } catch (error) {
            console.error("Config load error:", error);
            document.getElementById('fixture-list').innerHTML = '<div class="error">Failed to sync with server.</div>';
        }
    }

    function renderHome() {
        // 1. Render Cricket
        const cricketContainer = document.getElementById('cricket-list');
        cricketContainer.innerHTML = '';
        matchData.cricket.forEach(c => {
            const card = document.createElement('div');
            card.className = 'cricket-card';
            card.innerHTML = `
                <h4>${c.match}</h4>
                <span class="tournament">${c.tournament}</span>
                <span class="score">${c.score}</span>
                <div class="live-tag" style="display:inline-block">${c.status}</div>
            `;
            card.onclick = () => openStream(c.match, "Cricket Live", c.stream);
            cricketContainer.appendChild(card);
        });

        // 2. Render Fixtures
        const fixtureList = document.getElementById('fixture-list');
        fixtureList.innerHTML = '';
        matchData.matches.forEach(m => {
            const isLive = m.status === 'live';
            const card = document.createElement('div');
            card.className = 'match-card';
            card.innerHTML = `
                <div class="match-header">
                    <span>${m.group}</span>
                    <span>${isLive ? '<span class="live-tag">LIVE</span>' : 'Upcoming'}</span>
                </div>
                <div class="match-main">
                    <div class="team">
                        <img src="${m.flagA}" alt="${m.teamA}">
                        <span>${m.teamA}</span>
                    </div>
                    <div class="match-status">
                        <span class="time">${isLive ? 'LIVE' : formatTime(m.startTime)}</span>
                    </div>
                    <div class="team">
                        <img src="${m.flagB}" alt="${m.teamB}">
                        <span>${m.teamB}</span>
                    </div>
                </div>
            `;
            card.onclick = () => openStream(`${m.teamA} vs ${m.teamB}`, m.group, m.streams.HD);
            fixtureList.appendChild(card);
        });
    }

    function renderChannels() {
        const container = document.getElementById('channels-container');
        container.innerHTML = '';
        
        for (const [category, channels] of Object.entries(matchData.channels)) {
            const catDiv = document.createElement('div');
            catDiv.className = 'channel-cat';
            catDiv.innerHTML = `<div class="cat-title">${category}</div>`;
            
            const grid = document.createElement('div');
            grid.className = 'channel-grid';
            
            channels.forEach(ch => {
                const item = document.createElement('div');
                item.className = 'channel-item';
                item.innerHTML = `
                    <img src="${ch.logo}" alt="${ch.name}">
                    <span>${ch.name}</span>
                `;
                item.onclick = () => openStream(ch.name, category, ch.url);
                grid.appendChild(item);
            });
            
            catDiv.appendChild(grid);
            container.appendChild(catDiv);
        }
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    window.navigateTo = (pageId) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if(item.dataset.page === pageId) item.classList.add('active');
        });

        if (pageId !== 'stream-section') video.pause();
    };

    function openStream(title, group, url) {
        navigateTo('stream-section');
        document.getElementById('current-match-title').innerText = title;
        document.getElementById('current-match-group').innerText = group;
        
        if (!url) {
            alert("Stream link is currently unavailable. Please try again later.");
            navigateTo('home-section');
            return;
        }
        
        playHls(url);
    }

    function playHls(url) {
        if (Hls.isSupported()) {
            hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.play();
        }
    }

    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // For this demo, we use the same stream, but in production, 
            // you would fetch the specific quality URL from config.json
        };
    });

    document.getElementById('pip-btn').onclick = async () => {
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else await video.requestPictureInPicture();
        } catch (e) { alert("PiP not supported"); }
    };

    document.getElementById('fullscreen-btn').onclick = () => {
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    };

    loadConfig();
});
