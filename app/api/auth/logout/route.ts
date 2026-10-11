import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth.mjs";
import { validOrigin } from "@/lib/core.mjs";
export async function POST(request: Request) {
  const origin =
    process.env.COMMAND_ORIGIN ||
    (process.env.NODE_ENV !== "production"
      ? new URL(request.url).origin
      : null);
  if (!validOrigin(request, origin))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
