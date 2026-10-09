import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { requireAdmin } from "@/server/operatorAuth";
import { parseMonthlyWorkbook } from "@/server/excelImport";
import { supabaseRest } from "@/lib/supabase/rest";

export const runtime="nodejs";
const MAX_BYTES=8*1024*1024;
function privateIp(ip:string){
 if(ip==="::1"||ip.startsWith("fc")||ip.startsWith("fd")||ip.startsWith("fe80:"))return true;
 const m=ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);if(!m)return false;
 const [a,b]=[Number(m[1]),Number(m[2])];
 return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
async function safeUrl(raw:string){
 const u=new URL(raw);if(u.protocol!=="https:")throw new Error("HTTPS 주소만 사용할 수 있습니다.");
 if(u.username||u.password)throw new Error("인증정보가 포함된 주소는 사용할 수 없습니다.");
 const host=u.hostname.toLowerCase();if(host==="localhost"||host.endsWith(".local"))throw new Error("로컬 주소는 사용할 수 없습니다.");
 if(isIP(host)&&privateIp(host))throw new Error("사설 네트워크 주소는 사용할 수 없습니다.");
 if(!isIP(host)){const resolved=await lookup(host,{all:true});if(resolved.some((x:{address:string})=>privateIp(x.address)))throw new Error("사설 네트워크로 연결되는 주소는 사용할 수 없습니다.");}
 return u;
}
export async function POST(request:Request){
 try{
  await requireAdmin();const body=await request.json() as {url?:string;mode?:string;replaceImportId?:string;monthKey?:string};if(!body.url)return NextResponse.json({error:"Excel 파일 주소를 입력해주세요."},{status:400});
  const u=await safeUrl(body.url);const response=await fetch(u,{redirect:"follow",headers:{"User-Agent":"WeeklyCellQuiz/1.1"}});if(!response.ok)throw new Error(`파일을 가져오지 못했습니다. (${response.status})`);
  const len=Number(response.headers.get("content-length")||0);if(len>MAX_BYTES)throw new Error("파일이 너무 큽니다. 8MB 이하 Excel 파일만 지원합니다.");
  const buf=Buffer.from(await response.arrayBuffer());if(buf.length>MAX_BYTES)throw new Error("파일이 너무 큽니다. 8MB 이하 Excel 파일만 지원합니다.");
  const parsed=parseMonthlyWorkbook(buf,body.monthKey?.trim()||undefined);let replacementDiff:null|{oldCount:number;newCount:number;added:string[];removed:string[]}=null;
  if(body.mode==="REPLACE"&&body.replaceImportId){const old=await supabaseRest<Array<{prompt:string}>>(`questions?import_id=eq.${body.replaceImportId}&select=prompt`);const oldSet=new Set(old.map(x=>x.prompt));const next=parsed.weeks.flatMap(w=>w.questions.map(q=>q.prompt));const nextSet=new Set(next);replacementDiff={oldCount:old.length,newCount:next.length,added:next.filter(x=>!oldSet.has(x)).slice(0,10),removed:old.map(x=>x.prompt).filter(x=>!nextSet.has(x)).slice(0,10)};}
  const pathName=decodeURIComponent(u.pathname.split("/").pop()||"remote-quiz.xlsx");const fileName=/\.xlsx$/i.test(pathName)?pathName:"remote-quiz.xlsx";
  return NextResponse.json({fileName,...parsed,replacementDiff});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"주소에서 Excel을 불러오지 못했습니다."},{status:400});}
}