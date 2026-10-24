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
 const quizzes=await supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&limit=1&select=id,monthly_period_id,open_at,close_at,status`);
 const quiz=quizzes[0];
 if(!quiz)throw new Error("Quiz not found.");
 const onDate=(quiz.open_at??new Date().toISOString()).slice(0,10);
 const [own,memberships]=await Promise.all([
   supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&order=submitted_at.asc&limit=1&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`),
   supabaseRest<MembershipRow[]>(`group_memberships?person_id=eq.${personId}&starts_on=lte.${onDate}&or=(ends_on.is.null,ends_on.gte.${onDate})&order=starts_on.desc&limit=1&select=person_id,group_id,starts_on,ends_on`)
 ]);
 const groupId=own[0]?.group_id_snapshot??memberships[0]?.group_id??null;
 if(!groupId)return {groupId:null,ranking:[],me:null,final:Boolean(quiz.close_at&&Date.now()>new Date(quiz.close_at).getTime())};
 const [subs,eligible]=await Promise.all([
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${quizId}&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&order=submitted_at.asc&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`),
  eligiblePeopleForGroup(groupId,onDate)
 ]);
 const scores=new Map<string,number>();
 for(const sub of subs)if(!scores.has(sub.person_id))scores.set(sub.person_id,sub.score);
 const ranking=rankWithMissing(eligible.map(p=>({...p,score:scores.get(p.personId)??null})));
 const final=Boolean(quiz.close_at&&Date.now()>new Date(quiz.close_at).getTime());
 return {groupId,ranking,me:ranking.find(r=>r.personId===personId)??null,final,label:final?"최종 결과":"진행 중 · 토요일 마감 후 최종 확정"};
}
export async function getMonthlyResult(quizId:string,personId:string){
 const found=await supabaseRest<Array<{id:string;content_month_key:string|null;monthly_period_id:string|null;open_at:string|null}>>(
  `quizzes?id=eq.${quizId}&limit=1&select=id,content_month_key,monthly_period_id,open_at`);
 const quiz=found[0];if(!quiz)return {periodId:null,ranking:[],me:null,final:false};
 // Use the published quiz's month, even before the monthly settlement period is created.
 const month=quiz.content_month_key??(quiz.open_at?new Date(quiz.open_at).toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"}).slice(0,7):null);
 if(!month)return {periodId:null,ranking:[],me:null,final:false};
 const kstDate=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"});
 const [membership,people,monthQuizzes]=await Promise.all([
  supabaseRest<Array<{group_id:string}>>(`group_memberships?person_id=eq.${personId}&starts_on=lte.${kstDate}&or=(ends_on.is.null,ends_on.gte.${kstDate})&order=starts_on.desc&limit=1&select=group_id`),
  supabaseRest<PersonRow[]>("people?ranking_eligible=eq.true&select=id,display_name,ranking_eligible"),
  supabaseRest<Array<{id:string}>>(`quizzes?quiz_type=eq.WEEKLY&content_month_key=eq.${month}&select=id`)
 ]);
 const groupId=membership[0]?.group_id??null;
 if(!groupId)return {periodId:quiz.monthly_period_id,groupId:null,ranking:[],me:null,final:false};
 const allowed=await eligiblePeopleForGroup(groupId,kstDate);
 const ids=monthQuizzes.map(q=>q.id);
 const monthSubs=ids.length?await supabaseRest<Array<SubmissionRow & {id:string}>>(
  `submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&order=submitted_at.asc&select=id,person_id,group_id_snapshot,score,quiz_id,submitted_at`):[];
 // Only the earliest official submission per person per quiz counts.
 const scores=new Map<string,number>(), seen=new Set<string>();
 for(const sub of monthSubs){
  const key=sub.quiz_id+":"+sub.person_id;
  if(seen.has(key))continue;
  seen.add(key);scores.set(sub.person_id,(scores.get(sub.person_id)??0)+sub.score);
 }
 const ranking=rankWithMissing(allowed.map(p=>({...p,score:scores.get(p.personId)??null})));
 const period=quiz.monthly_period_id?await supabaseRest<PeriodRow[]>(`monthly_periods?id=eq.${quiz.monthly_period_id}&limit=1&select=id,starts_on,ends_on,closed,name`):[];
 return {periodId:quiz.monthly_period_id,groupId,
  // Participants see only the current leader, not the complete monthly ranking.
  ranking:ranking.filter(r=>r.rank===1),
  me:ranking.find(r=>r.personId===personId)??null,final:Boolean(period[0]?.closed),
  label:period[0]?.closed?`${period[0]?.name??month} 결과`:`${month} 현재 순위`};
}
