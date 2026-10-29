import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Bell,
  BriefcaseBusiness,
  Globe2,
  SlidersHorizontal,
  ArrowUpRight,
  Command,
  ShieldCheck,
  Radio,
  ChevronRight,
} from "lucide-react";
import { AutoRefresh } from "./auto-refresh";
import { Logout } from "./logout";
export function Shell({
  children,
  active = "overview",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="app-shell">
      <AutoRefresh />
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Command size={21} />
          </span>
          <span>
            COMMAND
            <span className="brand-sub">TAE NEXT LEVEL · OPERATIONS</span>
          </span>
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>PRIVATE</span>
        </div>
        <nav aria-label="Main navigation">
          {[
            ["overview", "/", "Overview", LayoutDashboard],
            ["businesses", "/businesses", "Businesses", BriefcaseBusiness],
            ["calendar", "/calendar", "Calendar", CalendarDays],
            ["payments", "/payments", "Payments", CreditCard],
            ["alerts", "/alerts", "Alerts", Bell],
          ].map(([key, href, label, Icon]) => {
            const NavIcon = Icon as typeof LayoutDashboard;
            return (
              <Link
                key={String(key)}
                href={String(href)}
                className={active === key ? "nav-link active" : "nav-link"}
                aria-current={active === key ? "page" : undefined}
              >
                <NavIcon size={19} />
                <span>{String(label)}</span>
              </Link>
            );
          })}
          <Link
            className={
              active === "sites"
                ? "nav-link active auxiliary"
                : "nav-link auxiliary"
            }
            href="/sites"
          >
            <Globe2 size={17} /> All websites
          </Link>
          <Link
            className={
              active === "settings"
                ? "nav-link active auxiliary"
                : "nav-link auxiliary"
            }
            href="/settings"
          >
            <SlidersHorizontal size={17} /> Connections
          </Link>
        </nav>
        <div className="sidebar-note">
          <Radio size={19} />
          <p>
            Your entire digital ecosystem.<span>One clear perspective.</span>
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="private-label">
            <ShieldCheck size={14} /> Secure owner workspace
          </div>
          <div className="profile">
            <div className="avatar">TC</div>
            <div>
              Takwan Crews<span>Workspace owner</span>
            </div>
            <Logout />
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} />
            <span>
              {active === "settings"
                ? "Connections"
                : active === "sites"
                  ? "Websites"
                  : active.charAt(0).toUpperCase() + active.slice(1)}
            </span>
          </div>
          <div className="topbar-right">
            <span className="topbar-mobile-logout">
              <Logout />
            </span>
            <span className="private-label">
              <span className="status-dot" />
              Private dashboard
            </span>
            <a
              href="https://github.com/taenextlevelqbs-ops/taenextlevel-ops"
              target="_blank"
              rel="noreferrer"
              className="repo-link"
            >
              Command Center <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
        <footer className="footer">
          <span>
            COMMAND CENTER <span className="footer-divider">/</span> YOUR
            BUSINESS, IN FOCUS.
          </span>
          <span>
            Private by design <ShieldCheck size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
}
