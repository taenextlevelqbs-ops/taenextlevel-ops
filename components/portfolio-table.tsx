"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, ArrowUpRight, Globe2 } from "lucide-react";
import type { Row } from "@/lib/types";
const number = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("en-US").format(n);
export function PortfolioTable({
  rows,
  period,
}: {
  rows: Row[];
  period: string;
}) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((r) =>
    `${r.site.name} ${r.site.category} ${r.site.url || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="panel portfolio-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Your websites <span className="count-badge">{rows.length}</span>
          </h2>
          <p>A portfolio view. With room to grow.</p>
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="Search websites"
            placeholder="Find a website…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="scroll-table">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>WEBSITE</th>
              <th>VISITORS</th>
              <th>PAGE VIEWS</th>
              <th>CONTACTS</th>
              <th>GROWTH</th>
              <th>HEALTH</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.site.id}>
                <td>
                  <Link
                    href={`/sites/${row.site.id}?period=${period}`}
                    className="site-cell"
                  >
                    <span
                      className="site-icon"
                      style={{
                        color: row.site.color,
                        background: `${row.site.color}12`,
                      }}
                    >
                      <Globe2 size={18} />
                    </span>
                    <div>
                      <strong>{row.site.name}</strong>
                      <small>
                        {row.site.url
                          ? new URL(row.site.url).hostname
                          : "URL not configured"}
                      </small>
                    </div>
                  </Link>
                </td>
                <td
                  title={
                    row.metrics.visitors.reason || row.metrics.visitors.source
                  }
                >
                  {number(row.metrics.visitors.value)}
                </td>
                <td>{number(row.metrics.pageviews.value)}</td>
                <td>{number(row.metrics.leads.value)}</td>
                <td>
                  {row.metrics.visitors.change !== undefined &&
                  row.metrics.visitors.change !== null ? (
                    <span
                      className={
                        row.metrics.visitors.change >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {row.metrics.visitors.change > 0 ? "+" : ""}
                      {row.metrics.visitors.change.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="table-muted">—</span>
                  )}
                </td>
                <td>
                  <span className={`status-pill ${row.health.status}`}>
                    <i />
                    {row.health.status === "up"
                      ? "Online"
                      : row.health.status === "down"
                        ? "Down"
                        : "Unmeasured"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/sites/${row.site.id}?period=${period}`}
                    aria-label={`Open ${row.site.name} dashboard`}
                    className="table-arrow"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && (
        <p className="no-results">No websites match “{query}”.</p>
      )}
      <div className="panel-caption">
        <span>
          {shown.length} of {rows.length} websites
        </span>
        <Link href="/settings">
          Add a website <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
