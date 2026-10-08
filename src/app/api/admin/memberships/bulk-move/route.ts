import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function POST(request:Request){
 try{const admin=await requireAdmin(); const {personIds,groupId,effectiveDate}=await request.json() as {personIds:string[];groupId:string;effectiveDate:string};
  if(!personIds?.length||!groupId||!effectiveDate)return NextResponse.json({error:"대상, 셀, 적용일을 확인해주세요."},{status:400});
  const prev=new Date(effectiveDate+"T00:00:00Z");prev.setUTCDate(prev.getUTCDate()-1);const end=prev.toISOString().slice(0,10);
  for(const personId of personIds){await supabaseRest(`group_memberships?person_id=eq.${personId}&ends_on=is.null`,{method:"PATCH",body:JSON.stringify({ends_on:end})});await supabaseRest("group_memberships",{method:"POST",body:JSON.stringify({person_id:personId,group_id:groupId,starts_on:effectiveDate})});}
  await supabaseRest("operator_audit_log",{method:"POST",body:JSON.stringify({actor_person_id:admin.personId,action:"BULK_GROUP_MOVE",target_type:"group",target_id:groupId,detail:{personIds,effectiveDate}})});
  return NextResponse.json({ok:true,moved:personIds.length});
 }catch(e){const m=e instanceof Error?e.message:"이동 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
