import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class ProviderError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "ProviderError";
  }
}
export async function jsonRequest(url, options = {}, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(url, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
  } catch {
    throw new ProviderError("Service unreachable or timed out");
  }
  if (!response.ok)
    throw new ProviderError(
      response.status === 401 || response.status === 403
        ? "Access denied — check credentials and permissions"
        : response.status === 429
          ? "Provider rate limit reached"
          : `Provider request failed (HTTP ${response.status})`,
    );
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new ProviderError("Provider returned an invalid response");
  }
}
export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 2) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0)
    );
  }
  if (isIP(address) === 6) {
    // Accept only global unicast, rejecting mapped IPv4, loopback, link-local and private addresses.
    const a = address.toLowerCase();
    return (
      /^[23][0-9a-f]{3}:/.test(a) &&
      !a.startsWith("2001:db8:") &&
      !a.startsWith("2001:0:") &&
      !a.startsWith("2002:")
    );
  }
  return false;
}
export async function checkPublicUrl(raw, resolver = lookup) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isIP(url.hostname) ||
    !url.hostname.includes(".") ||
    /\.(local|internal|localhost)$/i.test(url.hostname)
  )
    throw new ProviderError("Only public HTTPS sites can be monitored");
  const addresses = await resolver(url.hostname, { all: true });
  if (!addresses.length || addresses.some((x) => !isPublicAddress(x.address)))
    throw new ProviderError("Private or reserved network targets are blocked");
  return url;
}
export function supabaseOrigin(raw) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)
  )
    throw new ProviderError("Configure a hosted Supabase project URL");
  return u.origin;
}
