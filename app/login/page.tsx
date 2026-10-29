import { Command, ShieldCheck, Layers3, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth.mjs";
import { LoginForm } from "@/components/login-form";
export default async function Login() {
  if (await session()) redirect("/");
  return (
    <main id="main-content" className="login-page">
      <div className="login-story">
        <div className="login-brand">
          <Command size={25} /> COMMAND CENTER
        </div>
        <div className="story-center">
          <span className="eyebrow">TAE NEXT LEVEL · DIGITAL OPERATIONS</span>
          <h1>
            See the whole
            <br />
            picture.
          </h1>
          <p>
            Every website. Every connection.
            <br />A clearer view of what comes next.
          </p>
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit o1" />
            <div className="orbit o2" />
            <div className="orbit o3" />
            <div className="orbit-core">
              <Layers3 size={32} />
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <i className={`orbit-point p${i}`} key={i} />
            ))}
          </div>
        </div>
        <div className="story-footer">
          YOUR BUSINESS, IN FOCUS. <ArrowUpRight size={15} />
        </div>
      </div>
      <div className="login-panel">
        <div className="login-box">
          <span className="secure-badge">
            <ShieldCheck size={14} /> PRIVATE WORKSPACE
          </span>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to your Digital Command Center.</p>
          <LoginForm />
          <p className="login-footnote">
            Owner access only. Secured with Supabase Auth. Secure sessions renew for up to 30 days on this device.
          </p>
        </div>
        <span className="login-copyright">
          © {new Date().getFullYear()} Tae Next Level
        </span>
      </div>
    </main>
  );
}
