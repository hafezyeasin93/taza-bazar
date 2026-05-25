# tazabazar.bd.com Premium E-commerce

A secure premium fruit e-commerce site for Ramgarh, Khagrachhari with two product categories:

- খাগড়াছড়ির প্রিমিয়াম আম
- খাগড়াছড়ির প্রিমিয়াম চায়না-৩ লিচু

## Production architecture

- Express.js server
- Persistent JSON database at `DATA_DIR` (`/var/data` on Render)
- Product images stored under `/var/data/uploads`
- Admin password hashed with Node.js `crypto.scryptSync`
- 30-day signed HttpOnly admin session cookie
- Manual advance payment only: bKash and Nagad
- COD is disabled and server-blocked

## Admin credentials

```text
Username: admin
Password: Tazabazar@2026
```

Change the password through the Admin panel after deployment if desired.

## Payment numbers

```text
bKash Personal: 01891548610
Nagad Personal: 01629518850
```

## Render persistence

The included `render.yaml` mounts a persistent disk:

```yaml
mountPath: /var/data
DATA_DIR: /var/data
```

All orders, product edits, image uploads, slider settings, and logs are written to `/var/data/tazabazar-db.json` and `/var/data/uploads`, so data survives server sleep/restarts and redeploys when Render persistent disk is active.

## Run locally

```bash
npm install
npm start
```

Optional local persistent data path:

```bash
DATA_DIR=/tmp/tazabazar-data npm start
```
