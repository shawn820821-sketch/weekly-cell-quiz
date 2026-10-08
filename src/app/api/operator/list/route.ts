import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase/rest";

type RoleRow = { person_id: string; role: "LEADER" | "ADMIN"; target_group_id: string | null };
type PersonRow = { id: string; display_name: string; active: boolean };
type CredentialRow = { person_id: string };

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const [roles, people, credentials] = await Promise.all([
    supabaseRest<RoleRow[]>(`roles?starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&role=in.(LEADER,ADMIN)&select=person_id,role,target_group_id`),
    supabaseRest<PersonRow[]>("people?active=eq.true&select=id,display_name,active&order=display_name.asc"),
    supabaseRest<CredentialRow[]>("operator_credentials?select=person_id"),
  ]);
  const roleMap = new Map<string, RoleRow[]>();
  for (const role of roles) roleMap.set(role.person_id, [...(roleMap.get(role.person_id) ?? []), role]);
  const credentialSet = new Set(credentials.map((row) => row.person_id));
  const operators = people.filter((p) => roleMap.has(p.id)).map((p) => ({
    id: p.id,
    name: p.display_name,
    roles: roleMap.get(p.id) ?? [],
    pinConfigured: credentialSet.has(p.id),
  }));
  return NextResponse.json({ operators });
}
