import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type QuizRow={id:string;status:string};
type CountRow={id:string};

export async function POST(request:Request){
 try{
  await requireAdmin();
  const {quizId,openAt,closeAt}=await request.json() as {quizId?:string;openAt?:string;closeAt?:string};
  if(!quizId||!openAt||!closeAt)return NextResponse.json({error:"퀴즈와 공개 기간을 확인해주세요."},{status:400});
  const open=new Date(openAt), close=new Date(closeAt);
  if(Number.isNaN(open.getTime())||Number.isNaN(close.getTime()))return NextResponse.json({error:"공개 시작/마감 시간이 올바르지 않습니다."},{status:400});
  if(close<=open)return NextResponse.json({error:"마감 시간은 공개 시작보다 뒤여야 합니다."},{status:400});
  const [quiz,selected]=await Promise.all([
   supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&limit=1&select=id,status`),
   supabaseRest<CountRow[]>(`questions?quiz_id=eq.${quizId}&selected=eq.true&select=id`),
  ]);
  if(!quiz[0])return NextResponse.json({error:"퀴즈를 찾을 수 없습니다."},{status:404});
  if(selected.length===0)return NextResponse.json({error:"공개할 문제를 먼저 선택 저장해주세요."},{status:409});
  const status=open.getTime()>Date.now()?"SCHEDULED":"OPEN";
  await supabaseRest(`quizzes?id=eq.${quizId}`,{method:"PATCH",body:JSON.stringify({status,open_at:open.toISOString(),close_at:close.toISOString(),published_question_count:selected.length})});
  return NextResponse.json({ok:true,status,selectedCount:selected.length,openAt:open.toISOString(),closeAt:close.toISOString()});
 }catch(e){const m=e instanceof Error?e.message:"퀴즈 공개 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}