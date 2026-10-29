import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, renewSession } from "@/lib/refresh.mjs";
import { readSession } from "@/lib/core.mjs";

// Fail before rendering/streaming; pages and APIs also enforce the session independently.
export async function proxy(request: NextRequest) {
  const ownerId = process.env.COMMAND_OWNER_USER_ID;
  const owner = ownerId
    ? readSession(
        request.cookies.get("command_session")?.value,
        process.env.COMMAND_SESSION_SECRET,
        process.env.COMMAND_ADMIN_EMAIL || "takwancrews@gmail.com",
        Date.now(),
        ownerId,
      )
    : null;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh && (!owner || owner.exp - Date.now() < 300000)) {
    const renewed = await renewSession(refresh);
    if (renewed) {
      request.cookies.set("command_session", renewed.token);
      request.cookies.set(REFRESH_COOKIE, renewed.refresh);
      const headers = new Headers(request.headers);
      headers.set("cookie", request.cookies.toString());
      const response = NextResponse.next({ request: { headers } });
      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        path: "/",
      };
      response.cookies.set("command_session", renewed.token, {
        ...options,
        maxAge: renewed.expiresIn,
      });
      response.cookies.set(REFRESH_COOKIE, renewed.refresh, {
        ...options,
        maxAge: renewed.refreshTtl,
      });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  if (owner) return NextResponse.next();
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/",
    "/sites/:path*",
    "/settings/:path*",
    "/businesses/:path*",
    "/calendar/:path*",
    "/payments/:path*",
    "/alerts/:path*",
    "/api/sites/:path*",
  ],
};
