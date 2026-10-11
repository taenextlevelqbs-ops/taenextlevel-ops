import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/core.mjs";

// Fail before rendering/streaming; pages and APIs also enforce the session independently.
export function proxy(request: NextRequest) {
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
  if (owner) return NextResponse.next();
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/", "/sites/:path*", "/settings/:path*", "/api/sites/:path*"],
};
