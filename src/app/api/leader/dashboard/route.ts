import { NextResponse } from "next/server";
import { getLeaderDashboard } from "@/server/leaderRepository";
export async function GET(){try{return NextResponse.json(await getLeaderDashboard());}catch(error){const message=error instanceof Error?error.message:"리더 데이터를 불러오지 못했습니다.";return NextResponse.json({error:message},{status:message==="LEADER_REQUIRED"||message==="OPERATOR_REQUIRED"?403:500});}}
