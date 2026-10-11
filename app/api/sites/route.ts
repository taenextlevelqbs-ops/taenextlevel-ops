import { session } from "@/lib/auth.mjs";
import { validateSite, validOrigin } from "@/lib/core.mjs";
import { saveSite, listSites } from "@/lib/store.mjs";
export async function GET() {
  if (!(await session()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listSites());
}
async function mutate(request: Request, editing: boolean) {
  if (!(await session()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const origin =
    process.env.COMMAND_ORIGIN ||
    (process.env.NODE_ENV !== "production"
      ? new URL(request.url).origin
      : null);
  if (!validOrigin(request, origin))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 8000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const input = JSON.parse(text);
    let site = validateSite(input);
    if (editing) {
      const registry = await listSites();
      const existing = registry.sites.find((s) => s.id === site.id);
      if (existing)
        site = {
          ...site,
          business: existing.business,
          envPrefix: existing.envPrefix,
          color: existing.color,
        };
    }
    await saveSite(site, editing);
    return Response.json({ ok: true, site });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save site";
    return Response.json({ error: message }, { status: 400 });
  }
}
export const POST = (request: Request) => mutate(request, false);
export const PATCH = (request: Request) => mutate(request, true);
