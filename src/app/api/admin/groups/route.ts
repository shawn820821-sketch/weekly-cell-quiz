import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function GET(){try{await requireAdmin();return NextResponse.json({groups:await supabaseRest("groups?order=name.asc&select=id,name,active")});}catch(e){const m=e instanceof Error?e.message:"오류";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
export async function POST(request:Request){try{await requireAdmin();const body=await request.json();const group=await supabaseRest("groups",{method:"POST",body:JSON.stringify({name:body.name,active:true})});return NextResponse.json({group},{status:201});}catch(e){const m=e instanceof Error?e.message:"추가 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}

export async function PATCH(request:Request){try{await requireAdmin();const body=await request.json();if(!body.id)return NextResponse.json({error:"id 필요"},{status:400});const group=await supabaseRest(`groups?id=eq.${body.id}`,{method:"PATCH",body:JSON.stringify({name:body.name,active:body.active})});return NextResponse.json({group});}catch(e){const m=e instanceof Error?e.message:"셀 수정 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
