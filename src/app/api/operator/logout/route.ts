import { NextResponse } from "next/server";
import { clearOperatorSession } from "@/server/operatorAuth";
export async function POST() { await clearOperatorSession(); return NextResponse.json({ ok: true }); }
