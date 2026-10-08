import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const quizId = new URL(request.url).searchParams.get("quizId");
    if (!quizId) return NextResponse.json({ error: "quizId가 필요합니다." }, { status: 400 });
    const questions = await supabaseRest(`questions?quiz_id=eq.${quizId}&order=sort_order.asc&select=id,sort_order,question_type,prompt,choices,correct_index,explanation,source_label,bible_range,difficulty,selected`);
    return NextResponse.json({ questions });
  } catch (error) {
    const m = error instanceof Error ? error.message : "문제를 불러오지 못했습니다.";
    return NextResponse.json({ error: m }, { status: m === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (!body.quizId || !body.prompt || !Array.isArray(body.choices) || body.choices.length < 2) return NextResponse.json({ error: "문제 내용을 확인해주세요." }, { status: 400 });
    const question = await supabaseRest("questions", { method: "POST", body: JSON.stringify({ quiz_id: body.quizId, sort_order: Number(body.sortOrder ?? 0), question_type: body.questionType ?? "MCQ", prompt: body.prompt, choices: body.choices, correct_index: Number(body.correctIndex ?? 0), explanation: body.explanation ?? "", source_label: body.sourceLabel ?? null, bible_range: body.bibleRange ?? null, difficulty: body.difficulty ?? "MEDIUM", selected: body.selected ?? false }) });
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const m = error instanceof Error ? error.message : "문제 저장 실패";
    return NextResponse.json({ error: m }, { status: m === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
