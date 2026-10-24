import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type Quiz={id:string;title:string;status:string;open_at:string|null;close_at:string|null};
type Sub={id:string;quiz_id:string;person_id:string;group_id_snapshot:string|null;score:number;submitted_at:string};
type Question={id:string;prompt:string;sort_order:number;question_type:string;choices:string[];correct_index:number;explanation:string};
type Answer={submission_id:string;question_id:string;selected_index:number|null;is_correct:boolean};
type Person={id:string;display_name:string};

export async function GET(request:Request){
 try{
  await requireAdmin();
  const requestedId=new URL(request.url).searchParams.get("quizId");
  const quizzes=await supabaseRest<Quiz[]>("quizzes?quiz_type=eq.WEEKLY&order=open_at.desc&limit=100&select=id,title,status,open_at,close_at");
  const eligible=quizzes.filter(q=>q.status!=="DRAFT"&&Boolean(q.open_at));
  const now=Date.now();
  const selected=requestedId?eligible.find(q=>q.id===requestedId)
    :eligible.find(q=>q.open_at&&q.close_at&&new Date(q.open_at).getTime()<=now&&now<=new Date(q.close_at).getTime())
     ??eligible.find(q=>q.close_at&&new Date(q.close_at).getTime()<now)
     ??null;
  if(requestedId&&!selected)return NextResponse.json({error:"조회할 수 없는 주차입니다."},{status:404});
  if(!selected)return NextResponse.json({quiz:null,quizzes:eligible,participation:0,average:null,questions:[],participants:[]});

  const [submissions,questions]=await Promise.all([
   supabaseRest<Sub[]>(`submissions?quiz_id=eq.${selected.id}&mode=eq.OFFICIAL&order=submitted_at.asc&select=id,quiz_id,person_id,group_id_snapshot,score,submitted_at`),
   supabaseRest<Question[]>(`questions?quiz_id=eq.${selected.id}&selected=eq.true&order=sort_order.asc&select=id,prompt,sort_order,question_type,choices,correct_index,explanation`)
  ]);
  const firstByPerson=new Map<string,Sub>();
  for(const s of submissions)if(!firstByPerson.has(s.person_id))firstByPerson.set(s.person_id,s);
  const subs=[...firstByPerson.values()];
  const ids=subs.map(s=>s.id);
  const [answers,people]=await Promise.all([
   ids.length?supabaseRest<Answer[]>(`answers?submission_id=in.(${ids.join(",")})&select=submission_id,question_id,selected_index,is_correct`):Promise.resolve([] as Answer[]),
   ids.length?supabaseRest<Person[]>(`people?id=in.(${subs.map(s=>s.person_id).join(",")})&select=id,display_name`):Promise.resolve([] as Person[])
  ]);
  const peopleMap=new Map(people.map(p=>[p.id,p.display_name]));
  const answersBySubmission=new Map<string,Map<string,Answer>>();
  for(const a of answers){
   const row=answersBySubmission.get(a.submission_id)??new Map<string,Answer>();
   row.set(a.question_id,a);answersBySubmission.set(a.submission_id,row);
  }
  const participants=subs.map(s=>{
   const selections=answersBySubmission.get(s.id)??new Map<string,Answer>();
   return {id:s.id,personId:s.person_id,name:peopleMap.get(s.person_id)??"알 수 없는 참가자",
    score:s.score,submittedAt:s.submitted_at,
    answers:questions.map(q=>{
     const a=selections.get(q.id),chosen=a?.selected_index??null;
     return {questionId:q.id,prompt:q.prompt,sortOrder:q.sort_order,
      selectedIndex:chosen,selectedText:chosen===null?"미응답":q.choices[chosen]??"선택지 없음",
      correctIndex:q.correct_index,correctText:q.choices[q.correct_index]??"",
      isCorrect:a?.is_correct===true,explanation:q.explanation??""};
    })};
  });
  const qstats=questions.map(q=>{
   const rows=answers.filter(a=>ids.includes(a.submission_id)&&a.question_id===q.id);
   const correct=rows.filter(a=>a.is_correct).length;
   return {id:q.id,prompt:q.prompt,total:rows.length,correct,rate:rows.length?Math.round(correct/rows.length*100):null};
  });
  const avg=subs.length?Math.round(subs.reduce((t,s)=>t+s.score,0)/subs.length*10)/10:null;
  return NextResponse.json({quiz:selected,quizzes:eligible,participation:subs.length,average:avg,questions:qstats,participants});
 }catch(e){
  const message=e instanceof Error?e.message:"통계를 불러오지 못했습니다.";
  return NextResponse.json({error:message},{status:message==="ADMIN_REQUIRED"?403:500});
 }
}
