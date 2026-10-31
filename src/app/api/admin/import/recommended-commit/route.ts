import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
import { parseRecommendedWorkbook } from "@/server/recommendedImport";
import { inspectRecommendedConflicts } from "@/server/recommendedImportServer";

export const runtime="nodejs";
type CreatedQuiz={id:string;title:string;open_at:string};
type RowQuestion={id:string;quiz_id:string;selected:boolean};
export async function POST(request:Request){
 let importId:string|null=null;
 let createdQuizIds:string[]=[];
 let completed=false;
 try{
  const admin=await requireAdmin();
  const form=await request.formData();
  const file=form.get("file"),expectedHash=String(form.get("sourceHash")??"");
  if(!(file instanceof File)||!/\.xlsx$/i.test(file.name)||!/^[a-f0-9]{64}$/.test(expectedHash))
   return NextResponse.json({error:"미리보기한 Excel 파일과 확인 코드가 필요합니다."},{status:400});
  const book=parseRecommendedWorkbook(Buffer.from(await file.arrayBuffer()));
  if(book.hash!==expectedHash)
   return NextResponse.json({error:"미리보기한 파일과 현재 파일이 다릅니다. 다시 확인해주세요."},{status:409});
  if(book.weeks.some(w=>Date.parse(w.openAt)<=Date.now()+5*60*1000))
   return NextResponse.json({error:"공개가 시작되었거나 5분 이내 시작하는 퀴즈는 자동 재등록하지 않습니다."},{status:409});
  const conflicts=await inspectRecommendedConflicts(book.weeks);
  if(conflicts.length)
   return NextResponse.json({error:"기존 퀴즈와 공개일이 중복됩니다. 지정된 4개 주차를 먼저 삭제하고 미리보기를 다시 실행하세요.",conflicts},{status:409});

  // No current data or reservations are deleted by this endpoint.
  // All writes create NEW records in DRAFT, then one final batch publishes SCHEDULED.
  const imports=await supabaseRest<Array<{id:string}>>(
   "content_imports?select=id",
   {method:"POST",body:JSON.stringify({
    source_name:file.name,source_hash:book.hash,month_key:book.weeks[0].monthKey,
    mode:"NEW",status:"PENDING",created_by:admin.personId,
    summary:{kind:"RECOMMENDED_AUTOSCHEDULE_V4",weeks:book.weeks.length,candidates:book.totalCandidates,
     selected:book.totalSelected,openDates:book.weeks.map(w=>w.openDate)}
   })}
  );
  importId=imports[0]?.id??null;
  if(!importId)throw new Error("Import 기록 생성에 실패했습니다.");

  const incomingQuizzes=book.weeks.map(w=>({
   title:w.title,quiz_type:"WEEKLY",status:"DRAFT",selection_mode:"FIXED",
   published_question_count:10,random_question_count:null,
   life_date_range:w.lifeDateRange,bible_range:w.bibleRange,
   open_at:w.openAt,close_at:w.closeAt,content_month_key:w.monthKey,
   content_week_index:w.weekIndex,count_in_monthly:true,
   created_by:admin.personId,import_id:importId
  }));
  const created=await supabaseRest<CreatedQuiz[]>(
   "quizzes?select=id,title,open_at",
   {method:"POST",body:JSON.stringify(incomingQuizzes)}
  );
  createdQuizIds=created.map(q=>q.id);
  if(created.length!==book.weeks.length||new Set(createdQuizIds).size!==book.weeks.length)
   throw new Error("퀴즈 생성 결과가 주차 수와 일치하지 않습니다.");

  const quizByDate=new Map(created.map(q=>[Date.parse(q.open_at),q.id]));
  const questions=book.weeks.flatMap(w=>{
   const quizId=quizByDate.get(Date.parse(w.openAt));
   if(!quizId)throw new Error(w.sheet+" 퀴즈 ID 연결 실패");
   return w.questions.map(q=>({
    quiz_id:quizId,sort_order:q.no,candidate_order:q.no,question_type:q.questionType,
    prompt:q.prompt,choices:q.choices,correct_index:q.correctIndex,
    explanation:q.explanation,hint:q.hint,bible_range:q.bibleRange,difficulty:q.difficulty,
    note:q.note,selected:q.selected,import_id:importId
   }));
  });
  await supabaseRest<Array<{id:string}>>("questions?select=id",
   {method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(questions)});
  const check=await supabaseRest<RowQuestion[]>(
   "questions?quiz_id=in.("+createdQuizIds.join(",")+")&select=id,quiz_id,selected");
  for(const quizId of createdQuizIds){
   const group=check.filter(q=>q.quiz_id===quizId);
   if(group.length!==15||group.filter(q=>q.selected).length!==10)
    throw new Error("등록 확인 실패: "+quizId+" (후보 "+group.length+"개, 선택 "+group.filter(q=>q.selected).length+"개)");
  }
  // Pre-commit as audit trail. The final DB statement sets all four statuses at once.
  await supabaseRest("content_imports?id=eq."+importId,
   {method:"PATCH",body:JSON.stringify({status:"COMMITTED"})});
  const published=await supabaseRest<Array<{id:string;status:string}>>(
   "quizzes?id=in.("+createdQuizIds.join(",")+")&status=eq.DRAFT&select=id,status",
   {method:"PATCH",body:JSON.stringify({status:"SCHEDULED"})}
  );
  if(published.length!==book.weeks.length||published.some(q=>q.status!=="SCHEDULED"))
   throw new Error("최종 자동예약 결과가 4개 주차와 일치하지 않습니다.");
  completed=true;
  return NextResponse.json({
   ok:true,status:"SCHEDULED",importId,createdQuizIds,
   weeks:book.weeks.map(w=>({title:w.title,openAt:w.openAt,closeAt:w.closeAt,selectedCount:10,candidateCount:15})),
   totalCandidates:book.totalCandidates,totalSelected:book.totalSelected,warnings:book.warnings
  });
 }catch(e){
  const message=e instanceof Error?e.message:"추천 자동예약 등록 실패";
  let rollbackFailed=false;
  if(!completed&&createdQuizIds.length){
   try{
    // Delete ONLY IDs created by this request, never existing scheduled quizzes.
    await supabaseRest("quizzes?id=in.("+createdQuizIds.join(",")+")&status=in.(DRAFT,SCHEDULED)",
     {method:"DELETE"});
   }catch{rollbackFailed=true;}
  }
  if(!completed&&importId&&!rollbackFailed){
   try{await supabaseRest("content_imports?id=eq."+importId,{method:"DELETE"});}
   catch{rollbackFailed=true;}
  }
  return NextResponse.json({error:message+(rollbackFailed?" (자동 정리 실패: 관리자 목록을 확인하세요.)":""),
   rollbackFailed,importId:rollbackFailed?importId:undefined},
   {status:message==="ADMIN_REQUIRED"?403:409});
 }
}
