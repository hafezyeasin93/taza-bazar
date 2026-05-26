# tazabazar.bd.com Premium E-commerce

Emergency Render-free-tier build using a root local JSON database committed with the project.

## Root database strategy

The server intentionally does **not** use `/var/data` or `DATA_DIR`.
It always boots from:

```text
./data/db.json
```

This file is pre-populated with:

- খাগড়াছড়ির প্রিমিয়াম আম (Premium Mango)
- খাগড়াছড়ির প্রিমিয়াম চায়না-৩ লিচু (Premium China-3 Litchi)
- bKash Personal: `01891548610`
- Nagad Personal: `01629518850`
- COD disabled/server-blocked
- Owner: `মোঃ ইয়াসিন (MD Yeasin)`
- Address: `Ramgarh, Khagrachhari`
- Trust banner text

## Admin credentials

```text
Username: admin
Password: Tazabazar@2026
```

The admin password is stored in `data/db.json` as a secure scrypt hash, not plain text.

## Session

Admin login uses a signed 30-day HttpOnly cookie.

## Run locally

```bash
npm install
npm start
```
