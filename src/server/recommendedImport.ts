import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

const HEADERS=["고정 문항키(비UUID)","원본 문항번호","문제유형","문제","보기1","보기2","보기3","보기4","정답","해설","힌트","성경범위","난이도","비고","추천출제"] as const;
const ORD=["첫째","둘째","셋째","넷째","다섯째","여섯째"];
const KNOWN_BIBLE_RANGES:Record<string,string>={
 "2026-11-09":"빌레몬서 1:1-25 / 아모스 1:1-3:8",
 "2026-11-16":"아모스 3:9-6:14",
 "2026-11-23":"아모스 7:1-9:15 / 고린도후서 1:1-14",
 "2026-11-30":"고린도후서 1:15-4:18"
};
export type RecommendedQuestion={
 no:number;key:string;questionType:"MCQ"|"OX";prompt:string;choices:string[];
 correctIndex:number;explanation:string;hint:string|null;bibleRange:string;difficulty:"EASY"|"MEDIUM"|"HARD";note:string|null;selected:boolean
};
export type RecommendedWeek={
 sheet:string;title:string;openAt:string;closeAt:string;openDate:string;monthKey:string;weekIndex:number;lifeDateRange:string;bibleRange:string;
 questions:RecommendedQuestion[];selectedNumbers:number[];warnings:string[]
};
const str=(v:unknown)=>String(v??"").trim();
const fail=(message:string):never=>{throw new Error(message);};
const must=(v:unknown,message:string)=>{if(!v)fail(message);};
const yyyyMmDd=(d:Date)=>d.toISOString().slice(0,10);
function dateUtc(s:string){must(/^\d{4}-\d{2}-\d{2}$/.test(s),"날짜 형식 오류: "+s);
 const d=new Date(s+"T00:00:00.000Z");must(!Number.isNaN(d.getTime())&&yyyyMmDd(d)===s,"존재하지 않는 날짜: "+s);return d;}
function nextDay(date:string,days:number){const d=dateUtc(date);d.setUTCDate(d.getUTCDate()+days);return yyyyMmDd(d);}
export function parseRecommendedWorkbook(buffer:Buffer){
 must(buffer.length>0&&buffer.length<=8*1024*1024,"파일은 8MB 이하 .xlsx만 지원합니다.");
 const wb=XLSX.read(buffer,{type:"buffer",cellDates:false});
 const sheetNames=wb.SheetNames.filter(n=>/^20\d{2}-\d{2}-\d{2}$/.test(n));
 must(sheetNames.length>=1&&sheetNames.length<=8,"공개일(YYYY-MM-DD) 이름의 주차 시트가 1~8개 필요합니다.");
 const uniqueKeys=new Set<string>();
 const weeks:RecommendedWeek[]=[];
 for(const sheet of sheetNames){
  const rows=XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet],{header:1,defval:"",raw:false});
  const headerIndex=rows.findIndex(r=>r.some(x=>str(x)==="고정 문항키(비UUID)")&&r.some(x=>str(x)==="추천출제"));
  must(headerIndex>=0,"시트 "+sheet+": 문제 헤더를 찾을 수 없습니다.");
  const header=rows[headerIndex].map(str);
  const columns=new Map<string,number>();
  for(const k of HEADERS){
   const idx=header.flatMap((x,i)=>x===k?[i]:[]);
   must(idx.length===1,"시트 "+sheet+": "+k+" 열이 없거나 중복됐습니다.");
   columns.set(k,idx[0]);
  }
  const meta=(key:string)=>{const r=rows.slice(0,headerIndex).find(r=>str(r[0])===key);return str(r?.[1]);};
  const get=(r:unknown[],key:typeof HEADERS[number])=>str(r[columns.get(key)!]);
  const open=meta("퀴즈 공개일"),close=meta("퀴즈 마감일");
  must(open===sheet+" 00:00","시트 "+sheet+": 공개일이 시트명과 일치해야 합니다 (00:00).");
  const monday=dateUtc(sheet);
  must(monday.getUTCDay()===1,"시트 "+sheet+": 공개일은 월요일이어야 합니다.");
  const saturday=nextDay(sheet,5);
  must(close===saturday+" 23:59","시트 "+sheet+": 마감은 해당 주 토요일 23:59여야 합니다.");
  const lifeRange=meta("말씀 복습 기간");
  const expectedLife=nextDay(sheet,-8)+" ~ "+nextDay(sheet,-2);
  must(lifeRange===expectedLife,"시트 "+sheet+": 말씀 복습 기간 오류. 기대값 "+expectedLife);
  const closes=dateUtc(saturday),monthKey=saturday.slice(0,7),weekIndex=Math.ceil(closes.getUTCDate()/7);
  must(weekIndex<=6,"시트 "+sheet+": 잘못된 주차입니다.");
  const title=(closes.getUTCMonth()+1)+"월 "+ORD[weekIndex-1]+" 주간 셀 퀴즈";
  const displayedTitle=meta("실제 퀴즈 제목");
  const desiredTitle=closes.getUTCFullYear()+"년 "+(closes.getUTCMonth()+1)+"월 "+weekIndex+"주차";
  const warnings:string[]=[];
  if(displayedTitle&&displayedTitle!==desiredTitle){
   if(sheet==="2026-11-30"&&displayedTitle==="2026년 11월 5주차")
    warnings.push("원본 파일의 11월 5주차 표기는 실제 출제 기준 12월 1주차로 자동 보정합니다.");
   else fail("시트 "+sheet+": 퀴즈 제목이 실제 공개 주차와 다릅니다. 기대값: "+desiredTitle);
  }
  const questions:RecommendedQuestion[]=[];
  const usedNumbers=new Set<number>();
  for(let idx=headerIndex+1;idx<rows.length;idx++){
   const row=rows[idx];
   const prompt=get(row,"문제");
   if(!prompt)continue;
   const numberRaw=get(row,"원본 문항번호");
   const no=Number(numberRaw);
   must(/^[1-9]\d*$/.test(numberRaw)&&Number.isSafeInteger(no)&&no<=999,"시트 "+sheet+" "+(idx+1)+"행: 원본 문항번호 오류");
   must(!usedNumbers.has(no),"시트 "+sheet+": 원본 문항번호 "+no+" 중복");
   usedNumbers.add(no);
   const key=get(row,"고정 문항키(비UUID)");
   const expectedKey="WQ-"+sheet.replace(/-/g,"")+"-Q"+String(no).padStart(3,"0");
   must(key===expectedKey&&!uniqueKeys.has(key),"시트 "+sheet+" "+no+"번: 고유 문항키 누락·중복·불일치");
   uniqueKeys.add(key);
   const questionType=get(row,"문제유형").toUpperCase();
   must(questionType==="MCQ"||questionType==="OX","시트 "+sheet+" "+no+"번: 문제유형은 MCQ/OX");
   const type=questionType as "MCQ"|"OX";
   const answer=get(row,"정답").toUpperCase();
   const correctIndex=type==="OX"?(answer==="O"?0:answer==="X"?1:-1):"ABCD".indexOf(answer);
   must(correctIndex>=0,"시트 "+sheet+" "+no+"번: 정답 오류");
   const choices=type==="OX"?["O","X"]:[get(row,"보기1"),get(row,"보기2"),get(row,"보기3"),get(row,"보기4")];
   must(choices.every(Boolean),"시트 "+sheet+" "+no+"번: 보기 누락");
   const explanation=get(row,"해설"),bibleRange=get(row,"성경범위"),difficulty=get(row,"난이도").toUpperCase();
   must(explanation&&bibleRange,"시트 "+sheet+" "+no+"번: 해설 또는 성경범위 누락");
   must(["EASY","MEDIUM","HARD"].includes(difficulty),"시트 "+sheet+" "+no+"번: 난이도 오류");
   const recommended=get(row,"추천출제").toUpperCase();
   must(!recommended||recommended==="Y","시트 "+sheet+" "+no+"번: 추천출제는 Y 또는 빈칸만 허용합니다.");
   questions.push({
    no,key,questionType:type,prompt,choices,correctIndex,explanation,
    hint:get(row,"힌트")||null,bibleRange,difficulty:difficulty as "EASY"|"MEDIUM"|"HARD",
    note:get(row,"비고")||null,selected:recommended==="Y"
   });
  }
  must(questions.length===15,"시트 "+sheet+": 후보 15문항이 필요합니다 (현재 "+questions.length+"개).");
  questions.sort((a,b)=>a.no-b.no);
  must(questions.every((q,i)=>q.no===i+1),"시트 "+sheet+": 문제 번호는 1~15여야 합니다.");
  const selectedNumbers=questions.filter(q=>q.selected).map(q=>q.no);
  must(selectedNumbers.length===10,"시트 "+sheet+": 추천출제는 정확히 10개여야 합니다 (현재 "+selectedNumbers.length+"개).");
  const bibleRange=meta("성경범위")||KNOWN_BIBLE_RANGES[sheet];
  must(bibleRange,"시트 "+sheet+": 퀴즈 전체 성경범위가 없습니다. 상단 '성경범위'를 입력해 주세요.");
  weeks.push({sheet,title,openDate:sheet,openAt:sheet+"T00:00:00+09:00",closeAt:saturday+"T23:59:00+09:00",lifeDateRange:lifeRange,bibleRange,monthKey,weekIndex,questions,selectedNumbers,warnings});
 }
 weeks.sort((a,b)=>a.openDate.localeCompare(b.openDate));
 return {hash:createHash("sha256").update(buffer).digest("hex"),weeks,totalCandidates:weeks.reduce((n,w)=>n+w.questions.length,0),
  totalSelected:weeks.reduce((n,w)=>n+w.selectedNumbers.length,0),warnings:weeks.flatMap(w=>w.warnings)};
}
