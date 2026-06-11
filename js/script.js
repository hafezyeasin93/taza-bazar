document.addEventListener('DOMContentLoaded', () => {
    let appData = {};
    const video = document.getElementById('video-player');
    let hls = null;

    // 1. COMPLETELY REWRITTEN NAVIGATION ENGINE
    const pages = {
        home: document.getElementById('home-section'),
        channels: document.getElementById('channels-section'),
        settings: document.getElementById('settings-section'),
        stream: document.getElementById('stream-section')
    };

    const navItems = {
        home: document.getElementById('nav-home'),
        channels: document.getElementById('nav-channels'),
        settings: document.getElementById('nav-settings')
    };

    function navigateTo(pageId) {
        console.log(`Switching to page: ${pageId}`);
        
        // Hide all pages and remove active class from nav
        Object.values(pages).forEach(page => page.classList.remove('active'));
        Object.values(navItems).forEach(item => item.classList.remove('active'));

        // Show current page
        if (pages[pageId]) {
            pages[pageId].classList.add('active');
        }

        // Highlight corresponding nav item
        if (navItems[pageId]) {
            navItems[pageId].classList.add('active');
        }

        // Stop playback when leaving the stream page
        if (pageId !== 'stream') {
            if (video) video.pause();
        }
    }

    // Bind navigation buttons explicitly
    document.getElementById('nav-home').onclick = () => navigateTo('home');
    document.getElementById('nav-channels').onclick = () => navigateTo('channels');
    document.getElementById('nav-settings').onclick = () => navigateTo('settings');
    document.getElementById('back-to-home').onclick = () => navigateTo('home');

    // 2. ROBUST STREAMING ENGINE (Hls.js)
    function playHls(url) {
        if (!url) return;
        
        console.log(`Attempting to load stream: ${url}`);
        
        if (hls) {
            hls.destroy();
        }

        if (Hls.isSupported()) {
            hls = new Hls({
                debug: false,
                enableWorker: true,
                lowBufferWatchdogPeriod: 2,
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log("Manifest parsed, playing...");
                video.play().catch(e => console.log("Autoplay blocked, waiting for user interaction."));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error(`HLS Fatal Error: ${data.type}`);
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari/iOS)
            video.src = url;
            video.play();
        } else {
            alert("Your browser does not support HLS streaming.");
        }
    }

    function openStream(title, group, url) {
        if (!url) {
            alert("Stream link unavailable at the moment.");
            return;
        }
        navigateTo('stream');
        document.getElementById('current-match-title').innerText = title;
        document.getElementById('current-match-group').innerText = group;
        playHls(url);
    }

    // 3. DYNAMIC CONTENT RENDERING
    async function loadConfig() {
        try {
            const response = await fetch('config.json');
            appData = await response.json();
            renderHome();
            renderChannels();
        } catch (error) {
            console.error("Config error:", error);
        }
    }

    function renderHome() {
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
                item.innerHTML = `<img src="${ch.logo}" alt="${ch.name}"><span>${ch.name}</span>`;
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

    // Player UI controls
    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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
