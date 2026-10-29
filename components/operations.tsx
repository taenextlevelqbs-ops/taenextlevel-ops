import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  CreditCard,
  Activity,
  ChevronRight,
  Users,
  ShieldCheck,
} from "lucide-react";
import { businessTools } from "@/lib/operations.mjs";
import type {
  DashboardData,
  Row,
  OperationsData,
  PaymentConnection,
} from "@/lib/types";
import { InstallApp } from "./install-app";
type Operations = OperationsData;
function money(amount: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount /
      10 **
        (new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).resolvedOptions().maximumFractionDigits ?? 2),
  );
}
function when(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    ...(value.length > 10
      ? ({ hour: "numeric", minute: "2-digit" } as const)
      : {}),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
function Tools({ id }: { id: string }) {
  return (
    <div className="tool-links">
      {(businessTools[id as keyof typeof businessTools] || []).map(
        ([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer">
            {label}
            <ArrowUpRight size={15} />
          </a>
        ),
      )}
    </div>
  );
}
function Empty({ reason }: { reason: string | null }) {
  return (
    <div className="ops-empty">
      <CircleAlert size={18} />
      <p>{reason || "No records in this period."}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number | null;
  note: string;
}) {
  return (
    <div className="ops-stat">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <small>{note}</small>
    </div>
  );
}
function BookingList({ data }: { data: Operations["bookings"] }) {
  return data.status !== "Connected" ? (
    <Empty reason={data.reason} />
  ) : data.items.length ? (
    <div className="event-list">
      {data.items
        .slice(0, 30)
        .map((e: { id: string; start: string; title: string; url: string }) => (
          <a href={e.url} key={e.id} target="_blank" rel="noreferrer">
            <CalendarDays size={20} />
            <span>
              <strong>{e.title}</strong>
              <small>{when(e.start)} · Eastern</small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ))}
    </div>
  ) : (
    <Empty reason="No upcoming sessions in the next 30 days." />
  );
}
function PaymentList({ data }: { data: Operations["coachPayments"] }) {
  return data.status !== "Connected" ? (
    <Empty reason={data.reason} />
  ) : (
    <>
      <p className="ops-caption">
        Verified account {data.accountId} · latest 20 payment intents
      </p>
      {data.items.length ? (
        <div className="payment-list">
          {data.items.map(
            (p: {
              id: string;
              amount: number;
              currency: string;
              status: string;
              date: string;
            }) => (
              <div key={p.id}>
                <span>
                  <strong>{money(p.amount, p.currency)}</strong>
                  <small>{when(p.date)}</small>
                </span>
                <span
                  className={`ops-badge ${p.status === "succeeded" ? "good" : "warn"}`}
                >
                  {p.status.replaceAll("_", " ")}
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <Empty reason="No payment intents returned by Stripe." />
      )}
      {data.hasMore && (
        <p className="ops-caption">
          More payments are available in this business’s existing payment tools.
        </p>
      )}
    </>
  );
}
export function collectAlerts(data: DashboardData, ops: Operations) {
  const alerts: {
    title: string;
    detail: string;
    href: string;
    kind: string;
  }[] = [];
  for (const [title, connection] of [
    ["Coach Tae bookings", ops.bookings],
    ["Coach Tae payments", ops.coachPayments],
    ["DMV Attack payments", ops.dmvPayments],
    ["DMV Attack athlete & fee records", ops.records],
    ["NOVA score health", ops.nova],
  ] as const)
    if (connection.status !== "Connected")
      alerts.push({
        title,
        detail: connection.reason || "Unavailable",
        href: "/settings",
        kind: "Connection needed",
      });
  if (ops.nova.status === "Connected") {
    if (ops.nova.stale)
      alerts.push({
        title: "NOVA calculation is stale",
        detail: `Last calculated ${when(ops.nova.calculatedAt)}. More than 36 hours have elapsed.`,
        href: "https://www.novasportslive.com/admin/data",
        kind: "Review",
      });
    if (ops.nova.overdue > 0)
      alerts.push({
        title: `${ops.nova.overdue} overdue football results`,
        detail: "Recent games have no verified final. Review evidence in NOVA.",
        href: "https://www.novasportslive.com/admin/data",
        kind: "Review",
      });
  }
  for (const report of ops.jobs || []) {
    if (report.status !== "Connected") {
      alerts.push({
        title: `${report.id}: job monitoring unavailable`,
        detail: report.reason || "GitHub Actions unavailable",
        href: `/sites/${report.id}`,
        kind: "Connection needed",
      });
      continue;
    }
    const latest = new Map<string, (typeof report.items)[number]>();
    for (const run of report.items)
      if (!latest.has(run.workflowId)) latest.set(run.workflowId, run);
    for (const run of latest.values())
      if (
        ["failure", "timed_out", "action_required", "startup_failure"].includes(
          run.state,
        )
      )
        alerts.push({
          title: `${report.id}: ${run.title}`,
          detail: `Latest observed workflow state: ${run.state} · ${when(run.date)}`,
          href: run.url,
          kind: "Failure",
        });
  }
  for (const h of ops.health || [])
    if (h.status === "down")
      alerts.push({
        title: `${h.id}: website returned HTTP ${h.httpStatus}`,
        detail: `Checked ${when(h.checkedAt)}`,
        href: `/sites/${h.id}`,
        kind: "Failure",
      });
  const notifications = ops.coachNative?.records.jobs;
  if (notifications?.status === "Connected")
    for (const job of notifications.items)
      if (job.last_error && !job.completed_at)
        alerts.push({
          title: `Coach Tae: ${job.kind} delivery needs attention`,
          detail: `${job.attempts} delivery attempts recorded. Review the coach notification queue.`,
          href: "https://coachtaeqb.com/coach",
          kind: "Failure",
        });
  for (const row of data.rows) {
    if ((row.metrics.buildFailures?.value || 0) > 0)
      alerts.push({
        title: `${row.site.name}: failed automated runs`,
        detail: `${row.metrics.buildFailures.value} failed GitHub runs in the selected reporting window.`,
        href: `/sites/${row.site.id}`,
        kind: "Failure",
      });
    if (row.deployment.deployments.some((d) => d.state === "ERROR"))
      alerts.push({
        title: `${row.site.name}: deployment failure`,
        detail: "A deployment in this reporting window failed.",
        href: `/sites/${row.site.id}`,
        kind: "Failure",
      });
    if (row.health.status === "down")
      alerts.push({
        title: `${row.site.name}: uptime check failed`,
        detail: row.health.reason || "Review the latest monitoring sample.",
        href: `/sites/${row.site.id}`,
        kind: "Review",
      });
  }
  return alerts;
}
function BusinessCard({
  id,
  title,
  tag,
  children,
}: {
  id: string;
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`ops-card business-${id}`}>
      <div className="ops-card-heading">
        <span className="business-monogram">
          {id === "coach-tae" ? "CT" : id === "dmv-attack" ? "DA" : "N"}
        </span>
        <div>
          <span className="ops-caption">{tag}</span>
          <h2>{title}</h2>
        </div>
        <Link href={`/sites/${id}`} aria-label={`Open ${title} reporting`}>
          <ChevronRight size={22} />
        </Link>
      </div>
      {children}
      <Tools id={id} />
    </section>
  );
}
function Revenue({ row, report }: { row?: Row; report?: PaymentConnection }) {
  if (report?.status === "Unavailable")
    return (
      <Stat
        label="Revenue · last 30 days"
        value={null}
        note="Live Stripe reporting unavailable"
      />
    );
  if (report?.status === "Connected" && report.livemode && report.amounts)
    return (
      <Stat
        label="Revenue · last 30 days"
        value={
          report.amounts.length
            ? report.amounts
                .map((a) => money(a.minorUnits, a.currency))
                .join(" / ")
            : money(0)
        }
        note={`Captured charges less refunds · ${report.accountId}`}
      />
    );
  return (
    <Stat
      label="Revenue · last 30 days"
      value={
        row?.metrics.payments.value == null
          ? null
          : row.paymentAmounts.length
            ? row.paymentAmounts
                .map((a) => money(a.minorUnits, a.currency))
                .join(" / ")
            : money(0)
      }
      note="Captured charges less refunds · separate account"
    />
  );
}
export function OperationsView({
  data,
  ops,
  view = "overview",
}: {
  data: DashboardData;
  ops: Operations;
  view?: string;
}) {
  const alerts = collectAlerts(data, ops),
    coach = data.rows.find((r) => r.site.id === "coach-tae"),
    dmv = data.rows.find((r) => r.site.id === "dmv-attack");
  const novaRow = data.rows.find((r) => r.site.id === "nova");
  const novaLive = ops.health?.find((h) => h.id === "nova");
  const title: Record<string, string> = {
    overview: "Your business. Within reach.",
    businesses: "Built to move your businesses.",
    calendar: "Make room for what’s next.",
    payments: "Every account. A clear view.",
    alerts: "Know what needs your attention.",
  };
  return (
    <div className="operations">
      <div className="ops-intro">
        <div>
          <span className="eyebrow">TAE NEXT LEVEL · BUSINESS OPERATIONS</span>
          <h1>{title[view]}</h1>
          <p>One private workspace. Your next move, made simple.</p>
        </div>
        <InstallApp />
      </div>
      <div className="ops-toolbar">
        <span>
          <ShieldCheck size={15} /> Owner workspace
        </span>
        <span>Eastern time · {when(data.refreshedAt)}</span>
        <Link href="/settings">
          Connections <ArrowUpRight size={14} />
        </Link>
      </div>
      {view === "overview" && (
        <>
          <div className="ops-summary">
            <Link href="/calendar">
              <CalendarDays size={20} />
              <span>
                Upcoming training
                <strong>
                  {ops.bookings.status === "Connected"
                    ? ops.bookings.items.length
                    : "—"}
                </strong>
                <small>Next 30 days · training schedule</small>
              </span>
            </Link>
            <Link href="/businesses#dmv-attack">
              <Users size={20} />
              <span>
                Tryout athletes
                <strong>
                  {ops.records.status === "Connected"
                    ? ops.records.items.length
                    : "—"}
                </strong>
                <small>DMV Attack registrations</small>
              </span>
            </Link>
            <Link href="/alerts">
              <CircleAlert size={20} />
              <span>
                Needs attention<strong>{alerts.length}</strong>
                <small>Failures & connection gaps</small>
              </span>
            </Link>
          </div>
          <div className="ops-section-title">
            <h2>Your businesses</h2>
            <Link href="/businesses">
              View all <ChevronRight size={15} />
            </Link>
          </div>
        </>
      )}
      {(view === "overview" || view === "businesses") && (
        <div className="business-grid">
          <BusinessCard
            id="coach-tae"
            title="Coach Tae"
            tag="01 / QUARTERBACK TRAINING"
          >
            <div className="ops-stat-grid">
              <Revenue row={coach} report={ops.coachPayments} />
              <Stat
                label="Upcoming sessions"
                value={
                  ops.bookings.status === "Connected"
                    ? ops.bookings.items.length
                    : null
                }
                note="Native schedule · next 30 days"
              />
            </div>
            <h3>Training schedule</h3>
            <BookingList data={ops.bookings} />
            <p className="ops-caption">
              Manage booking changes in Coach administration. Preserved
              appointments appear as occupied times.
            </p>
          </BusinessCard>
          <div id="dmv-attack">
            <BusinessCard
              id="dmv-attack"
              title="DMV Attack"
              tag="02 / TEAM OPERATIONS"
            >
              <div className="ops-stat-grid">
                <Stat
                  label="Tryout registrations"
                  value={
                    ops.records.status === "Connected"
                      ? ops.records.items.length
                      : null
                  }
                  note="Existing athlete records"
                />
                <Stat
                  label="Outstanding team fees"
                  value={
                    ops.records.status === "Connected" &&
                    ops.records.feesStatus !== "Unavailable"
                      ? money(
                          ops.records.fees.reduce(
                            (sum: number, f: { outstanding: number }) =>
                              sum + f.outstanding,
                            0,
                          ),
                        )
                      : null
                  }
                  note="Fee ledger · USD"
                />
              </div>
              {ops.records.status !== "Connected" ? (
                <Empty reason={ops.records.reason} />
              ) : (
                <>
                  <h3>Athletes & registration payments</h3>
                  <div className="athlete-list">
                    {ops.records.items.map(
                      (a: {
                        id: string;
                        athlete_first_name: string;
                        athlete_last_name: string;
                        age_group: string;
                        payment_status: string;
                      }) => (
                        <a
                          key={a.id}
                          href="https://dmvattack.com/admin/athletes"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>
                            {a.athlete_first_name} {a.athlete_last_name}
                            <small>{a.age_group}</small>
                          </span>
                          <span>
                            {a.payment_status || "Payment status unavailable"}
                          </span>
                        </a>
                      ),
                    )}
                  </div>
                  <p className="ops-caption">
                    {ops.records.teams.length} teams · open rosters below for
                    team assignments.
                  </p>
                </>
              )}
              <Revenue row={dmv} report={ops.dmvPayments} />
            </BusinessCard>
          </div>
          <BusinessCard
            id="nova"
            title="NOVA Sports Live"
            tag="03 / SPORTS MEDIA"
          >
            <div className="ops-stat-grid">
              <Stat
                label="Website uptime"
                value={
                  novaLive
                    ? novaLive.status === "unknown"
                      ? null
                      : novaLive.status
                    : novaRow?.health.status === "unknown"
                      ? null
                      : novaRow?.health.status || null
                }
                note={
                  novaLive
                    ? `Live check ${when(novaLive.checkedAt)}`
                    : novaRow?.health.checkedAt
                      ? `Last probe ${when(novaRow.health.checkedAt)}`
                      : "No measured uptime samples"
                }
              />
              <Stat
                label="Latest deployment"
                value={
                  ops.nova.status === "Connected" && ops.nova.commit
                    ? "Serving"
                    : novaRow?.deployment.deployments[0]?.state || null
                }
                note={
                  ops.nova.status==='Connected' && ops.nova.commit ? `Serving commit ${ops.nova.commit.slice(0,10)} · NOVA status API` : novaRow?.deployment.deployments[0]?.date
                    ? when(novaRow.deployment.deployments[0].date)
                    : "Vercel data is unavailable"
                }
              />
              <Stat
                label="Verified football finals"
                value={ops.nova.status === "Connected" ? ops.nova.finals : null}
                note="Published NOVA ledger"
              />
              <Stat
                label="Overdue results"
                value={
                  ops.nova.status === "Connected" ? ops.nova.overdue : null
                }
                note="Recent games needing verified finals"
              />
            </div>
            {ops.nova.status !== "Connected" ? (
              <Empty reason={ops.nova.reason} />
            ) : (
              <>
                <p className={`ops-badge ${ops.nova.stale ? "warn" : "good"}`}>
                  {ops.nova.stale
                    ? "Calculation stale"
                    : "Calculation within 36 hours"}
                </p>
                <p className="ops-caption">
                  Through {ops.nova.throughDate} · calculated{" "}
                  {when(ops.nova.calculatedAt)}
                </p>
                <p className="ops-caption">
                  Playoff watch: {ops.nova.playoff?.ratedSchools ?? "—"} rated
                  schools. Official seeds{" "}
                  {ops.nova.officialSeedsVerified ? "verified" : "unverified"}.
                </p>
              </>
            )}
            {ops.nova.status === "Connected" && (
              <details className="nova-review">
                <summary>Score & data review queue</summary>
                <div>
                  {Object.entries(ops.nova.unresolved || {}).map(
                    ([key, value]) => (
                      <p className="ops-caption" key={key}>
                        {key.replaceAll("-", " ")}: {value}
                      </p>
                    ),
                  )}
                </div>
              </details>
            )}
            <p className="ops-caption">
              Rankings and standings health require review in NOVA. Uptime,
              deployments and failed automation are in website reporting.
            </p>
          </BusinessCard>
        </div>
      )}
      {(view === "overview" || view === "calendar") && (
        <section className="ops-card calendar-card">
          <div className="ops-section-title">
            <h2>{view === "overview" ? "On the horizon" : "Calendar"}</h2>
            <span className="ops-caption">Eastern time</span>
          </div>
          {view === "calendar" && (
            <>
              <h3>Coach Tae · next 30 days</h3>
              <BookingList data={ops.bookings} />
            </>
          )}
          <h3>DMV Attack · 2027 tournament schedule</h3>
          <p className="ops-caption">
            From the existing organization schedule. Confirm travel details in
            DMV administration.
          </p>
          <div className="event-list">
            {ops.tournaments.map((e) => (
              <a href={e.url} target="_blank" rel="noreferrer" key={e.id}>
                <span className="event-date">{when(e.start)}</span>
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {e.location} · {when(e.start)}–
                    {when(
                      new Date(Date.parse(e.end) - 86400000)
                        .toISOString()
                        .slice(0, 10),
                    )}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        </section>
      )}
      {view === "payments" && (
        <>
          <p className="ops-notice">
            <ShieldCheck size={19} /> Coach Tae and DMV Attack use separate,
            verified Stripe accounts. Totals are never combined.
          </p>
          <div className="business-grid payment-grid">
            <BusinessCard
              id="coach-tae"
              title="Coach Tae"
              tag="TRAINING PAYMENTS"
            >
              <Revenue row={coach} report={ops.coachPayments} />
              <PaymentList data={ops.coachPayments} />
            </BusinessCard>
            <BusinessCard
              id="dmv-attack"
              title="DMV Attack"
              tag="TEAM & TRYOUT PAYMENTS"
            >
              <Revenue row={dmv} report={ops.dmvPayments} />
              <PaymentList data={ops.dmvPayments} />
              <Stat
                label="Outstanding team fees"
                value={
                  ops.records.status === "Connected" &&
                  ops.records.feesStatus !== "Unavailable"
                    ? money(
                        ops.records.fees.reduce(
                          (sum: number, f: { outstanding: number }) =>
                            sum + f.outstanding,
                          0,
                        ),
                      )
                    : null
                }
                note="Recorded fee ledger · separate from Stripe"
              />
            </BusinessCard>
          </div>
        </>
      )}
      {(view === "overview" || view === "alerts") && (
        <section className="ops-card">
          <div className="ops-section-title">
            <h2>
              {view === "overview" ? "Attention, where it counts" : "Alerts"}
            </h2>
            <span className="ops-badge warn">{alerts.length} items</span>
          </div>
          <p className="ops-caption">
            In-app alerts refresh while this dashboard is open. Unconnected
            monitoring cannot confirm automation success. Background push
            notifications are not connected.
          </p>
          <div className="alert-list">
            {(view === "overview" ? alerts.slice(0, 3) : alerts).map((a) => (
              <a href={a.href} key={a.title}>
                <CircleAlert size={18} />
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.detail}</small>
                </span>
                <span className="ops-badge">{a.kind}</span>
              </a>
            ))}
          </div>
          {view === "overview" && (
            <Link className="ops-text-link" href="/alerts">
              Review all alerts <ChevronRight size={16} />
            </Link>
          )}
        </section>
      )}
      {(view === "overview" || view === "businesses") && (
        <>
          <section className="ops-card">
            <div className="ops-section-title">
              <h2>Coach Tae · athletes & booking operations</h2>
              <a
                href="https://coachtaeqb.com/coach"
                target="_blank"
                rel="noreferrer"
              >
                Open coach panel ↗
              </a>
            </div>
            {ops.coachNative?.status === "Connected" ? (
              <>
                <p className="ops-caption">
                  Native booking is{" "}
                  {ops.coachNative.bookingEnabled
                    ? "open"
                    : "closed pending cutover verification"}
                  . Source: existing Coach Tae Supabase records.
                </p>
                {ops.coachNative.records.athletes?.status === "Connected" ? (
                  <>
                    <Stat
                      label="Athlete profiles"
                      value={ops.coachNative.records.athletes.items.length}
                      note="Native family athletes"
                    />
                    <div className="athlete-list">
                      {ops.coachNative.records.athletes.items.map((a) => (
                        <p key={String(a.id)}>
                          {String(a.name)}
                          {a.graduation_year
                            ? ` · Class of ${a.graduation_year}`
                            : ""}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty
                    reason={
                      ops.coachNative.records.athletes?.reason ||
                      "Athlete data unavailable"
                    }
                  />
                )}
                <div className="ops-stat-grid">
                  {["confirmed", "held", "cancelled", "expired"].map(
                    (status) => (
                      <Stat
                        key={status}
                        label={`${status.charAt(0).toUpperCase() + status.slice(1)} bookings`}
                        value={
                          ops.coachNative?.records.bookings?.status ===
                          "Connected"
                            ? ops.coachNative.records.bookings.items.filter(
                                (b) => b.status === status,
                              ).length
                            : null
                        }
                        note="All recorded native bookings"
                      />
                    ),
                  )}
                </div>
              </>
            ) : (
              <Empty
                reason={
                  ops.coachNative?.reason ||
                  "Native athlete integration is unavailable."
                }
              />
            )}
          </section>
          <section className="ops-card">
            <div className="ops-section-title">
              <h2>DMV Attack · team rosters</h2>
              <a
                href="https://dmvattack.com/admin/teams"
                target="_blank"
                rel="noreferrer"
              >
                Manage rosters ↗
              </a>
            </div>
            {ops.records.status === "Connected" &&
            ops.records.rostersStatus === "Connected" ? (
              ops.records.teams.map((t) => (
                <details className="nova-review" key={t.id}>
                  <summary>
                    {t.name} · {t.age_group} · {t.season}
                  </summary>
                  <div className="athlete-list">
                    {ops.records.status === "Connected" &&
                      ops.records.rosters
                        ?.filter((r) => r.team_id === t.id)
                        .map((r) => {
                          const a =
                            ops.records.status === "Connected"
                              ? ops.records.items.find(
                                  (a) => a.id === r.tryout_submission_id,
                                )
                              : undefined;
                          return (
                            <p key={r.id}>
                              {a
                                ? `${a.athlete_first_name} ${a.athlete_last_name}`
                                : "Athlete record unavailable"}{" "}
                              · {r.roster_status}
                            </p>
                          );
                        })}
                  </div>
                </details>
              ))
            ) : (
              <Empty reason="Team assignment data is unavailable. Open the existing roster panel." />
            )}
            {ops.records.status === "Connected" &&
              ops.records.feesStatus === "Unavailable" && (
                <Empty
                  reason={
                    ops.records.feesReason ||
                    "Fee ledger unavailable; outstanding totals are withheld."
                  }
                />
              )}
          </section>
          <section className="ops-card">
            <div className="ops-section-title">
              <h2>Crestlane Digital</h2>
              <a
                href="https://crestlanedigital.com/portal"
                target="_blank"
                rel="noreferrer"
              >
                Open workspace ↗
              </a>
            </div>
            {ops.crestlane?.records.projects?.status === "Connected" ? (
              <div className="event-list">
                {ops.crestlane.records.projects.items.length ? (
                  ops.crestlane.records.projects.items.map((p) => (
                    <div key={String(p.id)}>
                      <strong>{String(p.title)}</strong>
                      <span className="ops-badge">{String(p.status)}</span>
                    </div>
                  ))
                ) : (
                  <p className="ops-caption">
                    No projects recorded in the connected project database.
                  </p>
                )}
              </div>
            ) : (
              <Empty
                reason={
                  ops.crestlane?.records.projects?.reason ||
                  ops.crestlane?.reason ||
                  "Crestlane project records are not connected."
                }
              />
            )}
            <p className="ops-caption">
              Client website assignments require a configured project source.
              Portfolio website reporting remains available below.
            </p>
          </section>
          <section className="ops-card">
            <h2>Production health</h2>
            <p className="ops-caption">
              Current HTTP checks and deployment identity from each serving
              business app. Historical Vercel build failures require Vercel API
              read access.
            </p>
            <div className="payment-list">
              {ops.health?.map((h) => (
                <div key={h.id}>
                  <span>
                    <strong>
                      {data.sites.find((s) => s.id === h.id)?.name || h.id}
                    </strong>
                    <small>
                      {when(h.checkedAt)} ·{" "}
                      {h.responseMs === null
                        ? "No measured response"
                        : `${h.responseMs} ms`}
                    </small>
                  </span>
                  <span
                    className={`ops-badge ${h.status === "up" ? "good" : "warn"}`}
                  >
                    {h.status}
                    {h.httpStatus ? ` · HTTP ${h.httpStatus}` : ""}
                  </span>
                </div>
              ))}
            </div>
            {[ops.coachNative, ops.dmvNative, ops.crestlane]
              .filter((b) => b?.deployment)
              .map((b) => (
                <p key={b?.business} className="ops-caption">
                  {b?.business}: {b?.deployment?.environment} ·{" "}
                  {b?.deployment?.status} · commit{" "}
                  {b?.deployment?.commit?.slice(0, 10) || "unavailable"}
                </p>
              ))}
          </section>
        </>
      )}
      <div className="ops-bottom-links">
        <Link href="/sites">
          <Activity size={17} /> Website reporting
        </Link>
        <Link href="/settings">
          <CreditCard size={17} /> Manage connections
        </Link>
      </div>
    </div>
  );
}
