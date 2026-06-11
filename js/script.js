document.addEventListener('DOMContentLoaded', () => {
    let appData = {};
    const video = document.getElementById('video-player');
    let hls = new Hls();

    // GLOBAL NAVIGATION SYSTEM
    window.navigateTo = (pageId) => {
        console.log(`Navigating to: ${pageId}`);
        
        // 1. Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // 2. Show target page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        } else {
            console.error(`Page ${pageId} not found`);
        }

        // 3. Update Bottom Nav UI
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            }
        });

        // 4. Stop video when leaving stream page
        if (pageId !== 'stream-section') {
            video.pause();
        }
    };

    // INITIALIZE NAV EVENT LISTENERS
    function initNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                const page = item.getAttribute('data-page');
                navigateTo(page);
            };
        });
    }

    async function loadConfig() {
        try {
            const response = await fetch('config.json');
            appData = await response.json();
            renderHome();
            renderChannels();
        } catch (error) {
            console.error("Configuration load error:", error);
            document.getElementById('fixture-list').innerHTML = '<div class="error">Sync failed. Please refresh.</div>';
        }
    }

    function renderHome() {
        // Cricket Live Section
        const cricketContainer = document.getElementById('cricket-list');
        cricketContainer.innerHTML = '';
        appData.cricket.forEach(c => {
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

        // World Cup Fixtures
        const fixtureList = document.getElementById('fixture-list');
        fixtureList.innerHTML = '';
        appData.matches.forEach(m => {
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
        
        for (const [category, channels] of Object.entries(appData.channels)) {
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

    function openStream(title, group, url) {
        if (!url) {
            alert("This stream is temporarily unavailable. Please check back soon.");
            return;
        }
        
        navigateTo('stream-section');
        document.getElementById('current-match-title').innerText = title;
        document.getElementById('current-match-group').innerText = group;
        
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

    // Player Buttons
    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Quality logic would go here (switching HLS levels)
        };
    });

    document.getElementById('pip-btn').onclick = async () => {
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else await video.requestPictureInPicture();
        } catch (e) { alert("PiP not supported on this device"); }
    };

    document.getElementById('fullscreen-btn').onclick = () => {
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    };

    // Bootstrap App
    initNav();
    loadConfig();
});
