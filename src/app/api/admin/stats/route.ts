import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function GET(){
 try{
  await requireAdmin();
  const quizzes=await supabaseRest<Array<{id:string;title:string;status:string}>>("quizzes?quiz_type=eq.WEEKLY&order=open_at.desc&limit=1&select=id,title,status");
  const quiz=quizzes[0]??null;if(!quiz)return NextResponse.json({quiz:null,participation:0,average:null,questions:[]});
  const subs=await supabaseRest<Array<{id:string;score:number}>>(`submissions?quiz_id=eq.${quiz.id}&mode=eq.OFFICIAL&select=id,score`);
  const ids=subs.map(s=>s.id);
  const questions=await supabaseRest<Array<{id:string;prompt:string;sort_order:number}>>(`questions?quiz_id=eq.${quiz.id}&selected=eq.true&order=sort_order.asc&select=id,prompt,sort_order`);
  const answers=ids.length?await supabaseRest<Array<{question_id:string;is_correct:boolean}>>(`answers?submission_id=in.(${ids.join(",")})&select=question_id,is_correct`):[];
  const qstats=questions.map(q=>{const rows=answers.filter(a=>a.question_id===q.id);const correct=rows.filter(a=>a.is_correct).length;return {id:q.id,prompt:q.prompt,total:rows.length,correct,rate:rows.length?Math.round(correct/rows.length*100):null};});
  const avg=subs.length?Math.round(subs.reduce((s,x)=>s+x.score,0)/subs.length):null;
  return NextResponse.json({quiz,participation:subs.length,average:avg,questions:qstats});
 }catch(error){const message=error instanceof Error?error.message:"통계를 불러오지 못했습니다.";return NextResponse.json({error:message},{status:message==="ADMIN_REQUIRED"?403:500});}
}
