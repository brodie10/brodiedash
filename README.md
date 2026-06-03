# BrodieDash

A self-contained futuristic dashboard prototype with OpenRouter AI, finance tracking, a calendar-style task board, and a feature roadmap.

## Run - Please

Open `index.html` in a browser.

Static route pages are available at:

- `ai/index.html`
- `finance/index.html`
- `calendar/index.html`
- `roadmap/index.html`
- `systems/index.html`
- `admin/index.html`

On a deployed domain, these map to paths such as `/ai/`, `/finance/`, and `/admin/`.

## OpenRouter

1. Copy `config.example.js` to `config.local.js`.
2. Set `openRouterApiKey` in `config.local.js`.
3. Refresh models or choose from the model dropdown.
4. Run a dashboard-aware command.

`config.local.js` is ignored by Git so the local key is not pushed to GitHub.
On Vercel, the included serverless routes use `OPENROUTER_API_KEY` instead.

## Vercel

Set this environment variable in Vercel:

- `OPENROUTER_API_KEY`

The deployed app uses the serverless routes in `api/` so the browser does not need `config.local.js`.

The model dropdown is intentionally limited to GPT 5.5, Claude Opus 4.8, and Gemini 3.1 Pro.

## Vercel Database

The Vercel Postgres/Neon database is used through serverless API routes, not directly from browser JavaScript.
After connecting the database to the Vercel project, confirm that Vercel added one of these environment variables:

- `POSTGRES_URL`
- `DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

Recommended additional Vercel environment variables:

- `BRODIEDASH_SESSION_SECRET` - any long random string for signing login cookies.
- `BRODIEDASH_ADMIN_USERNAME` - optional, defaults to `brodiebulman`.
- `BRODIEDASH_ADMIN_PASSWORD` - recommended; otherwise the prototype password remains active.

The first successful API call creates these tables automatically:

- `brodiedash_users`
- `brodiedash_dashboard_state`

When the database routes are available, BrodieDash syncs login requests, admin approvals, positions, tasks, and roadmap pins to Vercel Postgres. If the API is unavailable locally, the app falls back to browser `localStorage`.

## Accounts

- Admin login: `brodiebulman` / `Brodie14!$`
- New users can request access with a username and password.
- Pending requests appear in the admin console for approval or denial.
- Admins can manage each user's display name, app role, profile notes, last-login metadata, and module permissions.
- Local file usage still stores requests and approvals in browser `localStorage`; Vercel deployments use the database routes when configured.
- Finance positions are scoped per approved username in browser `localStorage`.
- The AI command layer can extract investment holdings from a user's prompt and update that user's finance tab.

## Next Build Options

- Add a backend proxy so the OpenRouter key is never exposed in browser storage.
- Connect live finance data through Polygon, Finnhub, Alpha Vantage, Twelve Data, or another quote provider.
- Add recurring calendar tasks, ICS export, drag scheduling, and AI prioritization.
- Add user profiles, authentication, cloud sync, and encrypted storage.
