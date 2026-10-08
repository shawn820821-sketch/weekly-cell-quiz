import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { assertOfficialWindow, assignQuestionIds, createSession, findOfficialSession, findUnfinishedOfficialSession, getCurrentGroupId, getOfficialAttemptCount, getQuestionsByIds, getQuiz, getSelectedQuestions, getSpecialSetting, hasSpecialPass } from "@/server/quizRepository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { quizId?: string; personId?: string; mode?: "OFFICIAL" | "PRACTICE" | "TEST" };
    if (!body.quizId || !body.personId) return NextResponse.json({ error: "quizId and personId are required." }, { status: 400 });
    const mode=body.mode??"OFFICIAL"; if(mode==="TEST")await requireAdmin(); const quiz=await getQuiz(body.quizId); const groupId=await getCurrentGroupId(body.personId); let session:any; let resumed=false; let attemptNo=1;
    if(mode==="OFFICIAL"){
      if(quiz.quiz_type==="WEEKLY"){
        const existing=await findOfficialSession(body.quizId,body.personId); if(existing){session=existing;resumed=true;} else assertOfficialWindow(quiz);
      } else {
        const unfinished=await findUnfinishedOfficialSession(body.quizId,body.personId);
        if(unfinished){session=unfinished;resumed=true;attemptNo=unfinished.attempt_no??1;}
        else {
          assertOfficialWindow(quiz);
          const setting=await getSpecialSetting(body.quizId); const attempts=await getOfficialAttemptCount(body.quizId,body.personId); const passed=await hasSpecialPass(body.quizId,body.personId);
          if(passed) return NextResponse.json({error:"이미 PASS한 Special Quiz입니다."},{status:409});
          if(setting?.retry_mode==="NONE" && attempts>=1) return NextResponse.json({error:"이 Special Quiz는 재도전할 수 없습니다."},{status:409});
          if(setting?.retry_mode==="MAX_ATTEMPTS" && attempts>=(setting.max_attempts??1)) return NextResponse.json({error:"최대 도전 횟수를 모두 사용했습니다."},{status:409});
          attemptNo=attempts+1;
        }
      }
    }
    if(!session){ const candidates=await getSelectedQuestions(body.quizId,groupId); const assignedQuestionIds=assignQuestionIds(quiz,candidates); session=await createSession({quiz_id:body.quizId,person_id:body.personId,mode,group_id_snapshot:groupId,assigned_question_ids:assignedQuestionIds,attempt_no:attemptNo}); }
    const rows=await getQuestionsByIds(session.assigned_question_ids); const map=new Map(rows.map(q=>[q.id,q]));
    const questions=session.assigned_question_ids.map((id:string)=>{const q=map.get(id);if(!q)throw new Error("Frozen question set is incomplete.");return{id:q.id,type:q.question_type,text:q.prompt,source:q.source_label??"",choices:q.choices};});
    return NextResponse.json({session,questions,resumed,quizType:quiz.quiz_type});
  }catch(error){const message=error instanceof Error?error.message:"Unable to start quiz."; const conflict=/unique|duplicate/i.test(message); return NextResponse.json({error:message},{status:conflict?409:400});}
}
