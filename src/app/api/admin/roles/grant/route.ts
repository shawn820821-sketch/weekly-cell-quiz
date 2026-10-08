import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireAdmin, getCredential, hashSetupCode } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function POST(request:Request){
 try{
  const admin=await requireAdmin(); const {personId,role,targetGroupId,effectiveDate}=await request.json() as {personId:string;role:"LEADER"|"ADMIN";targetGroupId?:string|null;effectiveDate:string};
  if(!personId||!["LEADER","ADMIN"].includes(role)||!effectiveDate)return NextResponse.json({error:"권한 정보를 확인해주세요."},{status:400});
  if(role==="LEADER"&&!targetGroupId)return NextResponse.json({error:"Leader 담당 셀을 선택해주세요."},{status:400});
  await supabaseRest("roles",{method:"POST",body:JSON.stringify({person_id:personId,role,target_group_id:role==="LEADER"?targetGroupId:null,starts_on:effectiveDate})});
  const credential=await getCredential(personId);
  if(credential)return NextResponse.json({ok:true,pinAlreadyConfigured:true});
  const code=randomInt(100000,1000000).toString();const expiresAt=new Date(Date.now()+24*60*60_000).toISOString();
  await supabaseRest("operator_setup_codes",{method:"POST",body:JSON.stringify({person_id:personId,code_hash:hashSetupCode(code),expires_at:expiresAt,created_by:admin.personId})});
  return NextResponse.json({ok:true,pinAlreadyConfigured:false,setupCode:code,expiresAt});
 }catch(e){const m=e instanceof Error?e.message:"권한 부여 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
