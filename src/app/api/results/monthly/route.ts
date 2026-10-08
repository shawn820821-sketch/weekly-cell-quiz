import { NextResponse } from "next/server";
import { getMonthlyResult } from "@/server/resultRepository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const quizId = url.searchParams.get("quizId");
    const personId = url.searchParams.get("personId");
    if (!quizId || !personId) return NextResponse.json({ error: "quizId and personId are required." }, { status: 400 });
    return NextResponse.json(await getMonthlyResult(quizId, personId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load monthly result.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
