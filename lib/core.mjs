import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const PERIODS = ["day", "week", "month", "year"];
export function periodRange(period = "month", now = new Date()) {
  if (!PERIODS.includes(period)) period = "month";
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  const days = { day: 1, week: 7, month: 30, year: 365 }[period];
  start.setUTCDate(start.getUTCDate() - days);
  const previousStart = new Date(start);
  previousStart.setUTCDate(start.getUTCDate() - days);
  return {
    period,
    days,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: start.toISOString(),
  };
}
export function unavailable(reason, source = "Not connected") {
  return { value: null, source, reason, measuredAt: null };
}
export function metric(value, source, extra = {}) {
  if (!Number.isFinite(value) || value < 0)
    return unavailable("Provider returned an invalid measurement", source);
  return {
    value,
    source,
    reason: null,
    measuredAt: new Date().toISOString(),
    ...extra,
  };
}
export function change(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
export function aggregate(items, key) {
  const measured = items.filter(
    (x) => x[key]?.value !== null && x[key]?.value !== undefined,
  );
  return {
    value: measured.length
      ? measured.reduce((sum, x) => sum + x[key].value, 0)
      : null,
    covered: measured.length,
    total: items.length,
  };
}
export function signSession(
  email,
  secret,
  now = Date.now(),
  ttlSeconds = 8 * 60 * 60,
  userId = null,
) {
  if (!secret || secret.length < 32)
    throw new Error("Session secret must contain at least 32 characters");
  const payload = Buffer.from(
    JSON.stringify({
      email,
      userId,
      exp: now + Math.min(ttlSeconds, 8 * 60 * 60) * 1000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function readSession(
  token,
  secret,
  email,
  now = Date.now(),
  expectedUserId = null,
) {
  if (!token || !secret || secret.length < 32 || !email || token.length > 2048)
    return null;
  try {
    const [payload, signature, ...rest] = token.split(".");
    if (rest.length || !payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.email === email &&
      (!expectedUserId || data.userId === expectedUserId) &&
      Number.isFinite(data.exp) &&
      data.exp > now &&
      data.exp <= now + 8 * 60 * 60 * 1000
      ? data
      : null;
  } catch {
    return null;
  }
}
export function validOrigin(request, origin) {
  if (!origin) return false;
  return request.headers.get("origin") === new URL(origin).origin;
}
export function validateSite(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid site");
  const id = String(input.id || "");
  if (!/^[a-z][a-z0-9-]{1,59}$/.test(id))
    throw new Error("Use a unique lowercase site ID");
  const name = String(input.name || "").trim();
  if (name.length < 2 || name.length > 80)
    throw new Error("Site name must be 2–80 characters");
  const repository = String(input.repository || "");
  if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Use owner/repository for GitHub");
  let url = null;
  if (input.url) {
    const u = new URL(input.url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(u.hostname) ||
      u.hostname.endsWith(".local") ||
      u.hostname.endsWith(".internal") ||
      u.hostname.endsWith(".localhost")
    )
      throw new Error("Use a public HTTPS website URL");
    url = u.origin;
  }
  const ga4Property = String(input.ga4Property || "");
  if (ga4Property && !/^\d{1,20}$/.test(ga4Property))
    throw new Error("GA4 property must be a numeric property ID");
  const vercelProject = String(input.vercelProject || "");
  if (vercelProject && !/^[a-zA-Z0-9_-]{1,100}$/.test(vercelProject))
    throw new Error("Invalid Vercel project");
  const sentryProject = String(input.sentryProject || "");
  if (sentryProject && !/^[a-z0-9_-]+\/[a-z0-9_-]+$/i.test(sentryProject))
    throw new Error("Use organization/project for Sentry");
  return {
    id,
    name,
    repository,
    url,
    ga4Property,
    vercelProject,
    sentryProject,
    category: String(input.category || "Website").slice(0, 40),
    color: "#7585ff",
    business: [],
    envPrefix: id.replaceAll("-", "_").toUpperCase(),
  };
}
