# Personal Hiring Radar

A desk for watching company careers pages. You enter a field in your own words and a company website. The app finds the careers page, reads public job feeds, and keeps roles whose responsibilities match that field.

Each account has its own companies, roles, and notes.

## Run locally

```bash
npm install
npm test
```

Copy `.env.example` to `.env.local` and fill it in, then:

```bash
npm run dev
```

Open http://localhost:3000 and create an account. The local file `data/radar.json` is not read.

## Accounts

Sign up with email and password, or with Google. A Google sign-in uses the same account when that Google address already has a desk. Password reset emails use Resend.

Create the Google OAuth client with this redirect URI:

`{BETTER_AUTH_URL}/api/auth/callback/google`

## Email

Notes and password resets go out through Resend over HTTPS. Set `RESEND_API_KEY` and `EMAIL_FROM`. `EMAIL_FROM` has to be on a domain you have verified in Resend, or Resend will refuse the send.

**Send the Role List** sends every open role that fits your search. The 4:00 PM note sends only roles that newly appeared.

## Daily check

At 4:00 PM India time a scheduled job wakes the app and checks every account. If new matching roles appeared, it emails the address saved on that search.

The schedule lives in `.github/workflows/daily-check.yml` (10:30 UTC). Add repository secrets `APP_URL` and `CRON_SECRET`. `CRON_SECRET` is the same value set on the server. The workflow retries until the service answers, because a free Render instance can take about a minute to wake.

## Host on Render

`render.yaml` describes a free Node web service. It has no disk. Accounts and desks live in Neon Postgres (`DATABASE_URL`).

1. Create a Neon project and copy its connection string into `DATABASE_URL`.
2. Create a Resend API key and verify the domain used in `EMAIL_FROM`.
3. Generate `BETTER_AUTH_SECRET` (`npx auth secret`) and a long random `CRON_SECRET`.
4. Push this repo to GitHub. In Render, create a Blueprint from `render.yaml` and choose the free plan.
5. Set `APP_URL` and `BETTER_AUTH_URL` to the service URL, with no trailing slash, plus the other secrets from `.env.example`.
6. In Google Cloud, set the OAuth redirect URI to `https://<your-service>.onrender.com/api/auth/callback/google`.
7. Add GitHub Actions secrets `APP_URL` and `CRON_SECRET`.
8. Open the service URL, create an account, and confirm a second account cannot see the first desk.

A free Render web service sleeps after 15 minutes without visitors and has 750 awake hours a month. Ordinary visits plus the daily check stay inside that. Leaving the desk open all month can use the allowance up, and Render then suspends the service until the next month.
