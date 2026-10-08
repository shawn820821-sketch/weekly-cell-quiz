import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { findSubmissionForSession,getQuestionsByIds,getQuiz,getSession,getSpecialSetting,saveSpecialPass,saveSubmission } from "@/server/quizRepository";
import { supabaseRest } from "@/lib/supabase/rest";
export const runtime="nodejs"; type SubmittedAnswer={questionId:string;selectedIndex:number|null};
async function resultVerse(quizId:string){
 const direct=await supabaseRest<any[]>(`quiz_result_verses?quiz_id=eq.${quizId}&order=sort_order.asc&select=verse_text,reference`);
 const pool=direct.length?direct:await supabaseRest<any[]>("common_result_verses?active=eq.true&order=sort_order.asc&select=verse_text,reference");
 if(!pool.length)return null;const row=pool[Math.floor(Math.random()*pool.length)];return{text:row.verse_text,reference:row.reference};
}
export async function POST(request:Request){try{const body=(await request.json()) as {sessionId?:string;answers?:SubmittedAnswer[]};if(!body.sessionId||!Array.isArray(body.answers))return NextResponse.json({error:"sessionId and answers are required."},{status:400});
 const session=await getSession(body.sessionId);if(session.mode==="TEST")await requireAdmin();const questionRows=await getQuestionsByIds(session.assigned_question_ids);const questionMap=new Map(questionRows.map(q=>[q.id,q]));if(questionRows.length!==session.assigned_question_ids.length)throw new Error("Frozen question set is incomplete.");
 const existing=await findSubmissionForSession(body.sessionId);const submittedMap=new Map(body.answers.map(a=>[a.questionId,a.selectedIndex]));const answerRows=session.assigned_question_ids.map(id=>{const q=questionMap.get(id)!;const selectedIndex=submittedMap.has(id)?submittedMap.get(id)!:null;return{question_id:id,selected_index:selectedIndex,is_correct:selectedIndex===q.correct_index};});
 const correctCount=answerRows.filter(a=>a.is_correct).length;const questionCount=answerRows.length;if(!questionCount)throw new Error("Cannot submit an empty quiz.");const score=Math.round((correctCount/questionCount)*100);const stored=existing??await saveSubmission({session,correctCount,questionCount,score,answers:answerRows});
 const quiz=await getQuiz(session.quiz_id);let special:any=null;let reviewAllowed=true;let reviewMessage:string|null=null;
 if(quiz.quiz_type==="SPECIAL"&&session.mode==="OFFICIAL"){const setting=await getSpecialSetting(session.quiz_id);const passed=setting?.special_mode==="PASS"?score>=(setting.pass_score??80):false;if(passed)await saveSpecialPass({quizId:session.quiz_id,personId:session.person_id,submissionId:stored.id,score,issuePass:Boolean(setting?.issue_pass)});
  const mode=setting?.answer_reveal_mode??"IMMEDIATE"; const now=Date.now(); reviewAllowed=mode==="IMMEDIATE"||(mode==="AFTER_PASS"&&passed)||(mode==="AFTER_END"&&Boolean(quiz.close_at)&&now>=new Date(quiz.close_at!).getTime())||(mode==="AT_TIME"&&Boolean(setting?.answer_reveal_at)&&now>=new Date(setting!.answer_reveal_at!).getTime());
  reviewMessage=mode==="AFTER_PASS"?"PASS 후 정답이 공개됩니다.":mode==="AFTER_END"?"Special Quiz 종료 후 정답이 공개됩니다.":mode==="AT_TIME"?`정답 공개 예정: ${setting?.answer_reveal_at??"지정시간"}`:null;
  special={mode:setting?.special_mode??"NORMAL",passScore:setting?.pass_score??80,passed,attemptNo:session.attempt_no??1,issuePass:Boolean(setting?.issue_pass),message:setting?.custom_pass_message??null};}
 const result={correct:stored.correct_count,total:stored.question_count,score:stored.score,submittedAt:stored.submitted_at,verse:await resultVerse(session.quiz_id)};
 const reviewQuestions=reviewAllowed?session.assigned_question_ids.map(id=>{const q=questionMap.get(id)!;return{id:q.id,type:q.question_type,text:q.prompt,source:q.source_label??"",choices:q.choices,answerIndex:q.correct_index,explanation:q.explanation};}):[];
 return NextResponse.json({result,reviewQuestions,reviewAllowed,reviewMessage,duplicate:Boolean(existing),special});
}catch(error){const message=error instanceof Error?error.message:"Unable to submit quiz.";const conflict=/unique|duplicate/i.test(message);return NextResponse.json({error:message},{status:conflict?409:400});}}
