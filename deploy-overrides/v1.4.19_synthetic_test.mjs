import fs from "node:fs";
import * as XLSX from "xlsx";
const assert=(v,msg)=>{if(!v)throw new Error("PRESERVE_TEST_FAILED: "+msg);};
const fixtureSource="src/server/preserveImport.ts";
const probePath="src/server/__preserve_probe__.ts";
const raw=fs.readFileSync(fixtureSource,"utf8");
const forbidden='import { supabaseRest } from "@/lib/supabase/rest";';
assert(raw.includes(forbidden),"read-only planner dependency anchor");
fs.writeFileSync(probePath,raw.replace(forbidden,'const supabaseRest = globalThis.__mockSupabaseRest;'));
const header=["번호","문제유형","문제","보기1","보기2","보기3","보기4","정답","간단설명","힌트","성경범위","난이도","비고"];
const reading=["2026-11-01 ~ 2026-11-07","2026-11-08 ~ 2026-11-14","2026-11-15 ~ 2026-11-21","2026-11-22 ~ 2026-11-28"];
const openDays=["2026-11-09","2026-11-16","2026-11-23","2026-11-30"];
const titles=["11월 둘째 주간 셀 퀴즈","11월 셋째 주간 셀 퀴즈","11월 넷째 주간 셀 퀴즈","12월 첫째 주간 셀 퀴즈"];
const pad=(n)=>String(n).padStart(12,"0");
const quizRows=[],questionRows=[];
const book=XLSX.utils.book_new();
for(let wi=0;wi<4;wi++){
 const date=openDays[wi],date0=new Date(date+"T00:00:00+09:00"),saturday=new Date(date0.getTime()+5*86400000+23*3600000+59*60000);
 const quizId="10000000-0000-4000-8000-"+pad(wi+1);
 quizRows.push({
  id:quizId,title:titles[wi],status:"SCHEDULED",quiz_type:"WEEKLY",
  open_at:date0.toISOString(),close_at:saturday.toISOString(),
  selection_mode:"FIXED",random_question_count:null,published_question_count:10,
  import_id:null,monthly_period_id:null,
  content_month_key:wi===3?"2026-12":"2026-11",content_week_index:wi===3?1:wi+2
 });
 const rows=[
  ["퀴즈제목",titles[wi]],["생명의삶 기간",reading[wi]],
  ["성경범위","아모스 1:1"],["공개일시",""],["마감일시",""],[],header
 ];
 for(let no=1;no<=15;no++){
  const id="20000000-0000-4000-8000-"+pad(wi*15+no);
  questionRows.push({id,quiz_id:quizId,candidate_order:no,sort_order:no,selected:no<=10,
   question_type:"MCQ",prompt:"기존 문제 "+no,choices:["기존 A","기존 B","기존 C","기존 D"],
   correct_index:0,explanation:"기존 설명",hint:null,bible_range:"아모스 1:1",
   difficulty:"MEDIUM",note:"기존",import_id:null});
  rows.push([no,"MCQ","수정 문제 "+no,"새 보기 A","새 보기 B","새 보기 C","새 보기 D",
   "B","수정 해설",no===1?"비누설 힌트":"","아모스 1:1",no===1?"HARD":"MEDIUM","수정"]);
 }
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),(wi+2)+"주차");
}
const buf=XLSX.write(book,{type:"buffer",bookType:"xlsx"});
globalThis.__mockHasSessions=false;
globalThis.__mockSupabaseRest=async(path)=>{
 if(path.startsWith("quizzes?"))return quizRows;
 if(path.startsWith("questions?")){
  const m=path.match(/quiz_id=eq\.([0-9a-f-]+)/);
  return questionRows.filter(q=>q.quiz_id===m?.[1]);
 }
 if(path.startsWith("quiz_sessions?"))return globalThis.__mockHasSessions?[{id:"session"}]:[];
 if(path.startsWith("submissions?"))return [];
 throw new Error("Unknown mock query: "+path);
};
let pass=0;
try{
 const {parsePreserveExcel,makePreservePlan}=await import("../src/server/__preserve_probe__.ts");
 const parsed=parsePreserveExcel(buf);
 assert(parsed.weeks.length===4,"four effective weeks");pass++;
 assert(parsed.weeks[0].openAt==="2026-11-09T00:00:00+09:00","reading week -> following Monday");pass++;
 assert(parsed.weeks[3].openAt==="2026-11-30T00:00:00+09:00","week 5 -> December week 1");pass++;
 assert(parsed.weeks[0].questions[0].hint==="비누설 힌트"&&parsed.weeks[0].questions[0].bible_range==="아모스 1:1"&&parsed.weeks[0].questions[0].difficulty==="HARD"&&parsed.weeks[0].questions[0].note==="수정","header-driven hint/range/difficulty/note");pass++;
 const before=JSON.stringify({quizRows,questionRows});
 const plan=await makePreservePlan(buf);
 assert(plan.weeks.length===4&&plan.changedQuestions===60,"all four weeks compared by candidate no");pass++;
 assert(plan.weeks.every(w=>w.unchangedSelectionIds.length===10&&w.candidates.length===15),"selection and candidates unchanged");pass++;
 assert(plan.weeks.every(w=>w.candidates.every(c=>c.id===questionRows.find(q=>q.quiz_id===w.quizId&&q.candidate_order===c.no)?.id)),"question UUIDs retained");pass++;
 assert(before===JSON.stringify({quizRows,questionRows}),"planner made no DB mutations");pass++;
 globalThis.__mockHasSessions=true;
 let blocked=false;try{await makePreservePlan(buf)}catch(e){blocked=String(e).includes("응시");}
 assert(blocked,"any existing session blocks update");pass++;
 globalThis.__mockHasSessions=false;quizRows[0].status="OPEN";
 blocked=false;try{await makePreservePlan(buf)}catch(e){blocked=String(e).includes("공개");}
 assert(blocked,"open status blocks update");pass++;
 quizRows[0].status="SCHEDULED";questionRows[0].candidate_order=2;
 blocked=false;try{await makePreservePlan(buf)}catch(e){blocked=String(e).includes("중복");}
 assert(blocked,"duplicate candidate number blocks update");pass++;
 const wrong=XLSX.utils.book_new();
 const broken=[["퀴즈제목","Test"],["생명의삶 기간",reading[0]],header.filter(x=>x!=="힌트"),[1,"MCQ","질문","A","B","C","D","A","해설","아모스 1:1","MEDIUM","수정"]];
 XLSX.utils.book_append_sheet(wrong,XLSX.utils.aoa_to_sheet(broken),"2주차");
 blocked=false;try{parsePreserveExcel(XLSX.write(wrong,{type:"buffer",bookType:"xlsx"}))}catch(e){blocked=String(e).includes("힌트");}
 assert(blocked,"missing hint header blocks update");pass++;

 // Publication-date v3 sheets with stable business keys and original candidate numbers.
 questionRows[0].candidate_order=1;
 const v3header=["고정 문항키(비UUID)","기존 DB 문제 UUID (개발실)","원본 시트","원본 문항번호",
 "변경 구분","문제유형","문제","보기1","보기2","보기3","보기4","정답",
 "해설","힌트","성경범위","난이도","비고","변경 필드","v1 원본행","v2 수정행"];
 const v3book=XLSX.utils.book_new();
 for(let wi=0;wi<4;wi++){
  const date=openDays[wi];
  const close=new Date(Date.parse(date+"T00:00:00+09:00")+5*86400000).toISOString().slice(0,10);
  const cy=wi===3?"2026년 12월 1주차":"2026년 11월 "+(wi+2)+"주차";
  const rows=[
    ["실제 퀴즈 제목",cy],["퀴즈 공개일",date+" 00:00"],
    ["퀴즈 마감일",close+" 23:59"],["말씀 복습 기간",reading[wi]],v3header
  ];
  for(let no=1;no<=15;no++)rows.push([
    "WQ-"+date.replace(/-/g,"")+"-Q"+String(no).padStart(3,"0"),"",
    (wi+2)+"주차",no,"내용수정","MCQ","수정 문제 "+no,
    "새 보기 A","새 보기 B","새 보기 C","새 보기 D","B",
    "수정 해설",no===1?"비누설 힌트":"","아모스 1:1",no===1?"HARD":"MEDIUM","수정","문제, 보기, 해설",14,14
  ]);
  XLSX.utils.book_append_sheet(v3book,XLSX.utils.aoa_to_sheet(rows),date);
 }
 const v3bytes=XLSX.write(v3book,{type:"buffer",bookType:"xlsx"});
 const v3parsed=parsePreserveExcel(v3bytes);
 assert(v3parsed.weeks.length===4&&v3parsed.weeks.every(w=>w.questions.length===15),
  "new YYYY-MM-DD sheet format reads all 60 candidates");pass++;
 assert(v3parsed.weeks[3].declaredMonthKey==="2026-12"&&v3parsed.weeks[3].declaredWeekIndex===1,
  "November 30 is actually December week 1");pass++;
 const v3plan=await makePreservePlan(v3bytes);
 assert(v3plan.weeks.length===4&&v3plan.changedQuestions===60&&v3plan.weeks.every(w=>w.unchangedSelectionIds.length===10),
  "new v3 rows map to original UUIDs and selected questions");pass++;
 assert(before===JSON.stringify({quizRows,questionRows}),
  "date-named v3 preview is read only");pass++;
 v3book.Sheets["2026-11-30"].B1.v="2026년 11월 5주차";
 let v3blocked=false;
 try{await makePreservePlan(XLSX.write(v3book,{type:"buffer",bookType:"xlsx"}))}
 catch(e){v3blocked=String(e).includes("DB 출제 주차");}
 assert(v3blocked,"incorrect November 5th week title blocked");pass++;
 v3book.Sheets["2026-11-30"].B1.v="2026년 12월 1주차";
 v3book.Sheets["2026-11-09"].A6.v="WQ-INVALID-Q001";
 v3blocked=false;
 try{parsePreserveExcel(XLSX.write(v3book,{type:"buffer",bookType:"xlsx"}))}
 catch(e){v3blocked=String(e).includes("고유 코드");}
 assert(v3blocked,"wrong stable business ID blocked");pass++;
 v3book.Sheets["2026-11-09"].A6.v="WQ-20261109-Q001";
 v3book.Sheets["2026-11-09"].B2.v="2026-11-10 00:00";
 v3blocked=false;
 try{parsePreserveExcel(XLSX.write(v3book,{type:"buffer",bookType:"xlsx"}))}
 catch(e){v3blocked=String(e).includes("공개일시");}
 assert(v3blocked,"inconsistent opening timestamp blocked");pass++;

 console.log("v1.4.19 safe preserve synthetic regression: "+pass+" checks PASS; zero external database requests");
}finally{
 fs.unlinkSync(probePath);
 delete globalThis.__mockSupabaseRest;
 delete globalThis.__mockHasSessions;
}
