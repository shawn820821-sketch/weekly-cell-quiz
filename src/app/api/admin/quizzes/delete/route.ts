import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type QuizRow={id:string;title:string;status:string;quiz_type:string;open_at:string|null;close_at:string|null};

export async function POST(request:Request){
 try{
  await requireAdmin();
  const {quizId,confirmTitle}=await request.json() as {quizId?:string;confirmTitle?:string};
  if(!quizId||!confirmTitle)return NextResponse.json({error:"삭제할 퀴즈와 제목 확인이 필요합니다."},{status:400});
  const rows=await supabaseRest<QuizRow[]>(`quizzes?id=eq.${encodeURIComponent(quizId)}&limit=1&select=id,title,status,quiz_type,open_at,close_at`);
  const quiz=rows[0];
  if(!quiz)return NextResponse.json({error:"삭제 대상 퀴즈가 없습니다."},{status:404});
  if(quiz.title!==confirmTitle)return NextResponse.json({error:"확인한 제목과 삭제 대상이 다릅니다."},{status:409});
  if(!["DRAFT","SCHEDULED"].includes(quiz.status))
   return NextResponse.json({error:"이미 공개 중이거나 마감된 퀴즈는 삭제할 수 없습니다."},{status:409});
  if(quiz.open_at&&new Date(quiz.open_at).getTime()<=Date.now())
   return NextResponse.json({error:"공개 시작 시각이 지난 퀴즈는 삭제할 수 없습니다."},{status:409});
  const [sessions,submissions]=await Promise.all([
   supabaseRest<Array<{id:string}>>(`quiz_sessions?quiz_id=eq.${quizId}&select=id&limit=1`),
   supabaseRest<Array<{id:string}>>(`submissions?quiz_id=eq.${quizId}&select=id&limit=1`)
  ]);
  if(sessions.length||submissions.length)
   return NextResponse.json({error:"응시 기록이 있어 삭제할 수 없습니다. 기록 보존을 위해 삭제가 차단되었습니다."},{status:409});
  // The DB cascades questions when the quiz is deleted; it does not delete the import/source record.
  // Restrict the delete to a still-draft, still-future quiz to prevent a race with publishing.
  const nowIso=encodeURIComponent(new Date().toISOString());
  const filter=`quizzes?id=eq.${quizId}&status=in.(DRAFT,SCHEDULED)&or=(open_at.is.null,open_at.gt.${nowIso})&select=id`;
  const deleted=await supabaseRest<Array<{id:string}>>(filter,{method:"DELETE"});
  if(deleted.length!==1)
   return NextResponse.json({error:"상태가 변경되어 삭제되지 않았습니다. 목록을 새로고침해 주세요."},{status:409});
  return NextResponse.json({ok:true,deletedQuizId:quiz.id,title:quiz.title});
 }catch(e){
  const message=e instanceof Error?e.message:"퀴즈를 삭제하지 못했습니다.";
  return NextResponse.json({error:message},{status:message==="ADMIN_REQUIRED"?403:500});
 }
}
