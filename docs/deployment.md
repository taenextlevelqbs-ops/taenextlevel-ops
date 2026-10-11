# Production connection checklist

## Exact steps: dedicated Supabase project

1. Sign in to [Supabase Dashboard](https://supabase.com/dashboard) using the account/organization you want to own the private Command Center. Choose **New project**. Name it **crestlane-command-center**; select the owner organization and a region near your users. Set and securely save its database password. This is a new project, not DMV Attack.
2. Once the project is provisioned, open **SQL Editor → New query**. Paste the complete `database/schema.sql` from this repository and execute it. It creates four protected tables plus the shared login throttle function. Verify `command_sites`, `command_daily_metrics`, `command_uptime`, and `command_auth_limits` exist. The script has been verified in PostgreSQL-compatible PGlite but has not been applied to a live account.
3. Open **Authentication → Users → Add user → Create new user**. Create **takwancrews@gmail.com**, set a strong private password directly in Supabase, and confirm the email using Supabase's confirmation/invitation flow (or mark it confirmed only after verifying ownership). Copy this user's **UUID** for `COMMAND_OWNER_USER_ID`.
4. In **Authentication → Sign In / Providers**, enable Email/password and disable **Allow new users to sign up**. The Command Center has no public sign-up route. Keep password recovery in this owner-controlled project. For recovery/invite links, configure Supabase's allowed site/redirect URLs for the actual dashboard domain; complete its password setup using Supabase's documented flow rather than sending passwords in chat.
5. From project **Settings → API / API Keys**, obtain the **Project URL**, **anon/publishable key**, and **service_role key** for server-side use. Use the legacy `service_role` JWT API key for `COMMAND_DB_SERVICE_KEY` so authenticated PostgREST requests work with the tested schema. The service key must never be public. Put these securely into Vercel settings as `COMMAND_DB_URL`, `COMMAND_DB_ANON_KEY`, and `COMMAND_DB_SERVICE_KEY`.
6. Run `npm run secrets:init` in a private local terminal. It prepares `COMMAND_SESSION_SECRET` and `CRON_SECRET` in ignored `.env.local` without printing them. Import those values securely into Vercel's encrypted runtime environment settings. The owner password stays in Supabase Auth and is never stored in this app's environment or database tables.

## Exact steps: Vercel team and project

1. Sign in to Vercel and select the existing team **taenextlevelqbs-ops**. Choose **Add New → Project** and import **taenextlevelqbs-ops/taenextlevel-ops**. Create a separate project named **digital-command-center**. Root directory: repository root. Framework: Next.js. Node: 24. Build command: `npm run build`.
2. Before deploying, add the encrypted runtime environment variables from step 5/6 above, plus `COMMAND_ADMIN_EMAIL=takwancrews@gmail.com`, `COMMAND_OWNER_USER_ID`, and `COMMAND_ORIGIN` set to the exact production HTTPS origin (for example your chosen project domain, without a trailing slash). Confirm the actual Vercel URL; do not assume an example domain is available. Scope secrets to the intended production environment and configure previews separately.
3. Enable Vercel deployment protection where your plan supports it. Provider integrations are optional for the first secure deployment but their missing metrics will remain explicitly unavailable. Do not publish an access-bypassed dashboard.
4. For CLI deployment under the existing team, authenticate securely and use `vercel --scope taenextlevelqbs-ops --prod` from the repository root after `npm run preflight` and all checks pass. No Vercel account is authenticated in the current cloud machine. An unclaimed temporary deployment is not used.
5. After deployment, check `/api/health`, verify anonymous dashboard requests redirect to `/login`, verify the Supabase owner account can sign in and out, save a registry site, trigger the authenticated cron without exposing its bearer token, and verify persisted monitoring samples and previous-day metric snapshots. Do not declare production readiness until these pass.

The daily cron archives each website's real previous-day aggregate measurements, with unavailable fields retained as null and source/reason metadata. Snapshot upserts are idempotent per site/day. Individual records, passwords, tokens, email contents and PHI are never archived. GA4 may finalize data later; a previous-day archive can lag provider-reported totals. Monthly unique users must still come from GA4, since daily unique users cannot be summed into monthly unique people.

## Google Analytics

Use a Google Cloud service account with the Analytics Data API enabled. Grant its email Viewer access in each existing GA4 property; save its complete JSON in the encrypted `GOOGLE_SERVICE_ACCOUNT_JSON` variable. Store each numeric **property ID** in the Connections form. A `G-...` measurement ID is a different identifier and is used only by public-site tracking.

The dashboard performs read-only reports via `analyticsdata.googleapis.com` and service-account token exchange via `oauth2.googleapis.com`. You cannot recover analytics from before tracking began. If no property exists, create it in the owner's Google Analytics account, then approve the tracking IDs/consent requirements described in `tracking.md`.

## GitHub and Vercel

Use `COMMAND_GITHUB_TOKEN` with Contents read, Actions read, Metadata read for all selected repositories. When present, the cloud instance’s existing GH_TOKEN is reused for read-only checks. Platform checkout/push access is not proof of GitHub API scope and is not a portable dashboard API token. Use `COMMAND_VERCEL_TOKEN` with access to the selected Vercel team/projects; optionally set `COMMAND_VERCEL_TEAM_ID`. Enter each project ID in Connections. Dashboard provider tokens are not sent to the browser and are never stored in the registry database.

Deployment authorization itself needs an authenticated Vercel CLI/account or scoped deployment token; the dashboard's read-only integrations do not independently authorize project creation. Network policy must allow `api.github.com`, `api.vercel.com`, `vercel.com` plus provider destinations used below. Custom domain additions have been saved in the cloud draft; they do not take effect merely because a draft was saved.

## Existing business data

The inspected source uses DMV `tryout_submissions` and Bellewood `pharmacy_requests`. Configure distinct `DMV_ATTACK_SUPABASE_URL` / `DMV_ATTACK_SUPABASE_READ_KEY` and `BELLEWOOD_SUPABASE_URL` / `BELLEWOOD_SUPABASE_READ_KEY`. These should be least-privilege keys authorized only to count an aggregate view (recommended) rather than broad production service-role keys. Override `_REGISTRATIONS_TABLE`, `_LEADS_TABLE`, `_TIMESTAMP_COLUMN` to match the actual schema/view. Only exact-count HEAD requests are made, with no patient/customer records read into the dashboard.

Crestlane currently sends contact email without a persisted lead table. Its historical email count is therefore unavailable. To count submissions, supply an existing CRM/aggregate source or authorize a separate contact persistence change. A GA4 lead event alone should not be presented as confirmed email delivery. No live email is sent during verification.

Coach Tae and Maverick contain Calendly links. Add the appropriate prefix's `_CALENDLY_TOKEN` and `_CALENDLY_USER_URI`; the token must be scoped to read scheduling for the selected user. Add `_STRIPE_READ_KEY` for each website with payments, scoped to charges read. Both adapter calls are read-only; no registration, payment, booking, or message is created.

## Errors and uptime

Set `COMMAND_SENTRY_TOKEN` with project:read and each site's `organization/project`. An existing SDK is necessary to have actual events; no error history is invented. Monitoring uses public HTTPS URLs only, rejects private/reserved addresses and pins validated DNS addresses to requests. Redirect targets are revalidated. Cron state is stored in the dedicated database. A cron failure does not fabricate a recorded sample.

Daily cron is configured for the free Vercel plan. If you choose a paid plan, increase the frequency through a reviewed `vercel.json` change. At scale, monitoring and business-data adapters should use background jobs with bounded concurrency; current provider calls time out and pagination has an explicit safety cap.

Secrets for Supabase projects need the **actual** `<project>.supabase.co` host before cloud proxy destination bindings can be declared. No guessed host or wildcard credential destination is saved. Google service-account private keys and server session secrets must be actual server runtime secrets, not outbound-proxy placeholders, because local cryptographic operations need their values. Use secure Vercel runtime settings for those values.
