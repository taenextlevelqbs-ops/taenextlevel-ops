import { jsonRequest, supabaseOrigin, ProviderError } from "./http.mjs";
import { seedSites } from "./registry.mjs";
export function databaseConfigured(env = process.env) {
  return !!(env.COMMAND_DB_URL && env.COMMAND_DB_SERVICE_KEY);
}
export async function db(
  path,
  options = {},
  env = process.env,
  fetcher = fetch,
) {
  if (!databaseConfigured(env))
    throw new ProviderError("Connect the Command Center database");
  return jsonRequest(
    `${supabaseOrigin(env.COMMAND_DB_URL)}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: env.COMMAND_DB_SERVICE_KEY,
        Authorization: `Bearer ${env.COMMAND_DB_SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
    fetcher,
  );
}
export async function listSites(env = process.env, fetcher = fetch) {
  if (!databaseConfigured(env))
    return {
      sites: seedSites,
      status: "Seed registry · database not connected",
    };
  try {
    const rows = await db(
      "command_sites?select=config&order=id.asc",
      {},
      env,
      fetcher,
    );
    if (!Array.isArray(rows)) throw new Error("Invalid registry response");
    const saved = new Map(rows.map((r) => [r.config.id, r.config]));
    return {
      sites: [
        ...seedSites.map((s) => ({ ...s, ...saved.get(s.id) })),
        ...rows
          .map((r) => r.config)
          .filter((s) => !seedSites.some((seed) => seed.id === s.id)),
      ],
      status: "Persistent registry connected",
    };
  } catch {
    return {
      sites: seedSites,
      status: "Database unavailable · showing seed registry",
    };
  }
}
export async function saveSite(
  site,
  editing = false,
  env = process.env,
  fetcher = fetch,
) {
  // Insert rejects duplicate IDs. Editing requires an existing registry ID or one of the seed IDs.
  if (editing) {
    const { sites } = await listSites(env, fetcher);
    if (!sites.some((s) => s.id === site.id))
      throw new ProviderError("Site does not exist");
    return db(
      "command_sites?on_conflict=id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: site.id, config: site }),
      },
      env,
      fetcher,
    );
  }
  const { sites } = await listSites(env, fetcher);
  if (sites.some((s) => s.id === site.id))
    throw new ProviderError("This site ID already exists");
  return db(
    "command_sites",
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: site.id, config: site }),
    },
    env,
    fetcher,
  );
}
