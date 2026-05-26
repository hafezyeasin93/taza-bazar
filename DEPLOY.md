# Render Deploy — Root JSON Database Build

This emergency build avoids Render persistent disk mounts entirely.

## Important

Do **not** set `DATA_DIR=/var/data`.
Do **not** rely on `/var/data`.

The app always uses this root project file:

```text
./data/db.json
```

The committed `data/db.json` contains the default production configuration for both product cards, payment numbers, owner/address branding, blocked COD, and secure admin password hash.

## Render settings

Use the included `render.yaml`:

```yaml
plan: free
buildCommand: npm install
startCommand: npm start
```

No disk mount is required.

## Admin

```text
Username: admin
Password: Tazabazar@2026
```

The password is verified server-side against a scrypt hash.
