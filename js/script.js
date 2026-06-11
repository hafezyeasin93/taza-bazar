document.addEventListener('DOMContentLoaded', () => {
    let appData = {};
    const video = document.getElementById('video-player');
    let hls = null;

    const pageMap = {
        'home': document.getElementById('home-section'),
        'channels': document.getElementById('channels-section'),
        'settings': document.getElementById('settings-section'),
        'stream': document.getElementById('stream-section')
    };

    const navMap = {
        'home': document.getElementById('btn-nav-home'),
        'channels': document.getElementById('btn-nav-channels'),
        'settings': document.getElementById('btn-nav-settings')
    };

    // 1. BULLETPROOF ROUTER
    function router(pageId) {
        console.log(`Routing to: ${pageId}`);
        
        // Remove active class from all pages and nav items
        Object.values(pageMap).forEach(p => p.classList.remove('active'));
        Object.values(navMap).forEach(n => n.classList.remove('active'));

        // Activate target page
        if (pageMap[pageId]) {
            pageMap[pageId].classList.add('active');
        }

        // Activate target nav item
        if (navMap[pageId]) {
            navMap[pageId].classList.add('active');
        }

        // Stop video if leaving stream page
        if (pageId !== 'stream') {
            if (video) video.pause();
        }
    }

    // Bind Navigation
    document.getElementById('btn-nav-home').onclick = () => router('home');
    document.getElementById('btn-nav-channels').onclick = () => router('channels');
    document.getElementById('btn-nav-settings').onclick = () => router('settings');
    document.getElementById('btn-back-home').onclick = () => router('home');

    // 2. NATIVE HLS INITIALIZATION
    function playStream(url, title, category) {
        if (!url) {
            alert("Stream source is currently unavailable.");
            return;
        }

        router('stream');
        document.getElementById('current-match-title').innerText = title;
        document.getElementById('current-match-group').innerText = category;

        if (hls) {
            hls.destroy();
        }

        if (Hls.isSupported()) {
            hls = new Hls({
                maxBufferSize: 30 * 1000 * 1000,
                maxBufferLength: 30,
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => console.log("User interaction required for playback"));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.play();
        } else {
            alert("HLS streaming is not supported on this browser.");
        }
    }

    // 3. DYNAMIC DATA ENGINE
    async function initApp() {
        try {
            const response = await fetch('config.json');
            appData = await response.json();
            
            // Render Cricket
            const cricketList = document.getElementById('cricket-list');
            cricketList.innerHTML = '';
            appData.cricket.forEach(c => {
                const card = document.createElement('div');
                card.className = 'cricket-card';
                card.innerHTML = `<h4>${c.match}</h4><span class="tournament">${c.tournament}</span><span class="score">${c.score}</span><div class="live-tag" style="display:inline-block">${c.status}</div>`;
                card.onclick = () => playStream(c.stream, c.match, "Cricket Live");
                cricketList.appendChild(card);
            });

            // Render Fixtures
            const fixtureList = document.getElementById('fixture-list');
            fixtureList.innerHTML = '';
            appData.matches.forEach(m => {
                const card = document.createElement('div');
                card.className = 'match-card';
                card.innerHTML = `
                    <div class="match-header"><span>${m.group}</span><span>${m.status === 'live' ? '<span class="live-tag">LIVE</span>' : 'Upcoming'}</span></div>
                    <div class="match-main">
                        <div class="team"><img src="${m.flagA}"><span>${m.teamA}</span></div>
                        <div class="match-status"><span class="time">${m.status === 'live' ? 'LIVE' : 'Coming Soon'}</span></div>
                        <div class="team"><img src="${m.flagB}"><span>${m.teamB}</span></div>
                    </div>
                `;
                card.onclick = () => playStream(m.streams.HD, `${m.teamA} vs ${m.teamB}`, m.group);
                fixtureList.appendChild(card);
            });

            // Render Channels
            const chanContainer = document.getElementById('channels-container');
            chanContainer.innerHTML = '';
            for (const [cat, list] of Object.entries(appData.channels)) {
                const catDiv = document.createElement('div');
                catDiv.className = 'channel-cat';
                catDiv.innerHTML = `<div class="cat-title">${cat}</div>`;
                const grid = document.createElement('div');
                grid.className = 'channel-grid';
                list.forEach(ch => {
                    const item = document.createElement('div');
                    item.className = 'channel-item';
                    item.innerHTML = `<img src="${ch.logo}"><span>${ch.name}</span>`;
                    item.onclick = () => playStream(ch.url, ch.name, cat);
                    grid.appendChild(item);
                });
                catDiv.appendChild(grid);
                chanContainer.appendChild(catDiv);
            }
        } catch (e) {
            console.error("Init error:", e);
        }
    }

    // Utils
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

    initApp();
});
