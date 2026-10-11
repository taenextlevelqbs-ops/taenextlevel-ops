# Verification evidence

Verified in the cloud instance on October 11, 2026. Public website repositories remained unchanged.

- **25 unit, provider-contract and PostgreSQL tests passed**: owner-only Supabase Auth decisions, verified email and exact owner UUID, expiry/signature/secret rotation, CSRF rejection, shared throttle failures, unknown-versus-zero metrics, exact-count HEAD requests without customer/patient payloads, pagination and currency separation, registry persistence semantics, RLS, and uptime SSRF defenses.
- **7 Chromium browser tests passed**: redirects and unauthorized API access, login/logout using explicit Supabase fixtures, all eight repository identities, detail periods, registry-write errors, frontend runtime/hydration checks and 320/390/768/1440px layouts.
- **Typecheck, lint and production build passed** with Next.js 16.3.6 and Node 24.19.
- **Production server smoke check passed**: `/api/health` HTTP 200, `/login` HTTP 200, anonymous `/`, `/settings`, and `/sites/nova` HTTP 307, anonymous registry and cron APIs HTTP 401; `X-Frame-Options: DENY` and no-store headers verified.
- **Live GitHub API integration verified for all eight repositories** using existing cloud authentication through the supported Node environment proxy. Actual latest-commit and failed-workflow readings were returned, rather than fixture data.
- **Initial GitHub CI passed**: https://github.com/taenextlevelqbs-ops/taenextlevel-ops/actions/runs/38156309489 . Subsequent pushes trigger their own workflow; this link proves that run only.
- Session and scheduler secret initialization was exercised twice: ignored local configuration retained identical contents and mode 0600. Generated secrets were checked against staged source and excluded from Git.

## Unverified or blocked

The dedicated Supabase project has not been created and the schema has not been applied to a live account. Owner login was tested using an explicit provider fixture; live Supabase Auth and business databases still need secure configuration. Google Analytics, Vercel, Calendly, Stripe and Sentry are implemented and contract-tested but have no supplied live credentials/project IDs. The local uptime probe to Coach Tae could not establish availability from this cloud instance and remained **unknown**, not asserted as downtime.

Vercel CLI reported logged out. Production preflight reports missing dedicated database URL/keys, owner UUID and dashboard origin. No unclaimed temporary deployment was created, no public tracking scripts were injected without measurement/consent settings, and no live email, booking, registration, payment or notification was sent.

Follow `docs/deployment.md` to create the dedicated **crestlane-command-center** Supabase project and deploy a separate **digital-command-center** project under the existing **taenextlevelqbs-ops** Vercel team. After secure settings are supplied, rerun preflight, verify owner login, persisted registry and cron samples in the actual deployment, and connect provider accounts. Do not treat fixture tests or draft saves as proof of live integration or deployment.
