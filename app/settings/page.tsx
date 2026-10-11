import {
  ShieldCheck,
  Link2,
  LockKeyhole,
  CheckCircle2,
  CircleDashed,
  ArrowUpRight,
} from "lucide-react";
import { requireSession } from "@/lib/auth.mjs";
import { listSites, databaseConfigured } from "@/lib/store.mjs";
import { Shell } from "@/components/shell";
import { SiteForm } from "@/components/site-form";
import type { Site } from "@/lib/types";
const integrations = [
  {
    name: "Google Analytics 4",
    tag: "AUDIENCE",
    description:
      "Active visitors, page views, realtime, sources, devices, and historical comparisons.",
    variables: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    detail:
      "Grant the Google service account Viewer access to each GA4 property. Enter its numeric property ID below.",
    link: "https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries",
  },
  {
    name: "Command Center database",
    tag: "WORKSPACE",
    description:
      "Supabase Auth, persistent registry, daily analytics history, monitoring, and shared sign-in throttling.",
    variables: ["COMMAND_DB_URL", "COMMAND_DB_SERVICE_KEY"],
    detail:
      "Use a dedicated Supabase project and apply database/schema.sql. Public database access is denied by row-level security.",
    link: "https://supabase.com/docs",
  },
  {
    name: "GitHub",
    tag: "DEVELOPMENT",
    description:
      "Latest commits, workflow statuses, and failed GitHub Actions runs.",
    variables: ["COMMAND_GITHUB_TOKEN"],
    detail:
      "Use a fine-grained token with Metadata, Contents read and Actions read for the selected repositories. Platform Git access is separate from dashboard API access.",
    link: "https://github.com/settings/personal-access-tokens",
  },
  {
    name: "Vercel",
    tag: "DEPLOYMENTS",
    description: "Real deployment statuses and production / preview history.",
    variables: ["COMMAND_VERCEL_TOKEN"],
    detail:
      "Add your Vercel token and optional COMMAND_VERCEL_TEAM_ID, then enter each site’s project ID.",
    link: "https://vercel.com/account/settings/tokens",
  },
  {
    name: "Sentry",
    tag: "RELIABILITY",
    description:
      "Received error events from each connected application project.",
    variables: ["COMMAND_SENTRY_TOKEN"],
    detail:
      "Use project:read access and configure organization/project for each website. Installing an SDK is a separate public-site change.",
    link: "https://sentry.io/settings/account/api/auth-tokens/",
  },
];
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireSession();
  const { site } = await searchParams;
  const registry = await listSites();
  return (
    <Shell active="settings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A CONNECTED WORKSPACE</span>
          <h1>Your tools. One perspective.</h1>
          <p>Bring real data into focus, one connection at a time.</p>
        </div>
        <span className="secure-badge">
          <ShieldCheck size={14} /> SERVER-SIDE CREDENTIALS
        </span>
      </div>
      <div className="notice">
        <LockKeyhole size={19} />
        <div>
          <strong>Private means private.</strong>
          <p>
            Provider keys stay on the server. Supabase Auth access is restricted
            to the verified owner takwancrews@gmail.com. No public sign-up, no
            shared analytics secrets.
          </p>
        </div>
      </div>
      <div className="integration-grid">
        {integrations.map((p) => {
          const configured = p.variables.every(
            (name) =>
              !!process.env[name] ||
              (name === "COMMAND_GITHUB_TOKEN" && !!process.env.GH_TOKEN),
          );
          return (
            <section className="panel integration-card" key={p.name}>
              <div className="integration-top">
                <span className="provider-icon">
                  <Link2 size={18} />
                </span>
                <span className="section-kicker">{p.tag}</span>
                {configured ? (
                  <CheckCircle2 size={17} className="positive" />
                ) : (
                  <CircleDashed size={17} />
                )}
              </div>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <span
                className={`connection-state ${configured ? "configured" : ""}`}
              >
                {configured
                  ? "Credentials present · verify in dashboard"
                  : "Not configured"}
              </span>
              <details>
                <summary>Connection instructions</summary>
                <p>{p.detail}</p>
                <div className="variable-list">
                  {p.variables.map((v) => (
                    <code key={v}>{v}</code>
                  ))}
                </div>
                <a href={p.link} target="_blank" rel="noreferrer">
                  Provider documentation <ArrowUpRight size={13} />
                </a>
              </details>
            </section>
          );
        })}
      </div>
      <div className="settings-bottom">
        <SiteForm sites={registry.sites as Site[]} selectedId={site} />
        <div className="setup-guide">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Business connections</h2>
                <p>Each website keeps its own credentials.</p>
              </div>
              <Link2 size={17} />
            </div>
            <div className="guide-body">
              <p>
                Use each website’s environment prefix for its database,
                bookings, and payments.
              </p>
              {registry.sites.map((s) => (
                <div className="prefix-row" key={s.id}>
                  <span>{s.name}</span>
                  <code>{s.envPrefix}</code>
                </div>
              ))}
              <details>
                <summary>Variable suffixes</summary>
                <p>
                  <code>_SUPABASE_URL</code> and <code>_SUPABASE_READ_KEY</code>
                  : read-only count access to existing records. Configure{" "}
                  <code>_LEADS_TABLE</code> or <code>_REGISTRATIONS_TABLE</code>{" "}
                  and optional <code>_TIMESTAMP_COLUMN</code>.
                </p>
                <p>
                  <code>_CALENDLY_TOKEN</code> and{" "}
                  <code>_CALENDLY_USER_URI</code>: scheduled events.
                </p>
                <p>
                  <code>_STRIPE_READ_KEY</code>: captured payments and refunded
                  amounts by currency.
                </p>
              </details>
              <p className="form-help">
                Bellewood defaults to pharmacy_requests; DMV Attack defaults to
                tryout_submissions. Only HEAD requests with exact counts are
                made. A least-privilege aggregate view is recommended.
              </p>
            </div>
          </section>
          <section className="panel tracking-note">
            <h2>Tracking starts with consent.</h2>
            <p>
              No analytics or error-tracking scripts were added to your public
              websites. Connect an existing GA4 property, or create one and
              approve its measurement ID and consent settings before
              installation.
            </p>
            <p>
              Healthcare and authenticated pages need separate privacy review.
              Never send form fields, patient data, query strings, or payment
              details to analytics.
            </p>
            <span className="connection-state">
              {databaseConfigured()
                ? "Database credentials present"
                : "Registry persistence requires database setup"}
            </span>
          </section>
        </div>
      </div>
    </Shell>
  );
}
