import Link from "next/link";
import {
  LayoutDashboard,
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
          <Link
            className={active === "overview" ? "nav-link active" : "nav-link"}
            href="/"
          >
            <LayoutDashboard size={17} />
            Overview
            <ChevronRight size={14} className="nav-arrow" />
          </Link>
          <Link
            className={active === "sites" ? "nav-link active" : "nav-link"}
            href="/sites"
          >
            <Globe2 size={17} />
            All websites
          </Link>
          <Link
            className={active === "settings" ? "nav-link active" : "nav-link"}
            href="/settings"
          >
            <SlidersHorizontal size={17} />
            Connections
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
                  : "Overview"}
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
