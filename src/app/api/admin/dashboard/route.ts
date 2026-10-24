import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET() {
  try {
    await requireAdmin();
    const [people, groups, quizzes, submissions] = await Promise.all([
      supabaseRest<Array<{ id:string }>>("people?active=eq.true&select=id"),
      supabaseRest<Array<{ id:string }>>("groups?active=eq.true&select=id"),
      supabaseRest<Array<{ id:string;title:string;status:string;open_at:string|null;close_at:string|null }>>("quizzes?quiz_type=eq.WEEKLY&order=open_at.desc&limit=6&select=id,title,status,open_at,close_at"),
      supabaseRest<Array<{ quiz_id:string;person_id:string;mode:string }>>("submissions?mode=eq.OFFICIAL&select=quiz_id,person_id,mode"),
    ]);
    const now = Date.now();
    const current = quizzes.find((q) => q.open_at && q.close_at && new Date(q.open_at).getTime() <= now && now <= new Date(q.close_at).getTime()) ?? null;
    const currentSubmissions = current ? submissions.filter((s) => s.quiz_id === current.id).length : 0;
    return NextResponse.json({ activePeople: people.length, activeGroups: groups.length, currentQuiz: current, participation: { submitted: currentSubmissions, eligible: people.length }, recentQuizzes: quizzes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: message === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
