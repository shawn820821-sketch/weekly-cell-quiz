import { NextResponse } from "next/server";
import { createOperatorSession, getCredential, verifyPin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

export async function POST(request: Request) {
  try {
    const { personId, pin } = await request.json() as { personId?: string; pin?: string };
    if (!personId || !pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ error: "4자리 PIN을 입력해주세요." }, { status: 400 });
    const credential = await getCredential(personId);
    if (!credential) return NextResponse.json({ error: "PIN을 먼저 설정해주세요.", setupRequired: true }, { status: 409 });
    if (credential.locked_until && new Date(credential.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (!verifyPin(pin, credential.pin_hash)) {
      const failed = credential.failed_attempts + 1;
      const lock = failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await supabaseRest(`operator_credentials?person_id=eq.${personId}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: failed >= 5 ? 0 : failed, locked_until: lock }) });
      return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
    }
    await supabaseRest(`operator_credentials?person_id=eq.${personId}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
    const session = await createOperatorSession(personId);
    return NextResponse.json({ ok: true, roles: session.roles });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "로그인에 실패했습니다." }, { status: 500 });
  }
}
