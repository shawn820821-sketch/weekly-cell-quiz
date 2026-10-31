import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
import { makePreservePlan } from "@/server/preserveImport";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  // Do not expose this action until the reviewed, transaction-safe RPC is installed.
  // By default it remains disabled in ALL environments, including Production.
  if(process.env.ENABLE_SAFE_PRESERVE_EXCEL_APPLY!=="true")
   return NextResponse.json({error:"안전 업데이트 확정 기능은 아직 검증 단계이며 비활성화되어 있습니다."},{status:503});
  const admin=await requireAdmin();
  const form=await request.formData();
  const file=form.get("file");
  const expectedHash=String(form.get("previewHash")??"");
  const backupConfirmed=String(form.get("backupConfirmed")??"");
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".xlsx")||backupConfirmed!=="true")
   return NextResponse.json({error:"동일한 Excel 파일과 사전 백업 확인이 필요합니다."},{status:400});
  const plan=await makePreservePlan(Buffer.from(await file.arrayBuffer()));
  if(!expectedHash||plan.planHash!==expectedHash)
   return NextResponse.json({error:"미리보기 이후 파일 또는 DB 예약·문제 데이터가 변경되었습니다. 처음부터 다시 검증해 주세요."},{status:409});
  const payload={
   p_plan:{weeks:plan.weeks},
   p_source_name:file.name,
   p_source_hash:plan.sourceHash,
   p_preview_hash:plan.planHash,
   p_actor:admin.personId
  };
  const result=await supabaseRest<{ok:boolean;backupId:string;quizzes:number;changedQuestions:number;changedFields:number}>(
   "rpc/apply_preserved_excel_import",{method:"POST",body:JSON.stringify(payload)});
  return NextResponse.json(result);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"예약 유지 업데이트를 확정하지 못했습니다."},{status:409});
 }
}
