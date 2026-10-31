import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { supabaseRest } from "@/lib/supabase/rest";

const COLUMNS=["번호","문제유형","문제","보기1","보기2","보기3","보기4","정답","간단설명","힌트","성경범위","난이도","비고"] as const;
type NewQuestion={no:number;existingDbUuid:string|null;question_type:"MCQ"|"OX";prompt:string;choices:string[];correct_index:number;explanation:string;hint:string|null;bible_range:string|null;difficulty:"EASY"|"MEDIUM"|"HARD";note:string|null};
type IncomingWeek={sheet:string;openAt:string;closeAt:string;questions:NewQuestion[];lifeDateRange:string;declaredTitle:string|null;declaredMonthKey:string|null;declaredWeekIndex:number|null};
type QuizRow={id:string;title:string;status:string;quiz_type:string;open_at:string|null;close_at:string|null;selection_mode:string;random_question_count:number|null;published_question_count:number|null;import_id:string|null;monthly_period_id:string|null;content_month_key:string|null;content_week_index:number|null};
type QuestionRow={id:string;quiz_id:string;candidate_order:number|null;sort_order:number;selected:boolean;question_type:string;prompt:string;choices:string[];correct_index:number;explanation:string|null;hint:string|null;bible_range:string|null;difficulty:string|null;note:string|null;import_id:string|null};
type Identity={id:string;selected:boolean;candidate_order:number|null;sort_order:number;question_type:string;prompt:string;choices:string[];correct_index:number;explanation:string|null;hint:string|null;bible_range:string|null;difficulty:string|null;note:string|null;import_id:string|null};
type QuizIdentity=Pick<QuizRow,"id"|"title"|"status"|"open_at"|"close_at"|"selection_mode"|"random_question_count"|"published_question_count"|"import_id"|"monthly_period_id"|"content_month_key"|"content_week_index">;

const clean=(v:unknown)=>String(v??"").trim();
const sha256=(x:string|Buffer)=>createHash("sha256").update(x).digest("hex");
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const required=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const normalizeValue=(v:unknown)=>v===""?null:v;

function calcActualQuizWindow(readingDate:string,sheetName:string){
 const m=readingDate.match(/(20\d{2})-(\d{2})-(\d{2})\s*~\s*(20\d{2})-(\d{2})-(\d{2})/);
 required(m,"시트 "+sheetName+": 생명의삶 기간을 yyyy-mm-dd ~ yyyy-mm-dd로 입력해야 합니다.");
 const end=new Date(Date.UTC(Number(m![4]),Number(m![5])-1,Number(m![6]),12));
 required(end.toISOString().slice(0,10)===[m![4],m![5],m![6]].join("-"),"시트 "+sheetName+": 날짜 오류");
 const days=((8-end.getUTCDay())%7)||7;
 const monday=new Date(end.getTime()+days*86400000);
 const saturday=new Date(monday.getTime()+5*86400000);
 return {openAt:monday.toISOString().slice(0,10)+"T00:00:00+09:00",closeAt:saturday.toISOString().slice(0,10)+"T23:59:00+09:00"};
}

export function parsePreserveExcel(bytes:Buffer){
 required(bytes.length>0&&bytes.length<=8*1024*1024,"Excel 파일은 8MB 이하여야 합니다.");
 const wb=XLSX.read(bytes,{type:"buffer",cellDates:false});
 const weeks:IncomingWeek[]=[];
 const dateKeys=new Set<string>();
 for(const name of wb.SheetNames.filter(n=>/^(?:\d{1,2}월\s*)?\d+주차$/.test(n)||/^20\d{2}-\d{2}-\d{2}$/.test(n))){
  const dateNamed=/^20\d{2}-\d{2}-\d{2}$/.test(name);
  const rows=XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name],{header:1,defval:"",raw:false});
  const headerAt=rows.findIndex(r=>dateNamed?clean(r[0])==="고정 문항키(비UUID)"&&r.some(x=>clean(x)==="원본 문항번호"):clean(r[0])==="번호"&&clean(r[1])==="문제유형");
  if(headerAt<0)throw new Error("시트 "+name+": 문제 헤더를 찾지 못했습니다.");
  const header=rows[headerAt].map(clean);
  const locations=new Map<string,number>();
  for(const key of COLUMNS){
   const expectedName=dateNamed?(key==="번호"?"원본 문항번호":key==="간단설명"?"해설":key):key;
   const idxs=header.flatMap((v,i)=>v===expectedName?[i]:[]);
   required(idxs.length===1,"시트 "+name+": 필수 열 '"+key+"'가 누락되었거나 중복되었습니다.");
   locations.set(key,idxs[0]);
  }
  const get=(r:unknown[],k:typeof COLUMNS[number])=>clean(r[locations.get(k)!]);
  const meta=(key:string)=>{const r=rows.slice(0,headerAt).find(r=>clean(r[0])===key);return r?clean(r[1]):"";};
  const life=meta(dateNamed?"말씀 복습 기간":"생명의삶 기간");
  const declaredTitle=dateNamed?meta("실제 퀴즈 제목"):null;
  const titleMatch=declaredTitle?.match(/^(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})주차$/)??null;
  if(dateNamed)required(titleMatch,"시트 "+name+": 실제 퀴즈 제목을 '2026년 11월 2주차' 형태로 지정해야 합니다.");
  const questions:NewQuestion[]=[];
  const seen=new Set<number>();
  for(let i=headerAt+1;i<rows.length;i++){
   const row=rows[i];
   if(!get(row,"문제"))continue;
   const rawNo=get(row,"번호");const no=Number(rawNo);
   required(/^\d+$/.test(rawNo)&&Number.isSafeInteger(no)&&no>0,"시트 "+name+" "+(i+1)+"행: 안정적인 문제 번호가 필요합니다.");
   required(!seen.has(no),"시트 "+name+": 문제 번호 "+no+" 중복");
   seen.add(no);
   if(dateNamed){
    const stableKey=clean(row[header.indexOf("고정 문항키(비UUID)")]);
    const expectedKey="WQ-"+name.replace(/-/g,"")+"-Q"+String(no).padStart(3,"0");
    required(stableKey===expectedKey,"시트 "+name+" 문제 "+no+": 고유 코드가 원본 번호·공개일과 일치하지 않습니다.");
    const uuid=clean(row[header.indexOf("기존 DB 문제 UUID (개발실)")]);
    required(!uuid||/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(uuid),
      "시트 "+name+" 문제 "+no+": DB UUID 형식 오류");
   }
   const type=get(row,"문제유형").toUpperCase();
   required(["MCQ","OX"].includes(type),"시트 "+name+" 문제 "+no+": 문제유형 오류");
   const answer=get(row,"정답").toUpperCase();
   let correct_index=0;
   if(type==="MCQ"){
    required(["A","B","C","D"].includes(answer),"시트 "+name+" 문제 "+no+": 정답 오류");
    correct_index=answer.charCodeAt(0)-65;
   }else{
    required(["O","X"].includes(answer),"시트 "+name+" 문제 "+no+": OX 정답 오류");
    correct_index=answer==="O"?0:1;
   }
   const choices=type==="OX"?["O","X"]:[get(row,"보기1"),get(row,"보기2"),get(row,"보기3"),get(row,"보기4")];
   required(choices.every(Boolean),"시트 "+name+" 문제 "+no+": 보기 누락");
   const difficulty=get(row,"난이도").toUpperCase();
   required(["EASY","MEDIUM","HARD"].includes(difficulty),"시트 "+name+" 문제 "+no+": 난이도 누락 또는 오류");
   required(get(row,"간단설명"),"시트 "+name+" 문제 "+no+": 해설이 누락되었습니다.");
   required(get(row,"성경범위"),"시트 "+name+" 문제 "+no+": 성경범위가 누락되었습니다.");
   const existingDbUuid=dateNamed?clean(row[header.indexOf("기존 DB 문제 UUID (개발실)")])||null:null;
   questions.push({
    no,existingDbUuid,question_type:type as "MCQ"|"OX",prompt:get(row,"문제"),choices,
    correct_index,explanation:get(row,"간단설명"),
    hint:normalizeValue(get(row,"힌트")) as string|null,
    bible_range:normalizeValue(get(row,"성경범위")) as string|null,
    difficulty:difficulty as "EASY"|"MEDIUM"|"HARD",
    note:normalizeValue(get(row,"비고")) as string|null
   });
  }
  if(!questions.length)continue; // e.g. blank Excel 1주차: never affect existing quiz.
  required(life,"시트 "+name+": 말씀 기간이 없습니다.");
  const timing=calcActualQuizWindow(life,name);
  if(dateNamed){
   const localDate=(s:string)=>s.replace("T"," ").slice(0,16);
   required(name===timing.openAt.slice(0,10),"시트 "+name+": 시트명과 말씀 기간에서 계산한 출제일이 다릅니다.");
   required(meta("퀴즈 공개일")===localDate(timing.openAt),"시트 "+name+": 공개일시와 말씀 기간이 일치하지 않습니다.");
   required(meta("퀴즈 마감일")===localDate(timing.closeAt),"시트 "+name+": 마감일시와 말씀 기간이 일치하지 않습니다.");
  }
  const dateKey=Date.parse(timing.openAt).toString();
  required(!dateKeys.has(dateKey),"동일한 실제 출제 주차가 Excel에 중복되어 있습니다: "+name);
  dateKeys.add(dateKey);
  questions.sort((a,b)=>a.no-b.no);
  weeks.push({...timing,sheet:name,questions,lifeDateRange:life,
    declaredTitle:declaredTitle||null,
    declaredMonthKey:titleMatch?titleMatch[1]+"-"+titleMatch[2].padStart(2,"0"):null,
    declaredWeekIndex:titleMatch?Number(titleMatch[3]):null
  });
 }
 required(weeks.length>0,"업데이트할 주차가 없습니다.");
 return {hash:sha256(bytes),weeks};
}

const quizBaseline=(q:QuizRow):QuizIdentity=>({
 id:q.id,title:q.title,status:q.status,open_at:q.open_at,close_at:q.close_at,
 selection_mode:q.selection_mode,random_question_count:q.random_question_count,
 published_question_count:q.published_question_count,import_id:q.import_id,
 monthly_period_id:q.monthly_period_id,content_month_key:q.content_month_key,
 content_week_index:q.content_week_index
});
const questionBaseline=(q:QuestionRow):Identity=>({
 id:q.id,selected:q.selected,candidate_order:q.candidate_order,sort_order:q.sort_order,
 question_type:q.question_type,prompt:q.prompt,choices:q.choices,correct_index:q.correct_index,
 explanation:q.explanation,hint:q.hint,bible_range:q.bible_range,
 difficulty:q.difficulty,note:q.note,import_id:q.import_id
});
const editable=["prompt","choices","correct_index","explanation","hint","bible_range","difficulty","note"] as const;
const fieldLabels:Record<string,string>={
 prompt:"문제",choices:"보기",correct_index:"정답",explanation:"해설",
 hint:"힌트",bible_range:"성경범위",difficulty:"난이도",note:"비고"
};

export async function makePreservePlan(bytes:Buffer){
 const parsed=parsePreserveExcel(bytes);
 const quizzes=await supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&order=open_at.asc&limit=250&select=id,title,status,quiz_type,open_at,close_at,selection_mode,random_question_count,published_question_count,import_id,monthly_period_id,content_month_key,content_week_index");
 const planned=[] as Array<{
  sheet:string;quizId:string;title:string;openAt:string;closeAt:string;
  unchangedSelectionIds:string[];baseline:QuizIdentity;
  candidates:Array<{id:string;no:number;baseline:Identity;patch:Partial<NewQuestion>;changes:Array<{field:string;label:string;old:unknown;next:unknown}>}>;
  changedQuestions:number;changedFields:number;
 }>;
 const now=Date.now();
 for(const w of parsed.weeks){
  const matches=quizzes.filter(q=>q.open_at&&Date.parse(q.open_at)===Date.parse(w.openAt));
  required(matches.length===1,"시트 "+w.sheet+": 공개일에 정확히 매칭되는 퀴즈가 "+matches.length+"개입니다. 적용 중단");
  const quiz=matches[0];
  if(w.declaredMonthKey){
   required(w.declaredMonthKey===quiz.content_month_key&&w.declaredWeekIndex===quiz.content_week_index,
      "시트 "+w.sheet+": Excel의 '"+w.declaredTitle+"'와 DB 출제 주차("+quiz.title+")가 다릅니다. 제목을 바로잡고 다시 미리보기 하세요.");
  }
  required(quiz.status==="SCHEDULED"&&quiz.open_at&&Date.parse(quiz.open_at)>now,
   w.sheet+" → "+quiz.title+": 공개 중·마감·진행 중인 퀴즈는 업데이트할 수 없습니다.");
  required(quiz.close_at&&Date.parse(quiz.close_at)===Date.parse(w.closeAt),
   w.sheet+" → "+quiz.title+": 예약 마감일이 Excel 주차와 다릅니다.");
  required(quiz.selection_mode==="FIXED"&&quiz.published_question_count===10,
   w.sheet+" → "+quiz.title+": 기존 출제 설정을 유지할 수 없어 적용을 중단했습니다.");
  const [questions,sessions,submissions]=await Promise.all([
   supabaseRest<QuestionRow[]>("questions?quiz_id=eq."+quiz.id+"&order=candidate_order.asc&select=id,quiz_id,candidate_order,sort_order,selected,question_type,prompt,choices,correct_index,explanation,hint,bible_range,difficulty,note,import_id"),
   supabaseRest<Array<{id:string}>>("quiz_sessions?quiz_id=eq."+quiz.id+"&limit=1&select=id"),
   supabaseRest<Array<{id:string}>>("submissions?quiz_id=eq."+quiz.id+"&limit=1&select=id")
  ]);
  required(!sessions.length&&!submissions.length,w.sheet+" → "+quiz.title+": 응시·제출 기록 보호로 업데이트 차단");
  required(questions.length===w.questions.length,w.sheet+" → "+quiz.title+": 후보 개수 변경 금지 ("+questions.length+"→"+w.questions.length+")");
  const dbByNo=new Map<number,QuestionRow>();
  for(const q of questions){
   required(q.candidate_order!==null&&!dbByNo.has(q.candidate_order),
    w.sheet+" → "+quiz.title+": 기존 후보 번호가 누락 또는 중복되었습니다.");
   dbByNo.set(q.candidate_order!,q);
  }
  const selectedIds=questions.filter(q=>q.selected).map(q=>q.id).sort();
  required(selectedIds.length===10,w.sheet+" → "+quiz.title+": 선택 10개가 유지되지 않습니다.");
  const candidates=[] as typeof planned[number]["candidates"];
  for(const next of w.questions){
   const q=dbByNo.get(next.no);
   required(q,w.sheet+" → "+quiz.title+": 후보 번호 "+next.no+"를 찾지 못했습니다.");
   if(next.existingDbUuid)required(next.existingDbUuid.toLowerCase()===q!.id.toLowerCase(),
    w.sheet+" → "+quiz.title+" 문제 "+next.no+": 엑셀 DB UUID가 기존 실제 문제 ID와 다릅니다.");
   required(q!.question_type===next.question_type,
    w.sheet+" → "+quiz.title+" 문제 "+next.no+": 문제유형이 달라 자동 ID 매칭을 차단했습니다.");
   const baseline=questionBaseline(q!);
   const patch:Partial<NewQuestion>={};
   const changes=[] as Array<{field:string;label:string;old:unknown;next:unknown}>;
   for(const field of editable){
    const old=(baseline as any)[field],newValue=(next as any)[field];
    if(!same(old,newValue)){(patch as any)[field]=newValue;changes.push({field,label:fieldLabels[field],old,next:newValue});}
   }
   candidates.push({id:q!.id,no:next.no,baseline,patch,changes});
  }
  planned.push({
   sheet:w.sheet,quizId:quiz.id,title:quiz.title,openAt:quiz.open_at!,
   closeAt:quiz.close_at!,unchangedSelectionIds:selectedIds,
   baseline:quizBaseline(quiz),candidates,
   changedQuestions:candidates.filter(x=>x.changes.length>0).length,
   changedFields:candidates.reduce((v,x)=>v+x.changes.length,0)
  });
 }
 const token=sha256(JSON.stringify({fileHash:parsed.hash,planned}));
 return {
  sourceHash:parsed.hash,planHash:token,affectedWeeks:planned.length,
  changedQuestions:planned.reduce((n,w)=>n+w.changedQuestions,0),
  changedFields:planned.reduce((n,w)=>n+w.changedFields,0),weeks:planned,
  backup:{capturedAt:new Date().toISOString(),sourceHash:parsed.hash,weeks:planned.map(w=>({
   title:w.title,quizId:w.quizId,quiz:w.baseline,questions:w.candidates.map(q=>q.baseline),
   unchangedSelectionIds:w.unchangedSelectionIds
  }))}
 };
}
