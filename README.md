# Personal Hiring Radar

A single-user desk for watching company careers pages. You enter a field in your own words and a company website. The app finds the careers page, reads public job feeds, and keeps roles whose responsibilities match that field.

## Run

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000.

Jobs and your profile are stored in `data/radar.json`.

## Daily check

While this app is running, it checks every company at 4:00 PM India time. If new matching roles appeared, it emails the address saved on your search. Each note links back to this desk, where you apply.

## Email

Your address is entered in the app, on the last setup step or under your search. Copy `.env.example` to `.env.local` and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` so the desk has a mailbox to send from. Restart after saving that file.

**Email me these roles** sends every open role that fits your search. The 4:00 PM note sends only roles that newly appeared.
