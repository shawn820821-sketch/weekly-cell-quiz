import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET(){
 try{
  await requireAdmin();
  const today=new Date().toISOString().slice(0,10);
  const [people,memberships,groups]=await Promise.all([
    supabaseRest<Array<{id:string;display_name:string;active:boolean;ranking_eligible:boolean}>>("people?order=display_name.asc&select=id,display_name,active,ranking_eligible"),
    supabaseRest<Array<{person_id:string;group_id:string}>>(`group_memberships?starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,group_id`),
    supabaseRest<Array<{id:string;name:string}>>("groups?select=id,name")
  ]);
  const gm=new Map(memberships.map(m=>[m.person_id,m.group_id]));const names=new Map(groups.map(g=>[g.id,g.name]));
  return NextResponse.json({people:people.map(p=>({...p,group_id:gm.get(p.id)??null,group_name:names.get(gm.get(p.id)??"")??null}))});
 }catch(e){const m=e instanceof Error?e.message:"오류";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
export async function POST(request:Request){try{await requireAdmin();const body=await request.json();const person=await supabaseRest("people",{method:"POST",body:JSON.stringify({display_name:body.name,active:true,ranking_eligible:body.rankingEligible??true})});return NextResponse.json({person},{status:201});}catch(e){const m=e instanceof Error?e.message:"추가 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
export async function PATCH(request:Request){try{await requireAdmin();const body=await request.json();if(!body.id)return NextResponse.json({error:"id 필요"},{status:400});const person=await supabaseRest(`people?id=eq.${body.id}`,{method:"PATCH",body:JSON.stringify({display_name:body.name,active:body.active,ranking_eligible:body.rankingEligible})});return NextResponse.json({person});}catch(e){const m=e instanceof Error?e.message:"수정 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
