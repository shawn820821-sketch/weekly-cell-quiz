import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export type ImportQuestion = {
  row:number; no:number; questionType:"MCQ"|"OX"; prompt:string; choices:string[]; correctAnswer:string;
  explanation:string; bibleRange:string; difficulty:"EASY"|"MEDIUM"|"HARD"; note:string;
};
export type ImportWeek = { sheetName:string; title:string; lifeDateRange:string; bibleRange:string; openAt:string; closeAt:string; memo:string; questions:ImportQuestion[]; errors:string[] };

const str=(v:unknown)=>String(v??"").trim();
function typeOf(v:unknown):"MCQ"|"OX"|null{const s=str(v).toUpperCase();if(["MCQ","객관식","4지선다"].includes(s))return "MCQ";if(["OX","O/X","오엑스"].includes(s))return "OX";return null;}
function difficultyOf(v:unknown){const s=str(v).toUpperCase();return (["EASY","MEDIUM","HARD"].includes(s)?s:"MEDIUM") as "EASY"|"MEDIUM"|"HARD";}

export function parseMonthlyWorkbook(buffer:Buffer){
  const hash=createHash("sha256").update(buffer).digest("hex");
  const wb=XLSX.read(buffer,{type:"buffer",cellDates:false});
  const weeks:ImportWeek[]=[];
  for(const sheetName of wb.SheetNames.filter(n=>/^\d+주차$/.test(n))){
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,defval:"",raw:false});
    const meta=(key:string)=>{const r=rows.find(r=>str(r[0])===key);return r?str(r[1]):"";};
    const week:ImportWeek={sheetName,title:meta("퀴즈제목")||`${sheetName} 주간 셀 퀴즈`,lifeDateRange:meta("생명의삶 기간"),bibleRange:meta("성경범위"),openAt:meta("공개일시"),closeAt:meta("마감일시"),memo:meta("출제메모"),questions:[],errors:[]};
    const headerIndex=rows.findIndex(r=>str(r[0])==="번호"&&str(r[1])==="문제유형");
    if(headerIndex<0){week.errors.push("문제 헤더 행을 찾지 못했습니다.");weeks.push(week);continue;}
    for(let i=headerIndex+1;i<rows.length;i++){
      const r=rows[i]; const prompt=str(r[2]); if(!prompt) continue;
      const qt=typeOf(r[1]); if(!qt){week.errors.push(`${i+1}행: 문제유형은 MCQ 또는 OX여야 합니다.`);continue;}
      const answer=str(r[7]).toUpperCase();
      const choices=qt==="OX"?["O","X"]:[str(r[3]),str(r[4]),str(r[5]),str(r[6])];
      if(qt==="MCQ"&&choices.some(x=>!x)){week.errors.push(`${i+1}행: 4지선다 보기를 모두 입력해주세요.`);continue;}
      if(qt==="MCQ"&&!['A','B','C','D'].includes(answer)){week.errors.push(`${i+1}행: MCQ 정답은 A/B/C/D 중 하나여야 합니다.`);continue;}
      if(qt==="OX"&&!['O','X'].includes(answer)){week.errors.push(`${i+1}행: OX 정답은 O 또는 X여야 합니다.`);continue;}
      week.questions.push({row:i+1,no:Number(r[0])||week.questions.length+1,questionType:qt,prompt,choices,correctAnswer:answer,explanation:str(r[8]),bibleRange:str(r[9])||week.bibleRange,difficulty:difficultyOf(r[10]),note:str(r[11])});
    }
    if(week.questions.length>0&&week.questions.length<=10) week.errors.push("후보 문제는 최종 선택을 위해 10개를 초과하는 것을 권장합니다.");
    weeks.push(week);
  }
  return {hash,weeks,totalQuestions:weeks.reduce((n,w)=>n+w.questions.length,0),totalErrors:weeks.reduce((n,w)=>n+w.errors.length,0)};
}
