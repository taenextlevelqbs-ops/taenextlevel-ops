# Digital Command Center

A separate, private Next.js application for the Tae Next Level website portfolio. The eight connected repository identities are registered in `lib/registry.mjs`. Public website source is unchanged.

The mobile-first home dashboard provides Overview, Businesses, Calendar, Payments, and Alerts with phone bottom navigation, an installable web manifest and iPhone icon. Existing reporting remains at `/sites`, and connections remain at `/settings`. Coach Tae and DMV Attack payments are isolated by separate credentials and verified Stripe account IDs; no combined business revenue total is shown. Upcoming Calendly events, payment status, DMV athlete/fee records and NOVA’s existing public football health endpoint are read server-side. Administration links open the existing business tools. Tournament dates are explicitly sourced from DMV’s 2027 organization schedule.

The reporting area provides a portfolio overview, a detail page for each website, day/week/30-day/year traffic windows, previous-period visitor comparisons, provider connection status, and an authenticated persistent site registry. It uses real server-side APIs: Google Analytics Data API, GitHub Actions, Vercel, Supabase aggregate counts, Calendly, Stripe, Sentry, and scheduled HTTP uptime checks. Missing credentials, access failures, and unavailable measurements are shown as unavailable; there is no demo dataset or production auth bypass.

## Run

Node 24.5+ LTS (validated with Node 24.19). Cloud startup uses Node’s supported environment-proxy flag; TLS verification remains enabled. Each cloud task is already isolated; use this checkout without creating a worktree unless explicitly requested.

```sh
npm ci
npm run secrets:init
npm run dev -- --hostname 127.0.0.1 --port 3200
```

The secret initialization command prepares server session and scheduler secrets in ignored `.env.local`, preserving existing settings and never printing values. **Passwords are managed by Supabase Auth in a dedicated Command Center project**, separate from DMV Attack. Create the verified owner account `takwancrews@gmail.com` in that project and disable public sign-up. Follow the exact setup steps in `docs/deployment.md`.

Core production variables: `COMMAND_ORIGIN`, `COMMAND_ADMIN_EMAIL`, `COMMAND_OWNER_USER_ID` (the dedicated Supabase owner UUID), `COMMAND_DB_URL`, `COMMAND_DB_ANON_KEY`, `COMMAND_DB_SERVICE_KEY`, `COMMAND_SESSION_SECRET`, and `CRON_SECRET`. The dedicated database schema stores the website registry, aggregate daily analytics history, monitoring samples, and shared login throttling. It does not store passwords, customer records or patient data. All environments refuse sign-in until the dedicated Supabase Auth and database configuration exist.

Supabase validates the password. The server additionally requires the exact owner UUID, verified email, and configured email address before issuing an HMAC-signed owner session. Cookies are HttpOnly, SameSite Strict, Secure in production, and expire at the provider token lifetime capped at one hour. Provider access tokens are discarded. Refresh tokens are encrypted with AES-256-GCM in a Secure, HttpOnly, SameSite Strict cookie with a fixed 30-day maximum lifetime. The existing owner session renews through Supabase and rechecks the verified owner UUID and email. Tokens are never exposed to client JavaScript or retained in the registry. Rotate the session secret to immediately invalidate active dashboard sessions. There is no public registration or dashboard password reset endpoint. Manage password recovery through your dedicated Supabase Auth project.

## Connect real data

See [deployment and integration setup](docs/deployment.md) and [metric definitions](docs/metrics.md). Enter site-level IDs through **Connections** after the persistent database is connected. Credentials stay in encrypted server-side deployment environment settings. The registry saves only metadata, never credentials.

Royal Brand, Maverick, and the new Command Center need their confirmed public URLs. Other URLs come from the selected repositories' metadata; confirm production canonical URLs during connection. The application does not guess domains. Add new sites through Connections. New sites get an environment prefix derived from their ID, making database, payments and bookings credentials independent.

Existing histories can be read only where providers retain them. New tracking cannot reconstruct prior visits. Tracking scripts have not been injected into public sites without actual GA4 measurement IDs and consent settings. See `docs/tracking.md` for the remaining prerequisites.

## Verify

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:browser
```

Unit/contract tests exercise authentication, unavailable-data semantics, provider response handling, pagination, date boundaries, database-count privacy and private-network denial. PostgreSQL tests execute the schema in PGlite, including RLS and login throttling. Browser tests use an explicitly loaded Supabase API fixture, test-only credentials and a separate server, cover redirects, login/logout, all eight website identities, period selection, registry errors, runtime errors and 320/390/768/1440px layouts. Browser tests do not establish that external credentials or provider permissions work.

The browser executable defaults to `/usr/bin/chromium`; override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Run build and browser checks separately to avoid concurrent writes to `.next`.

## Deploy

Deploy this repository as a separate `digital-command-center` Vercel project under the existing **taenextlevelqbs-ops** team with the repository root as root directory, the Next.js framework preset, and Node 24. Configure encrypted production variables **before** publishing the production dashboard. Set your custom/private dashboard domain, then set `COMMAND_ORIGIN` to that exact origin.

`vercel.json` registers a daily uptime and previous-day analytics snapshot cron at 12:00 UTC, compatible with the free Vercel schedule limits. Vercel sends `CRON_SECRET` as bearer authorization. For more frequent uptime checks use a supported Vercel paid plan or an authenticated external scheduler; daily samples are not continuous uptime. `/api/health` reveals only service identity/liveness. Dashboard pages and the registry API require an owner session. Keep Vercel deployment protection enabled where available.

The deployment preflight (`npm run preflight`) checks required names and the dedicated database tables without printing values.

No Supabase migrations, live emails, bookings, payments, or public-site redeployments are performed by a local build or the test suite.
