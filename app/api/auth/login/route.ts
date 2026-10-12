import { NextResponse } from "next/server";
import { login } from "@/lib/login.mjs";
import { COOKIE } from "@/lib/auth.mjs";
export async function POST(request: Request) {
  const result = await login(request);
  if (result.diagnostic)
    console.error(`[command-auth] ${result.diagnostic}`);
  const response = NextResponse.json(
    result.status === 200 ? { ok: true } : { error: result.error },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
  if (result.token)
    response.cookies.set(COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: result.expiresIn,
    });
  return response;
}
