import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type Q={no:number;questionType:"MCQ"|"OX";prompt:string;choices:string[];correctAnswer:string;explanation:string;bibleRange:string;difficulty:string;note:string};
type Week={sheetName:string;title:string;lifeDateRange:string;bibleRange:string;openAt:string;closeAt:string;questions:Q[];errors:string[]};
export async function POST(request:Request){
 try{
  const admin=await requireAdmin(); const body=await request.json() as {fileName:string;sourceHash:string;monthKey?:string;mode:"NEW"|"REPLACE";replaceImportId?:string|null;weeks:Week[]};
  if(!body.fileName||!body.sourceHash||!body.weeks?.length)return NextResponse.json({error:"Import 데이터가 부족합니다."},{status:400});
  if(body.weeks.some(w=>w.errors.some(e=>!e.includes("권장"))))return NextResponse.json({error:"오류가 있는 파일은 등록할 수 없습니다."},{status:400});
  if(body.mode==="REPLACE"){
    if(!body.replaceImportId)return NextResponse.json({error:"교체할 기존 Import ID가 필요합니다."},{status:400});
    const oldQuestions=await supabaseRest<Array<{quiz_id:string}>>(`questions?import_id=eq.${body.replaceImportId}&select=quiz_id`); const ids=[...new Set(oldQuestions.map(x=>x.quiz_id))];
    if(ids.length){const oldQuizzes=await supabaseRest<Array<{id:string;status:string}>>(`quizzes?id=in.(${ids.join(",")})&select=id,status`);if(oldQuizzes.some(q=>["OPEN","CLOSED"].includes(q.status)))return NextResponse.json({error:"이미 공개되었거나 마감된 퀴즈가 포함되어 있어 파일 교체가 불가능합니다."},{status:409});await supabaseRest(`quizzes?id=in.(${ids.join(",")})`,{method:"DELETE"});}
    await supabaseRest(`content_imports?id=eq.${body.replaceImportId}`,{method:"PATCH",body:JSON.stringify({status:"REPLACED"})});
  }
  const imports=await supabaseRest<Array<{id:string}>>("content_imports?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({source_name:body.fileName,source_hash:body.sourceHash,month_key:body.monthKey||null,mode:body.mode,replaces_import_id:body.replaceImportId||null,status:"COMMITTED",created_by:admin.personId,summary:{weeks:body.weeks.length,questions:body.weeks.reduce((n,w)=>n+w.questions.length,0)}})});
  const importId=imports[0]?.id;if(!importId)throw new Error("Import 기록 생성에 실패했습니다.");const createdQuizIds:string[]=[];
  for(const w of body.weeks.filter(w=>w.questions.length)){
    const qs=await supabaseRest<Array<{id:string}>>("quizzes?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({title:w.title,quiz_type:"WEEKLY",status:"DRAFT",life_date_range:w.lifeDateRange||null,bible_range:w.bibleRange||null,open_at:w.openAt||null,close_at:w.closeAt||null,selection_mode:"FIXED"})});
    const quizId=qs[0]?.id;if(!quizId)continue;createdQuizIds.push(quizId);
    const payload=w.questions.map((q,i)=>({quiz_id:quizId,sort_order:i+1,candidate_order:q.no||i+1,question_type:q.questionType,prompt:q.prompt,choices:q.choices,correct_index:q.questionType==="OX"?(q.correctAnswer==="O"?0:1):({A:0,B:1,C:2,D:3} as Record<string,number>)[q.correctAnswer],explanation:q.explanation,bible_range:q.bibleRange||null,difficulty:q.difficulty||"MEDIUM",note:q.note||null,selected:false,import_id:importId}));
    await supabaseRest("questions",{method:"POST",body:JSON.stringify(payload)});
  }
  return NextResponse.json({ok:true,importId,createdQuizIds});
 }catch(e){const m=e instanceof Error?e.message:"등록 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
