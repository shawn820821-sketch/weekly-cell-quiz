import { NextResponse } from "next/server";
import { getOperatorSession } from "@/server/operatorAuth";
export async function GET() { const session = await getOperatorSession(); return NextResponse.json({ session }); }
