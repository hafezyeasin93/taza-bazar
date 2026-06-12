let hlsInstance = null;

function switchPage(pageId, navElement) {
    const pages = document.querySelectorAll('.app-page');
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) { targetPage.classList.add('active'); }
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    navElement.classList.add('active');
}

function playStream(streamUrl, channelName, channelDesc) {
    const video = document.getElementById('live-player');
    document.getElementById('now-playing-title').innerText = channelName;
    document.getElementById('now-playing-desc').innerText = channelDesc;
    const homeBtn = document.getElementById('btn-home');
    switchPage('home-page', homeBtn);

    if (hlsInstance) { hlsInstance.destroy(); }

    if (Hls.isSupported()) {
        hlsInstance = new Hls({ maxBufferSize: 30 * 1000 * 1000, maxBufferLength: 15 });
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() { 
            video.play().catch(e => console.log("Autoplay blocked", e)); 
        });
        hlsInstance.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: hlsInstance.startLoad(); break;
                    case Hls.ErrorTypes.MEDIA_ERROR: hlsInstance.recoverMediaError(); break;
                    default: break;
                }
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', function() { video.play(); });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    playStream('https://moctobpl.com/live/t-sports/playlist.m3u8', 'T-Sports Live', 'বাংলাদেশ বনাম অস্ট্রেলিয়া লাইভ ম্যাচ');
});
