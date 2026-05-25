# Render Deployment Guide — tazabazar.bd.com

This build requires persistent storage for production data.

## Required Render settings

Use the included `render.yaml` Blueprint or configure manually:

```yaml
services:
  - type: web
    name: taza-bazar
    env: node
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    disk:
      name: taza-bazar-data
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: DATA_DIR
        value: /var/data
      - key: SESSION_SECRET
        generateValue: true
```

## Why this is critical

All dynamic production data is written to:

```text
/var/data/tazabazar-db.json
/var/data/uploads
/var/data/activity.log
```

Without a Render persistent disk mounted at `/var/data`, changes can reset on cold starts or redeploys.

## Admin login

```text
Username: admin
Password: Tazabazar@2026
```

The password is stored as a secure scrypt hash, not plain text.
