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
 console.log("v1.4.19 safe preserve synthetic regression: "+pass+" checks PASS; zero external database requests");
}finally{
 fs.unlinkSync(probePath);
 delete globalThis.__mockSupabaseRest;
 delete globalThis.__mockHasSessions;
}
