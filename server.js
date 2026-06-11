/**
 * WorldCup 2026 - Backend Server Template
 * 
 * To run this:
 * 1. npm init -y
 * 2. npm install express body-parser fs-extra firebase-admin
 * 3. node server.js
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = './config.json';

// Firebase Admin Setup (Required for Push Notifications)
// You must provide your own serviceAccountKey.json from Firebase Console
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
} catch (e) {
    console.log("Firebase serviceAccountKey.json not found. Push notifications will be disabled.");
}

app.use(bodyParser.json());
app.use(express.static('public')); // Serve the frontend from a 'public' folder

// API: Get Match Configuration
app.get('/api/config', async (req, res) => {
    try {
        const config = await fs.readJson(CONFIG_PATH);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: "Failed to read config" });
    }
});

// API: Update Match Configuration
app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await fs.writeJson(CONFIG_PATH, newConfig, { spaces: 2 });
        res.json({ success: true, message: "Configuration updated!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update config" });
    }
});

// API: Send Push Notification
app.post('/api/notify', async (req, res) => {
    const { title, body, topic = 'all_users' } = req.body;

    const message = {
        notification: {
            title: title,
            body: body
        },
        topic: topic
    };

    try {
        const response = await admin.messaging().send(message);
        res.json({ success: true, message: `Notification sent: ${response}` });
    } catch (err) {
        res.status(500).json({ error: "Push notification failed", details: err });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
