import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function GET(){try{await requireAdmin();const imports=await supabaseRest("content_imports?status=eq.COMMITTED&order=created_at.desc&select=id,source_name,month_key,created_at,summary");return NextResponse.json({imports});}catch(e){const m=e instanceof Error?e.message:"불러오기 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
