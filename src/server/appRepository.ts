import { supabaseRest } from "@/lib/supabase/rest";

type GroupRow = { id: string; name: string; active: boolean };
type PersonRow = { id: string; display_name: string; active: boolean };
type MembershipRow = { person_id: string; group_id: string };
type RoleRow = { person_id: string; role: "PARTICIPANT" | "LEADER" | "ADMIN"; target_group_id: string | null };
type QuizRow = {
  id: string; title: string; subtitle: string | null; life_date_range: string | null; bible_range: string | null;
  open_at: string | null; close_at: string | null; status: string; quiz_type: "WEEKLY" | "SPECIAL";
  selection_mode: "FIXED"|"RANDOM"; random_question_count:number|null; published_question_count:number|null;
};

export async function getParticipantBootstrap() {
  const today = new Date().toISOString().slice(0, 10);
  const [groups, people, memberships, roles, quizzes] = await Promise.all([
    supabaseRest<GroupRow[]>("groups?active=eq.true&order=name.asc&select=id,name,active"),
    supabaseRest<PersonRow[]>("people?active=eq.true&order=display_name.asc&select=id,display_name,active"),
    supabaseRest<MembershipRow[]>(`group_memberships?starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,group_id`),
    supabaseRest<RoleRow[]>(`roles?starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,role,target_group_id`),
    supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&status=in.(OPEN,SCHEDULED)&order=open_at.asc&limit=3&select=id,title,subtitle,life_date_range,bible_range,open_at,close_at,status,quiz_type,selection_mode,random_question_count,published_question_count"),
  ]);
  const personMap = new Map(people.map((p) => [p.id, p]));
  const leaderIds = new Set(roles.filter((r) => r.role === "LEADER").map((r) => r.person_id));
  const membersByGroup = new Map<string, Array<{ id: string; name: string; leader: boolean; active: boolean }>>();
  for (const m of memberships) { const person = personMap.get(m.person_id); if (!person) continue; const arr = membersByGroup.get(m.group_id) ?? []; arr.push({ id: person.id, name: person.display_name, leader: leaderIds.has(person.id), active: person.active }); membersByGroup.set(m.group_id, arr); }
  const shapedGroups = groups.map((g) => ({ id: g.id, name: g.name, members: (membersByGroup.get(g.id) ?? []).sort((a,b)=>a.leader!==b.leader?(a.leader?-1:1):a.name.localeCompare(b.name,"ko-KR")) }));
  const now = Date.now();
  const currentQuiz = quizzes.find((q) => q.open_at && q.close_at && new Date(q.open_at).getTime() <= now && now <= new Date(q.close_at).getTime()) ?? quizzes[0] ?? null;
  return { groups: shapedGroups, currentQuiz };
}
