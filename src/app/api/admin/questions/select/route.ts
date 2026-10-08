import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { quizId, selectedQuestionIds, selectionMode, randomQuestionCount } = await request.json() as { quizId?:string; selectedQuestionIds?:string[]; selectionMode?:"FIXED"|"RANDOM"; randomQuestionCount?:number };
    if (!quizId || !selectedQuestionIds?.length) return NextResponse.json({ error:"선택된 문제가 없습니다." }, { status:400 });
    await supabaseRest(`questions?quiz_id=eq.${quizId}`, { method:"PATCH", body:JSON.stringify({ selected:false }) });
    for (const id of selectedQuestionIds) await supabaseRest(`questions?id=eq.${id}&quiz_id=eq.${quizId}`, { method:"PATCH", body:JSON.stringify({ selected:true }) });
    const mode = selectionMode ?? "FIXED";
    const count = mode === "RANDOM" ? Number(randomQuestionCount ?? 10) : null;
    if (mode === "RANDOM" && (!count || count > selectedQuestionIds.length)) return NextResponse.json({ error:"랜덤 출제 수는 선택 문제 수보다 많을 수 없습니다." }, { status:400 });
    await supabaseRest(`quizzes?id=eq.${quizId}`, { method:"PATCH", body:JSON.stringify({ selection_mode:mode, random_question_count:count, published_question_count: mode === "FIXED" ? selectedQuestionIds.length : count }) });
    return NextResponse.json({ ok:true, selectedCount:selectedQuestionIds.length, publishedCount: mode === "FIXED" ? selectedQuestionIds.length : count });
  } catch (error) { const m = error instanceof Error ? error.message : "문제 선택 저장 실패"; return NextResponse.json({ error:m }, { status:m === "ADMIN_REQUIRED" ? 403 : 500 }); }
}
