import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { parseRecommendedWorkbook } from "@/server/recommendedImport";
import { inspectRecommendedConflicts } from "@/server/recommendedImportServer";

export const runtime="nodejs";
export async function POST(request:Request){
 try{
  await requireAdmin();
  const form=await request.formData(),file=form.get("file");
  if(!(file instanceof File)||!/\.xlsx$/i.test(file.name))
   return NextResponse.json({error:".xlsx 파일을 선택해주세요."},{status:400});
  const book=parseRecommendedWorkbook(Buffer.from(await file.arrayBuffer()));
  if(book.weeks.some(w=>Date.parse(w.openAt)<=Date.now()))
   return NextResponse.json({error:"공개가 이미 시작된 주차는 자동 재등록할 수 없습니다."},{status:409});
  const conflicts=await inspectRecommendedConflicts(book.weeks);
  return NextResponse.json({
   fileName:file.name,sourceHash:book.hash,
   ready:conflicts.length===0,conflicts,warnings:book.warnings,
   totalCandidates:book.totalCandidates,totalSelected:book.totalSelected,
   weeks:book.weeks.map(w=>({
    sheet:w.sheet,title:w.title,openAt:w.openAt,closeAt:w.closeAt,monthKey:w.monthKey,
    weekIndex:w.weekIndex,bibleRange:w.bibleRange,candidateCount:w.questions.length,
    selectedCount:w.selectedNumbers.length,selectedNumbers:w.selectedNumbers,warnings:w.warnings
   }))
  });
 }catch(e){const message=e instanceof Error?e.message:"추천 자동등록 미리보기 실패";
  return NextResponse.json({error:message},{status:message==="ADMIN_REQUIRED"?403:400});
 }
}
