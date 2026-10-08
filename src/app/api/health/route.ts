import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/env";

export async function GET() {
  const env = getEnvStatus();
  return NextResponse.json(
    {
      ok: env.ok,
      app: "weekly-cell-quiz",
      version: "1.1.2",
      env: { ok: env.ok, missing: env.missing },
      timestamp: new Date().toISOString(),
    },
    { status: env.ok ? 200 : 503 },
  );
}
