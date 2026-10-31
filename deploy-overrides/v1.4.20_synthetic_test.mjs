import * as XLSX from "xlsx";
const assert=(ok,msg)=>{if(!ok)throw new Error("V4_AUTO_IMPORT_REGRESSION_FAILED: "+msg);};
const {parseRecommendedWorkbook}=await import("../src/server/recommendedImport.ts");
const dates=["2026-11-09","2026-11-16","2026-11-23","2026-11-30"];
const life=["2026-11-01 ~ 2026-11-07","2026-11-08 ~ 2026-11-14","2026-11-15 ~ 2026-11-21","2026-11-22 ~ 2026-11-28"];
const close=["2026-11-14","2026-11-21","2026-11-28","2026-12-05"];
const header=["고정 문항키(비UUID)","기존 DB 문제 UUID (개발실)","원본 시트","원본 문항번호",
"변경 구분","문제유형","문제","보기1","보기2","보기3","보기4","정답","해설","힌트",
"성경범위","난이도","비고","변경 필드","v1 원본행","v2 수정행","추천출제"];
const selected=[[1,2,4,5,8,9,12,13,14,15],[1,2,3,4,5,7,9,11,13,14],[1,3,4,5,6,8,10,11,13,15],[1,2,3,5,6,8,9,11,14,15]];
const book=XLSX.utils.book_new();
const beforeRows=[];
let pass=0;
for(let wi=0;wi<4;wi++){
 const rows=[
  ["실제 퀴즈 제목",wi===3?"2026년 11월 5주차":"2026년 11월 "+(wi+2)+"주차"],
  ["퀴즈 공개일",dates[wi]+" 00:00"],
  ["퀴즈 마감일",close[wi]+" 23:59"],
  ["말씀 복습 기간",life[wi]],
  header
 ];
 for(let no=1;no<=15;no++)rows.push([
  "WQ-"+dates[wi].replace(/-/g,"")+"-Q"+String(no).padStart(3,"0"),"",
  (wi+2)+"주차",no,"내용수정",no===3?"OX":"MCQ","문제 "+no,
  no===3?"O":"보기 A",no===3?"X":"보기 B",no===3?"":"보기 C",no===3?"":"보기 D",
  no===3?"X":"B","성경 해설",no===2?"정답 누설 없는 힌트":"","아모스 1:1","MEDIUM","검수 완료",
  "문제 및 해설",14+no,14+no,selected[wi].includes(no)?"Y":""
 ]);
 beforeRows.push(rows);
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),dates[wi]);
}
const bytes=XLSX.write(book,{type:"buffer",bookType:"xlsx"});
const parsed=parseRecommendedWorkbook(bytes);
assert(parsed.weeks.length===4&&parsed.totalCandidates===60&&parsed.totalSelected===40,"4 weeks 60 candidates 40 selected");pass++;
assert(parsed.weeks.every(w=>w.questions.length===15&&w.selectedNumbers.length===10),"each week 15/10");pass++;
assert(parsed.weeks[3].title==="12월 첫째 주간 셀 퀴즈","11/30 must normalize into December week 1");pass++;
assert(parsed.weeks[3].monthKey==="2026-12"&&parsed.weeks[3].weekIndex===1,"December monthly key & week index");pass++;
assert(parsed.weeks[0].questions[2].questionType==="OX"&&parsed.weeks[0].questions[2].correctIndex===1,"OX mapping");pass++;
assert(parsed.weeks[0].questions[1].hint==="정답 누설 없는 힌트"&&parsed.weeks[0].questions[0].hint===null,"optional hint mapping");pass++;
assert(parsed.weeks.every((w,i)=>JSON.stringify(w.selectedNumbers)===JSON.stringify(selected[i])),"stable recommendation numbers");pass++;
assert(parsed.warnings.length===1&&parsed.warnings[0].includes("자동 보정"),"bad title warned but auto corrected");pass++;
const corrupted=(sheet,cell,value)=>{
 const old=book.Sheets[sheet][cell];
 book.Sheets[sheet][cell]={...old,v:value};
 let blocked=false;
 try{parseRecommendedWorkbook(XLSX.write(book,{type:"buffer",bookType:"xlsx"}));}
 catch{blocked=true;}
 book.Sheets[sheet][cell]=old;
 return blocked;
};
assert(corrupted(dates[0],"U6","Y"),"11 recommended rows must fail");pass++;
assert(corrupted(dates[1],"A6","WQ-WRONG-Q001"),"invalid stable key must fail");pass++;
assert(corrupted(dates[2],"B2","2026-11-24 00:00"),"wrong publish date must fail");pass++;
assert(corrupted(dates[3],"B1","2026년 11월 4주차"),"other inconsistent title must fail");pass++;
assert(corrupted(dates[0],"M6",""),"missing explanation must fail");pass++;
assert(corrupted(dates[0],"P6","INVALID"),"invalid difficulty must fail");pass++;
console.log("v1.4.20 recommended Excel auto-schedule regression: "+pass+" checks PASS (no database write)");
