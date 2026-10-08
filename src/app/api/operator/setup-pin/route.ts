import { NextResponse } from "next/server";
import { hashPin, hashSetupCode, createOperatorSession } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";

type SetupRow = { id: string; code_hash: string; expires_at: string; used_at: string | null; failed_attempts: number; locked_until: string | null };
export async function POST(request: Request) {
  try {
    const { personId, setupCode, pin } = await request.json() as { personId?: string; setupCode?: string; pin?: string };
    if (!personId || !setupCode || !pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ error: "설정코드와 4자리 PIN을 확인해주세요." }, { status: 400 });
    const rows = await supabaseRest<SetupRow[]>(`operator_setup_codes?person_id=eq.${personId}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc&limit=1&select=id,code_hash,expires_at,used_at,failed_attempts,locked_until`);
    const setup = rows[0];
    if (!setup) return NextResponse.json({ error: "설정코드가 올바르지 않거나 만료됐어요." }, { status: 401 });
    if (setup.locked_until && new Date(setup.locked_until).getTime() > Date.now()) return NextResponse.json({ error: "설정코드 입력을 잠시 후 다시 시도해주세요." }, { status: 429 });
    if (setup.code_hash !== hashSetupCode(setupCode)) {
      const failed = (setup.failed_attempts ?? 0) + 1;
      const lock = failed >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
      await supabaseRest(`operator_setup_codes?id=eq.${setup.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: failed >= 5 ? 0 : failed, locked_until: lock }) });
      return NextResponse.json({ error: "설정코드가 올바르지 않거나 만료됐어요." }, { status: 401 });
    }
    await supabaseRest(`operator_setup_codes?id=eq.${setup.id}`, { method: "PATCH", body: JSON.stringify({ failed_attempts: 0, locked_until: null }) });
    await supabaseRest("operator_credentials?on_conflict=person_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ person_id: personId, pin_hash: hashPin(pin), pin_changed_at: new Date().toISOString(), failed_attempts: 0, locked_until: null }) });
    await supabaseRest(`operator_setup_codes?id=eq.${setup.id}`, { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) });
    const session = await createOperatorSession(personId);
    return NextResponse.json({ ok: true, roles: session.roles });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PIN 설정에 실패했습니다." }, { status: 500 });
  }
}
