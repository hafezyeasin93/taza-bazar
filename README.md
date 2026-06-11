# 🏆 WorldCup 2026 Live Streaming App

A premium IPTV Web-App designed for the 2026 FIFA World Cup. This project is built as a high-performance frontend ready for Android WebView/Cordova deployment.

## 🚀 Features
- **Premium Dark UI:** Modern sports-themed interface with Neon Green and Gold accents.
- **Live Match Center:** Dynamic fixture list with live badges and status updates.
- **Advanced Video Player:** Integrated `Hls.js` for `.m3u8` streaming with quality toggles (HD, LIVE 1, SD).
- **Android Ready:** Optimized for mobile views, supporting Picture-in-Picture (PiP) and Fullscreen.
- **Admin Control:** Simple interface for managing match schedules and streaming links.
- **Push Notifications:** Backend template for Firebase Cloud Messaging (FCM) integration.

## 📂 Project Structure
- `/css`: Custom premium styles.
- `/js`: Frontend logic and HLS player integration.
- `/admin`: Web-based administration panel.
- `config.json`: Centralized match and stream configuration.
- `server.js`: Node.js backend for dynamic updates and push notifications.

## 🛠️ Installation & Deployment

### 1. Local Development
1. Open `index.html` in any modern browser.
2. To use the backend, run:
   ```bash
   npm install express body-parser fs-extra firebase-admin
   node server.js
   ```

### 2. Android Deployment (Cordova/Capacitor)
To turn this into a native Android App:
1. Install Cordova: `npm install -g cordova`
2. Create a project: `cordova create worldcup_app com.worldcup.live WorldCupLive`
3. Copy the contents of the `worldcup_app` folder into the `www` folder of the Cordova project.
4. Add Android platform: `cordova platform add android`
5. Build the APK: `cordova build android`

### 3. WebView Wrapper (Android Studio)
If using a native Android Studio WebView:
1. Place the web files in the `assets` folder.
2. Use `webView.loadUrl("file:///android_asset/index.html");`
3. Enable JavaScript: `webView.getSettings().setJavaScriptEnabled(true);`
4. Enable DomStorage: `webView.getSettings().setDomStorageEnabled(true);`

## 📡 Stream Configuration
Update `config.json` to change match details:
```json
{
  "teamA": "Team Name",
  "teamB": "Team Name",
  "startTime": "ISO-8601-Date",
  "status": "live | upcoming",
  "streams": {
    "HD": "https://link-to-hd.m3u8",
    "LIVE1": "https://link-to-live1.m3u8",
    "SD": "https://link-to-sd.m3u8"
  }
}
```

## 🔔 Push Notifications
1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Generate a `serviceAccountKey.json` and place it in the server root.
3. Use the `/api/notify` endpoint to send alerts to users.
