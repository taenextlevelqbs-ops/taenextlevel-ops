import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Activity,
  Globe2,
  UsersRound,
  MousePointer2,
  Radio,
  GitBranch,
  CircleAlert,
  Link2,
  ExternalLink,
  Clock3,
  ChevronRight,
  ShieldCheck,
  Plus,
  Layers3,
  RefreshCw,
} from "lucide-react";
import type { DashboardData, Row, Metric, Breakdown } from "@/lib/types";
import { PortfolioTable } from "./portfolio-table";
export function fmt(n: number | null, decimals = 0) {
  return n === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: decimals,
      }).format(n);
}
function sum(rows: Row[], key: string) {
  const connected = rows.filter((r) => r.metrics[key]?.value !== null);
  return {
    value: connected.length
      ? connected.reduce((s, r) => s + (r.metrics[key]?.value || 0), 0)
      : null,
    covered: connected.length,
  };
}
export function PeriodPicker({
  period,
  base = "/",
  id = "",
}: {
  period: string;
  base?: string;
  id?: string;
}) {
  return (
    <nav className="period-picker" aria-label="Traffic period">
      {["day", "week", "month", "year"].map((p) => (
        <Link
          key={p}
          href={`${base}${id}?period=${p}`}
          className={period === p ? "selected" : ""}
          aria-current={period === p ? "page" : undefined}
        >
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
function Change({ metric }: { metric: Metric }) {
  if (metric.change === undefined || metric.change === null)
    return <span className="metric-note">Previous period unavailable</span>;
  return (
    <span
      className={metric.change >= 0 ? "growth positive" : "growth negative"}
    >
      {metric.change >= 0 ? (
        <ArrowUpRight size={13} />
      ) : (
        <ArrowDownRight size={13} />
      )}{" "}
      {Math.abs(metric.change).toFixed(1)}% <span>vs. previous period</span>
    </span>
  );
}
function MetricCard({
  label,
  value,
  icon,
  note,
  metric,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  note?: string;
  metric?: Metric;
}) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">{fmt(value)}</div>
      {metric ? (
        <Change metric={metric} />
      ) : (
        <span className="metric-note">{note}</span>
      )}
    </article>
  );
}
export function Empty({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <div className="empty-icon">
        <Activity size={22} />
      </div>
      <strong>{title}</strong>
      <p>{detail}</p>
      <Link href="/settings">
        Manage connections <ArrowRight size={13} />
      </Link>
    </div>
  );
}
function TrafficChart({
  rows,
  range,
}: {
  rows: Row[];
  range: DashboardData["range"];
}) {
  const connected = rows.filter((r) => r.traffic.visitors.value !== null);
  const points = new Map<string, number>();
  connected.forEach((row) =>
    row.traffic.series.forEach((p) =>
      points.set(p.date, (points.get(p.date) || 0) + p.views),
    ),
  );
  const series = [...points].sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...series.map(([, n]) => n));
  const path = series
    .map(
      ([, n], i) =>
        `${i === 0 ? "M" : "L"} ${(i / Math.max(1, series.length - 1)) * 840 + 10} ${190 - (n / max) * 158}`,
    )
    .join(" ");
  return (
    <section className="panel traffic-panel">
      <div className="panel-heading">
        <div>
          <h2>Traffic performance</h2>
          <p>Page views across your connected websites</p>
        </div>
        <span className="chart-key">
          <i /> Page views
        </span>
      </div>
      {!series.length ? (
        <Empty
          title="Your next chapter starts with a connection."
          detail="Connect Google Analytics to see real traffic trends. No estimated or sample data is shown."
        />
      ) : (
        <>
          <div className="chart-area">
            <div className="chart-y">
              <span>{fmt(max)}</span>
              <span>{fmt(max / 2)}</span>
              <span>0</span>
            </div>
            <svg
              viewBox="0 0 860 215"
              role="img"
              aria-label={`Page views for ${series.length} days. Peak ${fmt(max)} page views.`}
            >
              <defs>
                <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#d7b785" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#d7b785" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[32, 111, 190].map((y) => (
                <line
                  key={y}
                  x1="10"
                  x2="850"
                  y1={y}
                  y2={y}
                  stroke="#303438"
                  strokeDasharray="3 5"
                />
              ))}
              <path
                d={`${path} L 850 190 L 10 190 Z`}
                fill="url(#chart-fill)"
              />
              <path
                d={path}
                fill="none"
                stroke="#d7b785"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {series.length === 1 && (
                <circle
                  cx="10"
                  cy={190 - (series[0][1] / max) * 158}
                  r="4"
                  fill="#d7b785"
                />
              )}
            </svg>
          </div>
          <div className="chart-x">
            <span>{series[0][0]}</span>
            <span>{series[Math.floor(series.length / 2)][0]}</span>
            <span>{series.at(-1)?.[0]}</span>
          </div>
          <details className="chart-data">
            <summary>View daily measurements</summary>
            <div className="scroll-table">
              <table>
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Page views</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map(([date, n]) => (
                    <tr key={date}>
                      <td>{date}</td>
                      <td>{fmt(n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <div className="panel-caption">
        <span>
          <span className="status-dot muted-dot" />
          {connected.length} of {rows.length} websites connected
        </span>
        <span>{range.days}-day window · UTC</span>
      </div>
    </section>
  );
}
export function Dashboard({
  data,
  portfolio = false,
}: {
  data: DashboardData;
  portfolio?: boolean;
}) {
  const { rows, range } = data;
  const visitors = sum(rows, "visitors"),
    views = sum(rows, "pageviews"),
    leads = sum(rows, "leads"),
    live = sum(rows, "live");
  const checked = rows.filter((r) => r.health.samples > 0),
    up = checked.filter((r) => r.health.status === "up");
  const activity = rows
    .flatMap((row) =>
      row.git.activity.map((a) => ({
        ...a,
        site: row.site.name,
        color: row.site.color,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DIGITAL ECOSYSTEM</span>
          <h1>
            {portfolio ? "Website portfolio" : "Everything. In perspective."}
          </h1>
          <p>
            {portfolio
              ? "Every website you own or manage, in one place."
              : "A clear view of your websites, your audience, and your business."}
          </p>
        </div>
        <div className="heading-actions">
          <Link href="/settings" className="button secondary">
            <Plus size={15} /> Add website
          </Link>
          <Link
            href={`?period=${range.period}`}
            className="icon-button"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={16} />
          </Link>
        </div>
      </div>
      <div className="summary-strip">
        <span>
          <Layers3 size={15} />
          <strong>{rows.length}</strong> websites in your portfolio
        </span>
        <span>
          <ShieldCheck size={14} /> Owner access only
        </span>
        <div className="summary-right">
          <Clock3 size={13} /> Updated{" "}
          {new Date(data.refreshedAt).toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          ET
        </div>
      </div>
      <div className="section-toolbar">
        <div>
          <span className="section-kicker">PORTFOLIO SNAPSHOT</span>
          <p>
            {range.start.slice(0, 10)} —{" "}
            {new Date(Date.parse(range.end) - 1).toISOString().slice(0, 10)}
          </p>
        </div>
        <PeriodPicker period={range.period} />
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Site audiences"
          value={visitors.value}
          icon={<UsersRound size={17} />}
          note={`${visitors.covered}/${rows.length} sites · active users summed, not deduplicated`}
        />
        <MetricCard
          label="Total page views"
          value={views.value}
          icon={<MousePointer2 size={17} />}
          note={`${views.covered}/${rows.length} sites reporting`}
        />
        <MetricCard
          label="Contact submissions"
          value={leads.value}
          icon={<Link2 size={17} />}
          note={`${leads.covered}/${rows.length} sites · configured database counts`}
        />
        <MetricCard
          label="Live audience"
          value={live.value}
          icon={<Radio size={17} />}
          note={`${live.covered}/${rows.length} sites · last 30 minutes`}
        />
      </div>
      <div className="performance-grid">
        <TrafficChart rows={rows} range={range} />
        <section className="panel ecosystem-panel">
          <div className="panel-heading">
            <div>
              <h2>Ecosystem health</h2>
              <p>Measured. Never assumed.</p>
            </div>
            <Activity size={17} />
          </div>
          <div className="health-gauge">
            <div className="gauge-circle">
              <strong>
                {checked.length ? `${up.length}/${checked.length}` : "—"}
              </strong>
              <span>LAST CHECK ONLINE</span>
            </div>
          </div>
          <div className="health-legend">
            <span>
              <i className="legend-dot green" /> Online{" "}
              <strong>{up.length}</strong>
            </span>
            <span>
              <i className="legend-dot red" /> Down{" "}
              <strong>
                {rows.filter((r) => r.health.status === "down").length}
              </strong>
            </span>
            <span>
              <i className="legend-dot gray" /> Unmeasured{" "}
              <strong>
                {
                  rows.filter(
                    (r) =>
                      r.health.samples === 0 || r.health.status === "unknown",
                  ).length
                }
              </strong>
            </span>
          </div>
          <p className="health-note">
            {checked.length
              ? "Scheduled HTTP samples, not continuous uptime."
              : "Monitoring starts after database and scheduled checks are connected."}
          </p>
        </section>
      </div>
      <section className="panel outcome-overview">
        <div className="panel-heading">
          <div>
            <h2>Business & operations</h2>
            <p>Measured outcomes across the connected portfolio</p>
          </div>
          <Layers3 size={17} />
        </div>
        <div className="outcome-grid">
          {[
            ["registrations", "Registrations"],
            ["bookings", "Scheduled bookings"],
            ["payments", "Captured payments"],
            ["errors", "Error events"],
            ["buildFailures", "Failed workflows"],
          ].map(([key, label]) => {
            const total = sum(rows, key);
            return (
              <div key={key}>
                <span>{label}</span>
                <strong>{fmt(total.value)}</strong>
                <small>
                  {total.covered} of {rows.length} sites reporting
                </small>
              </div>
            );
          })}
        </div>
      </section>
      <PortfolioTable rows={rows} period={range.period} />
      <div className="bottom-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest commits from your connected repositories</p>
            </div>
            <GitBranch size={17} />
          </div>
          {activity.length ? (
            <div className="activity-list">
              {activity.map((a, i) => (
                <a href={a.url} key={i} target="_blank" rel="noreferrer">
                  <span className="activity-icon" style={{ color: a.color }}>
                    <GitBranch size={15} />
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    <span>
                      {a.site} ·{" "}
                      {new Date(a.date).toLocaleDateString("en-US", {
                        timeZone: "America/New_York",
                      })}
                    </span>
                  </div>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          ) : (
            <Empty
              title="Activity belongs here."
              detail="Connect GitHub to see recent commits and failed workflows across your portfolio."
              compact
            />
          )}
        </section>
        <section className="panel connection-panel">
          <div className="panel-heading">
            <div>
              <h2>Make the connections.</h2>
              <p>Your data, working together.</p>
            </div>
            <Link2 size={17} />
          </div>
          <p className="connection-copy">
            Connect your existing tools to bring traffic, business outcomes, and
            operational health into focus.
          </p>
          <div className="provider-chips">
            {[
              "Google Analytics",
              "Supabase",
              "Vercel",
              "GitHub",
              "Stripe",
              "Calendly",
              "Sentry",
            ].map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
          <Link className="button secondary wide" href="/settings">
            Manage connections <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="data-note">
        <CircleAlert size={14} />
        <span>
          Unavailable means not connected or not measured. Zero is shown only
          when a provider reports zero. {data.registryStatus}.
        </span>
      </div>
    </>
  );
}
function BreakdownPanel({
  title,
  items,
  source,
}: {
  title: string;
  items: Breakdown[];
  source: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="panel breakdown-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{source}</p>
        </div>
      </div>
      {items.length ? (
        <div className="breakdown-list">
          {items.map((item) => (
            <div key={item.label}>
              <div>
                <span title={item.label}>{item.label || "(not set)"}</span>
                <strong>{fmt(item.value)}</strong>
              </div>
              <div className="bar-track">
                <i style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Not measured yet"
          detail="Connect Google Analytics to populate this view."
          compact
        />
      )}
    </section>
  );
}
export function Detail({ data }: { data: DashboardData }) {
  const row = data.rows[0],
    site = row.site;
  return (
    <>
      <Link className="back-link" href="/sites">
        <ChevronRight size={14} /> Back to all websites
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            WEBSITE INTELLIGENCE · {site.category.toUpperCase()}
          </span>
          <h1>{site.name}</h1>
          <p>
            {site.url ? (
              <a href={site.url} target="_blank" rel="noreferrer">
                {new URL(site.url).hostname} <ExternalLink size={12} />
              </a>
            ) : (
              "Public website URL not confirmed"
            )}
          </p>
        </div>
        <Link href={`/settings?site=${site.id}`} className="button secondary">
          <Link2 size={15} /> Configure site
        </Link>
      </div>
      <div className="section-toolbar">
        <div>
          <span className="section-kicker">PERFORMANCE & GROWTH</span>
          <p>Compare equal-length periods · UTC</p>
        </div>
        <PeriodPicker period={data.range.period} base="/sites/" id={site.id} />
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Unique active visitors"
          value={row.metrics.visitors.value}
          icon={<UsersRound size={17} />}
          metric={row.metrics.visitors}
        />
        <MetricCard
          label="Page views"
          value={row.metrics.pageviews.value}
          icon={<MousePointer2 size={17} />}
          metric={row.metrics.pageviews}
        />
        <MetricCard
          label="Live visitors"
          value={row.metrics.live.value}
          icon={<Radio size={17} />}
          note={
            row.metrics.live.value === null
              ? "Realtime not connected"
              : "GA4 · last 30 minutes"
          }
        />
        <MetricCard
          label="Application errors"
          value={row.metrics.errors.value}
          icon={<CircleAlert size={17} />}
          note={row.metrics.errors.source}
        />
      </div>
      <TrafficChart rows={[row]} range={data.range} />
      <div className="triple-grid">
        <BreakdownPanel
          title="Top pages"
          items={row.traffic.topPages}
          source="GA4 · page views"
        />
        <BreakdownPanel
          title="Traffic sources"
          items={row.traffic.sources}
          source="GA4 · sessions"
        />
        <BreakdownPanel
          title="Devices"
          items={row.traffic.devices}
          source="GA4 · active users by device"
        />
      </div>
      <section className="panel business-panel">
        <div className="panel-heading">
          <div>
            <h2>Business outcomes</h2>
            <p>
              Aggregate counts only. Sensitive customer data stays in its
              source.
            </p>
          </div>
          <Layers3 size={17} />
        </div>
        <div className="business-grid">
          {[
            ["leads", "Contact submissions"],
            ["registrations", "Registrations"],
            ["bookings", "Scheduled bookings"],
            ["payments", "Captured payments"],
          ].map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <strong>{fmt(row.metrics[key].value)}</strong>
              <small>
                {row.metrics[key].value === null
                  ? row.metrics[key].reason
                  : row.metrics[key].source}
              </small>
            </div>
          ))}
        </div>
        {row.paymentAmounts.length > 0 && (
          <div className="payment-amounts">
            {row.paymentAmounts.map((a) => (
              <span key={a.currency}>
                Net captured: {fmt(a.minorUnits)} {a.currency.toUpperCase()}{" "}
                minor units, after refunds
              </span>
            ))}
            <small>
              Currencies are kept separate. Includes refunds recorded at query
              time.
            </small>
          </div>
        )}
      </section>
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Uptime & response</h2>
              <p>Scheduled samples in the selected period</p>
            </div>
            <Activity size={17} />
          </div>
          <div className="uptime-stats">
            <div>
              <strong>
                {fmt(row.health.availability.value, 2)}
                {row.health.availability.value !== null ? "%" : ""}
              </strong>
              <span>Successful samples</span>
            </div>
            <div>
              <strong>
                {fmt(row.health.response.value)}
                {row.health.response.value !== null ? " ms" : ""}
              </strong>
              <span>Last HTTP response</span>
            </div>
          </div>
          <div className="uptime-bars" aria-label="Last 100 monitoring samples">
            {row.health.series.length ? (
              row.health.series.map((s, i) => (
                <i
                  key={i}
                  className={s.status}
                  title={`${s.checked_at}: ${s.status}, ${s.response_ms ?? "unknown"} ms`}
                />
              ))
            ) : (
              <p>No monitoring history yet.</p>
            )}
          </div>
          <p className="panel-footnote">
            Last checked:{" "}
            {row.health.checkedAt
              ? new Date(row.health.checkedAt).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                })
              : "not measured"}
            . {row.health.samples} known samples ·{" "}
            {row.health.unknownSamples || 0} unknown. {row.health.reason}{" "}
            {row.health.truncated ? "Result capped at 10,000 samples." : ""}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Deployment status</h2>
              <p>{row.deployment.status}</p>
            </div>
            <Globe2 size={17} />
          </div>
          {row.deployment.deployments.length ? (
            <div className="deployment-list">
              {row.deployment.deployments.map((d) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer">
                  <span
                    className={`status-pill ${d.state === "READY" ? "up" : d.state === "ERROR" ? "down" : ""}`}
                  >
                    {d.state}
                  </span>
                  <span>
                    {d.target}
                    <small>
                      {new Date(d.date).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                      })}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          ) : (
            <Empty
              title="Deployment history unavailable"
              detail="Connect this website’s Vercel project to see real deployment states."
              compact
            />
          )}
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>GitHub & build health</h2>
            <p>
              {row.git.status} · Failed workflows this period:{" "}
              {fmt(row.metrics.buildFailures.value)}
            </p>
          </div>
          <GitBranch size={17} />
        </div>
        {row.git.activity.length ? (
          <div className="activity-list">
            {row.git.activity.map((a, i) => (
              <a href={a.url} key={i} target="_blank" rel="noreferrer">
                <GitBranch size={15} />
                <div>
                  <strong>{a.title}</strong>
                  <span>
                    {new Date(a.date).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </span>
                </div>
                <ArrowUpRight size={15} />
              </a>
            ))}
            {row.git.runs?.map((r, i) => (
              <a href={r.url} key={`run${i}`} target="_blank" rel="noreferrer">
                <Activity size={15} />
                <div>
                  <strong>{r.title}</strong>
                  <span>
                    Workflow · {r.state} ·{" "}
                    {new Date(r.date).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </span>
                </div>
                <ArrowUpRight size={15} />
              </a>
            ))}
          </div>
        ) : (
          <Empty
            title="Repository activity not connected"
            detail="Read-only GitHub access brings commits and workflow failures into this view."
            compact
          />
        )}
      </section>
      <section className="panel archive-panel">
        <div className="panel-heading">
          <div>
            <h2>Saved analytics history</h2>
            <p>{row.archive.status}</p>
          </div>
          <Clock3 size={17} />
        </div>
        {row.archive.rows.length ? (
          <div className="scroll-table">
            <table className="archive-table">
              <thead>
                <tr>
                  <th>UTC DAY</th>
                  <th>ACTIVE VISITORS</th>
                  <th>PAGE VIEWS</th>
                  <th>CONTACTS</th>
                  <th>BOOKINGS</th>
                  <th>PAYMENTS</th>
                </tr>
              </thead>
              <tbody>
                {row.archive.rows.map((item) => (
                  <tr key={item.day}>
                    <td>{item.day}</td>
                    {[
                      "visitors",
                      "pageviews",
                      "leads",
                      "bookings",
                      "payments",
                    ].map((key) => (
                      <td
                        key={key}
                        title={
                          item.metrics[key]?.reason || item.metrics[key]?.source
                        }
                      >
                        {fmt(item.metrics[key]?.value ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your history will grow here."
            detail="The daily scheduler saves real provider measurements to your dedicated database. Missing measurements remain unavailable."
            compact
          />
        )}
        <p className="panel-footnote">
          Daily active visitors are not summed into monthly unique visitors.
          Provider processing delays may affect the previous-day snapshot.
        </p>
      </section>
      <div className="data-note">
        <CircleAlert size={14} />
        History comes from provider-retained data. Tracking does not reconstruct
        past visitors.
      </div>
    </>
  );
}
