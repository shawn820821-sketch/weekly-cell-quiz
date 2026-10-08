import { supabaseRest } from "@/lib/supabase/rest";

type SubmissionRow = { person_id:string; group_id_snapshot:string|null; score:number; quiz_id:string; submitted_at:string };
type PersonRow = { id:string; display_name:string; ranking_eligible:boolean };
type QuizRow = { id:string; monthly_period_id:string|null; open_at:string|null; close_at:string|null; status:string };
type MembershipRow = { person_id:string; group_id:string; starts_on:string; ends_on:string|null };
type PeriodRow = { id:string; starts_on:string; ends_on:string; closed:boolean; name:string };

type Ranked = { personId:string; name:string; score:number|null; rank:number|null; participated:boolean };
function rankWithMissing(rows:Array<{personId:string;name:string;score:number|null}>):Ranked[]{
 const participated=rows.filter(r=>r.score!==null).sort((a,b)=>(b.score!-a.score!)||a.name.localeCompare(b.name,"ko-KR"));
 let last:number|null=null, rank=0; const ranked:Ranked[]=participated.map((r,i)=>{if(last===null||r.score!==last)rank=i+1;last=r.score;return {...r,rank,participated:true};});
 const missing=rows.filter(r=>r.score===null).sort((a,b)=>a.name.localeCompare(b.name,"ko-KR")).map(r=>({...r,rank:null,participated:false}));
 return [...ranked,...missing];
}
async function eligiblePeopleForGroup(groupId:string,onDate:string){
 const [members,people]=await Promise.all([
  supabaseRest<MembershipRow[]>(`group_memberships?group_id=eq.${groupId}&starts_on=lte.${onDate}&or=(ends_on.is.null,ends_on.gte.${onDate})&select=person_id,group_id,starts_on,ends_on`),
  supabaseRest<PersonRow[]>("people?ranking_eligible=eq.true&select=id,display_name,ranking_eligible"),
 ]);
 const names=new Map(people.map(p=>[p.id,p.display_name]));
 return members.filter(m=>names.has(m.person_id)).map(m=>({personId:m.person_id,name:names.get(m.person_id)!}));
}
export async function getWeeklyResult(quizId:string,personId:string){
 const [quiz,own]=await Promise.all([
  supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&limit=1&select=id,monthly_period_id,open_at,close_at,status`),
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&limit=1&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`)
 ]);
 if(!own[0]) throw new Error("Official result not found."); const groupId=own[0].group_id_snapshot; if(!groupId) return {groupId:null,ranking:[],me:null,final:false};
 const onDate=(quiz[0]?.open_at??own[0].submitted_at).slice(0,10);
 const [subs,eligible]=await Promise.all([
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${quizId}&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`),
  eligiblePeopleForGroup(groupId,onDate)
 ]);
 const scores=new Map(subs.map(s=>[s.person_id,s.score])); const ranking=rankWithMissing(eligible.map(p=>({...p,score:scores.has(p.personId)?scores.get(p.personId)!:null})));
 const final=Boolean(quiz[0]?.close_at&&Date.now()>new Date(quiz[0].close_at!).getTime());
 return {groupId,ranking,me:ranking.find(r=>r.personId===personId)??null,final,label:final?"최종 결과":"진행 중 · 토요일 마감 후 최종 확정"};
}
export async function getMonthlyResult(quizId:string,personId:string){
 const quiz=await supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&limit=1&select=id,monthly_period_id,open_at,close_at,status`); const periodId=quiz[0]?.monthly_period_id; if(!periodId)return{periodId:null,ranking:[],me:null,final:false};
 const [period,own]=await Promise.all([
  supabaseRest<PeriodRow[]>(`monthly_periods?id=eq.${periodId}&limit=1&select=id,starts_on,ends_on,closed,name`),
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&limit=1&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`)
 ]);
 const groupId=own[0]?.group_id_snapshot;if(!groupId)return{periodId,ranking:[],me:null,final:Boolean(period[0]?.closed)};
 const quizzes=await supabaseRest<QuizRow[]>(`quizzes?monthly_period_id=eq.${periodId}&quiz_type=eq.WEEKLY&select=id,monthly_period_id,open_at,close_at,status`);const ids=quizzes.map(q=>q.id);if(!ids.length)return{periodId,groupId,ranking:[],me:null,final:Boolean(period[0]?.closed)};
 const onDate=period[0]?.ends_on??new Date().toISOString().slice(0,10); const [subs,eligible]=await Promise.all([
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`),
  eligiblePeopleForGroup(groupId,onDate)
 ]);
 const totals=new Map<string,number>();for(const s of subs)totals.set(s.person_id,(totals.get(s.person_id)??0)+s.score);
 const ranking=rankWithMissing(eligible.map(p=>({...p,score:totals.has(p.personId)?totals.get(p.personId)!:null}))); const final=Boolean(period[0]?.closed);
 return {periodId,groupId,ranking,me:ranking.find(r=>r.personId===personId)??null,final,label:final?`${period[0]?.name??"월간"} Winner 확정`:"이번 달 현재 순위"};
}
