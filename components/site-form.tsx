"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, LoaderCircle } from "lucide-react";
import type { Site } from "@/lib/types";
export function SiteForm({
  sites,
  selectedId,
}: {
  sites: Site[];
  selectedId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(selectedId || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  const site = sites.find((s) => s.id === selected);
  return (
    <section className="panel site-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{site ? "Configure website" : "Add to your ecosystem"}</h2>
          <p>Save website settings to your private, persistent registry.</p>
        </div>
        <Plus size={18} />
      </div>
      <label className="form-label">
        Website
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setMessage("");
          }}
        >
          <option value="">＋ Add a new website</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <form
        key={selected}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const form = new FormData(e.currentTarget);
          try {
            const response = await fetch("/api/sites", {
              method: site ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(form.entries())),
            });
            const data = await response.json();
            setSuccess(response.ok);
            setMessage(
              response.ok
                ? "Website saved. It is now available in your portfolio."
                : data.error || "Unable to save website.",
            );
            if (response.ok) {
              router.push(`/sites/${data.site.id}`);
              router.refresh();
            }
          } catch {
            setSuccess(false);
            setMessage("Unable to reach the registry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Website name
            <input
              name="name"
              defaultValue={site?.name}
              placeholder="Your next website"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            Unique site ID
            <input
              name="id"
              defaultValue={site?.id}
              placeholder="my-website"
              pattern="[a-z][a-z0-9-]{1,59}"
              required
              readOnly={!!site}
            />
          </label>
          <label>
            Public HTTPS URL
            <input
              name="url"
              type="url"
              defaultValue={site?.url || ""}
              placeholder="https://yourwebsite.com"
            />
          </label>
          <label>
            GitHub repository
            <input
              name="repository"
              defaultValue={site?.repository}
              placeholder="owner/repository"
            />
          </label>
          <label>
            GA4 property ID
            <input
              name="ga4Property"
              defaultValue={site?.ga4Property}
              placeholder="Numeric property ID"
              inputMode="numeric"
            />
          </label>
          <label>
            Vercel project ID
            <input
              name="vercelProject"
              defaultValue={site?.vercelProject}
              placeholder="prj_… or project name"
            />
          </label>
          <label>
            Sentry organization / project
            <input
              name="sentryProject"
              defaultValue={site?.sentryProject}
              placeholder="organization/project"
            />
          </label>
          <label>
            Category
            <input
              name="category"
              defaultValue={site?.category || "Website"}
              maxLength={40}
            />
          </label>
        </div>
        <p className="form-help">
          API credentials belong in encrypted deployment settings. This form
          never stores secret values.
        </p>
        {message && (
          <p className={success ? "form-success" : "form-error"} role="status">
            {success && <Check size={14} />} {message}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Plus size={15} />
          )}{" "}
          {site ? "Save configuration" : "Add website"}
        </button>
      </form>
    </section>
  );
}
