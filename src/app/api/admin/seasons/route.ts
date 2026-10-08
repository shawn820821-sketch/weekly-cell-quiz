import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { createSeason, listSeasons, setActiveSeason } from "@/server/seasonSpecialRepository";
export async function GET(){ try{await requireAdmin();return NextResponse.json({seasons:await listSeasons()});}catch(e){const m=e instanceof Error?e.message:"오류";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
export async function POST(r:Request){ try{await requireAdmin();const b=await r.json();if(b.action==="activate")return NextResponse.json({season:await setActiveSeason(b.id)});return NextResponse.json({season:await createSeason({name:b.name,startsOn:b.startsOn,endsOn:b.endsOn,active:Boolean(b.active)})},{status:201});}catch(e){const m=e instanceof Error?e.message:"Season 저장 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:400});}}
