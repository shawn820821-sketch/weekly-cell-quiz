import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET() {
  try {
    await requireAdmin();
    const rows=await supabaseRest<any[]>("quizzes?order=created_at.desc&select=*");
    const now=Date.now();
    const quizzes=rows.map(q=>{
      if(q.quiz_type!=="WEEKLY"||q.status==="DRAFT"||!q.open_at||!q.close_at)return q;
      const open=new Date(q.open_at).getTime(),close=new Date(q.close_at).getTime();
      return {...q,status:now<open?"SCHEDULED":now<=close?"OPEN":"CLOSED"};
    });
    return NextResponse.json({quizzes});
  }
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
