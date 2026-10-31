import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { makePreservePlan } from "@/server/preserveImport";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  await requireAdmin();
  const form=await request.formData();
  const file=form.get("file");
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".xlsx"))
   return NextResponse.json({error:"검증할 Excel .xlsx 파일이 필요합니다."},{status:400});
  const preview=await makePreservePlan(Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({fileName:file.name,...preview,readOnly:true,applyEnabled:process.env.ENABLE_SAFE_PRESERVE_EXCEL_APPLY==="true"});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"예약 유지 미리보기 실패"},{status:409});
 }
}
