import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { parseMonthlyWorkbook } from "@/server/excelImport";
import { supabaseRest } from "@/lib/supabase/rest";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  await requireAdmin();
  const form=await request.formData(); const file=form.get("file"); const mode=String(form.get("mode")??"NEW"); const replaceImportId=String(form.get("replaceImportId")??"");
  if(!(file instanceof File))return NextResponse.json({error:"Excel 파일을 선택해주세요."},{status:400});
  if(!/\.xlsx$/i.test(file.name))return NextResponse.json({error:".xlsx 파일만 지원합니다."},{status:400});
  const parsed=parseMonthlyWorkbook(Buffer.from(await file.arrayBuffer()));
  let replacementDiff:null|{oldCount:number;newCount:number;added:string[];removed:string[]}=null;
  if(mode==="REPLACE"&&replaceImportId){
    const old=await supabaseRest<Array<{prompt:string}>>(`questions?import_id=eq.${replaceImportId}&select=prompt`);
    const oldSet=new Set(old.map(x=>x.prompt)); const next=parsed.weeks.flatMap(w=>w.questions.map(q=>q.prompt)); const nextSet=new Set(next);
    replacementDiff={oldCount:old.length,newCount:next.length,added:next.filter(x=>!oldSet.has(x)).slice(0,10),removed:old.map(x=>x.prompt).filter(x=>!nextSet.has(x)).slice(0,10)};
  }
  return NextResponse.json({fileName:file.name,...parsed,replacementDiff});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"미리보기에 실패했습니다."},{status:500});}
}
