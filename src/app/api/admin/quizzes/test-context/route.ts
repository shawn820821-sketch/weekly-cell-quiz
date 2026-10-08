import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type QuizRow={id:string;title:string;subtitle:string|null;life_date_range:string|null;bible_range:string|null;published_question_count:number|null;random_question_count:number|null;selection_mode:"FIXED"|"RANDOM";status:string};
export async function GET(request:Request){
 try{
  await requireAdmin();
  const quizId=new URL(request.url).searchParams.get("quizId");
  if(!quizId)return NextResponse.json({error:"quizId가 필요합니다."},{status:400});
  const [quizzes,questions]=await Promise.all([
   supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&limit=1&select=id,title,subtitle,life_date_range,bible_range,published_question_count,random_question_count,selection_mode,status`),
   supabaseRest<Array<{id:string}>>(`questions?quiz_id=eq.${quizId}&selected=eq.true&select=id`)
  ]);
  const quiz=quizzes[0];if(!quiz)return NextResponse.json({error:"퀴즈를 찾을 수 없습니다."},{status:404});
  if(!questions.length)return NextResponse.json({error:"선택 저장된 문제가 없습니다. 먼저 출제 문제를 선택해주세요."},{status:409});
  return NextResponse.json({quiz:{...quiz,published_question_count:quiz.selection_mode==="RANDOM"?(quiz.random_question_count??questions.length):questions.length},selectedCount:questions.length});
 }catch(e){const m=e instanceof Error?e.message:"테스트 퀴즈를 불러오지 못했습니다.";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
