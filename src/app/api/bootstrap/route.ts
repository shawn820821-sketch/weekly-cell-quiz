import { NextResponse } from "next/server";
import { getParticipantBootstrap } from "@/server/appRepository";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getParticipantBootstrap());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load app data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
