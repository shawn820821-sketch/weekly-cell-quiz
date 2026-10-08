import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireAdmin, hashSetupCode } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { personId } = await request.json() as { personId?: string };
    if (!personId) return NextResponse.json({ error: "대상 운영자를 선택해주세요." }, { status: 400 });
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    await supabaseRest("operator_setup_codes", { method: "POST", body: JSON.stringify({ person_id: personId, code_hash: hashSetupCode(code), expires_at: expiresAt, created_by: admin.personId }) });
    return NextResponse.json({ setupCode: code, expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "설정코드 발급에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: message === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
