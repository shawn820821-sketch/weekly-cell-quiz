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


export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { questionId?: string; quizId?: string };
    if (!body.questionId || !body.quizId) return NextResponse.json({ error: "삭제할 문제 정보가 필요합니다." }, { status: 400 });

    const quizzes = await supabaseRest<Array<{id:string;status:string;selection_mode:string;random_question_count:number|null}>>(
      `quizzes?id=eq.${body.quizId}&select=id,status,selection_mode,random_question_count`
    );
    const quiz = quizzes[0];
    if (!quiz) return NextResponse.json({ error: "퀴즈를 찾지 못했습니다." }, { status: 404 });
    if (["OPEN","CLOSED"].includes(quiz.status)) return NextResponse.json({ error: "공개 중이거나 마감된 퀴즈의 문제는 삭제할 수 없습니다." }, { status: 409 });

    await supabaseRest(`questions?id=eq.${body.questionId}&quiz_id=eq.${body.quizId}`, { method: "DELETE" });

    const remaining = await supabaseRest<Array<{id:string}>>(
      `questions?quiz_id=eq.${body.quizId}&selected=eq.true&select=id`
    );
    const selectedCount = remaining.length;
    const nextRandom = quiz.selection_mode === "RANDOM"
      ? Math.min(Number(quiz.random_question_count ?? selectedCount), selectedCount)
      : null;
    await supabaseRest(`quizzes?id=eq.${body.quizId}`, {
      method: "PATCH",
      body: JSON.stringify({
        published_question_count: quiz.selection_mode === "RANDOM" ? nextRandom : selectedCount,
        random_question_count: nextRandom
      })
    });

    return NextResponse.json({ ok: true, selectedCount });
  } catch (error) {
    const m = error instanceof Error ? error.message : "문제 삭제 실패";
    return NextResponse.json({ error: m }, { status: m === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
