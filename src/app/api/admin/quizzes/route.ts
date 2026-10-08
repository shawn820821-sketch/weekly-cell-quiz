import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET() {
  try { await requireAdmin(); return NextResponse.json({ quizzes: await supabaseRest("quizzes?order=created_at.desc&select=*") }); }
  catch (error) { const m = error instanceof Error ? error.message : "오류"; return NextResponse.json({ error:m }, { status:m === "ADMIN_REQUIRED" ? 403 : 500 }); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const quiz = await supabaseRest("quizzes", { method: "POST", body: JSON.stringify({ title: body.title, subtitle: body.subtitle ?? null, quiz_type: body.quizType ?? "WEEKLY", status: "DRAFT", selection_mode: body.selectionMode ?? "FIXED", random_question_count: body.selectionMode === "RANDOM" ? Number(body.randomQuestionCount ?? 10) : null, published_question_count: Number(body.publishedQuestionCount ?? 10), life_date_range: body.lifeDateRange ?? null, bible_range: body.bibleRange ?? null, open_at: body.openAt ?? null, close_at: body.closeAt ?? null, created_by: admin.personId }) });
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) { const m = error instanceof Error ? error.message : "Quiz 생성 실패"; return NextResponse.json({ error:m }, { status:m === "ADMIN_REQUIRED" ? 403 : 500 }); }
}
