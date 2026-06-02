# BrodieDash

A self-contained futuristic dashboard prototype with OpenRouter AI, finance tracking, a calendar-style task board, and a feature roadmap.

## Run

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
For a deployed production version, move OpenRouter calls to a backend or serverless route and use environment variables.

The model dropdown is intentionally limited to GPT 5.5, Claude Opus 4.8, and Gemini 3.1 Pro.

## Accounts

- Admin login: `brodiebulman` / `Brodie14!$`
- New users can request access with a username and password.
- Pending requests appear in the admin console for approval or denial.
- This is a static local prototype, so requests and approvals are stored in browser `localStorage`.

## Next Build Options

- Add a backend proxy so the OpenRouter key is never exposed in browser storage.
- Connect live finance data through Polygon, Finnhub, Alpha Vantage, Twelve Data, or another quote provider.
- Add recurring calendar tasks, ICS export, drag scheduling, and AI prioritization.
- Add user profiles, authentication, cloud sync, and encrypted storage.
