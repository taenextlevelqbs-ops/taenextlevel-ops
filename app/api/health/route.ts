export function GET() {
  return Response.json(
    { service: "digital-command-center", status: "running" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
