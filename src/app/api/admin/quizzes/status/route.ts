import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function POST(request:Request){
 try{
  await requireAdmin();
  const {quizId,action}=await request.json() as {quizId?:string;action?:"CLOSE"|"DRAFT"};
  if(!quizId||!action)return NextResponse.json({error:"퀴즈와 변경 상태를 확인해주세요."},{status:400});
  const rows=await supabaseRest<Array<{id:string;status:string}>>(`quizzes?id=eq.${quizId}&limit=1&select=id,status`);
  if(!rows[0])return NextResponse.json({error:"퀴즈를 찾을 수 없습니다."},{status:404});
  if(action==="CLOSE"){await supabaseRest(`quizzes?id=eq.${quizId}`,{method:"PATCH",body:JSON.stringify({status:"CLOSED",close_at:new Date().toISOString()})});return NextResponse.json({ok:true,status:"CLOSED"});}
  await supabaseRest(`quizzes?id=eq.${quizId}`,{method:"PATCH",body:JSON.stringify({status:"DRAFT",open_at:null,close_at:null})});
  return NextResponse.json({ok:true,status:"DRAFT"});
 }catch(e){const m=e instanceof Error?e.message:"상태 변경 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
