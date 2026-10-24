import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase/rest";
import { getMonthlyResult, getWeeklyResult } from "@/server/resultRepository";
import { settlementMonthForDate,settlementMonthForQuiz } from "@/lib/monthlyCycle";

type Quiz={id:string;title:string;status:string;open_at:string|null;close_at:string|null;content_month_key:string|null};

export const runtime="nodejs";
export async function GET(request:Request){
 try{
  const personId=new URL(request.url).searchParams.get("personId");
  if(!personId)return NextResponse.json({error:"personId required"},{status:400});
  const now=Date.now();
  const month=settlementMonthForDate(new Date());
  const quizzes=await supabaseRest<Quiz[]>("quizzes?quiz_type=eq.WEEKLY&status=neq.DRAFT&order=open_at.desc&limit=50&select=id,title,status,open_at,close_at,content_month_key");
  const lastClosed=quizzes.find(q=>q.close_at&&new Date(q.close_at).getTime()<now)??null;
  const monthQuiz=quizzes.find(q=>settlementMonthForQuiz(q.close_at)===month&&q.open_at&&new Date(q.open_at).getTime()<=now)
    ??quizzes.find(q=>settlementMonthForQuiz(q.close_at)===month)??null;
  const next=quizzes.filter(q=>q.open_at&&new Date(q.open_at).getTime()>now)
    .sort((a,b)=>new Date(a.open_at!).getTime()-new Date(b.open_at!).getTime())[0]??null;
  const [weekly,monthly]=await Promise.all([
   lastClosed?getWeeklyResult(lastClosed.id,personId):Promise.resolve(null),
   monthQuiz?getMonthlyResult(monthQuiz.id,personId):Promise.resolve(null)
  ]);
  return NextResponse.json({weekly:weekly?{...weekly,label:lastClosed?.title+" · 최종 순위"}:null,
   weeklyQuiz:lastClosed?{id:lastClosed.id,title:lastClosed.title}:null,
   monthly,month,nextQuiz:next?{id:next.id,title:next.title,openAt:next.open_at}:null});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:"결과를 불러오지 못했습니다."},{status:500});
 }
}
