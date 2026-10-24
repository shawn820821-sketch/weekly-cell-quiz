import { supabaseRest } from "@/lib/supabase/rest";
import { settlementMonthForQuiz, monthCycleBounds, isSettlementMonthClosed } from "@/lib/monthlyCycle";

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
 const found=await supabaseRest<Array<{id:string;monthly_period_id:string|null;close_at:string|null}>>(
  `quizzes?id=eq.${quizId}&limit=1&select=id,monthly_period_id,close_at`);
 const quiz=found[0];if(!quiz)return {periodId:null,ranking:[],me:null,final:false};
 // ONLY the settlement Sunday in Seoul determines which month owns the quiz.
 const month=settlementMonthForQuiz(quiz.close_at);
 if(!month)return {periodId:null,ranking:[],me:null,final:false};
 const kstDate=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 const {endsOn}=monthCycleBounds(month);
 const [membership,periods,monthQuizzes]=await Promise.all([
  supabaseRest<Array<{group_id:string}>>(`group_memberships?person_id=eq.${personId}&starts_on=lte.${kstDate}&or=(ends_on.is.null,ends_on.gte.${kstDate})&order=starts_on.desc&limit=1&select=group_id`),
  supabaseRest<PeriodRow[]>(`monthly_periods?ends_on=eq.${endsOn}&limit=1&select=id,starts_on,ends_on,closed,name`),
  supabaseRest<Array<{id:string;close_at:string|null;count_in_monthly:boolean}>>(
   "quizzes?quiz_type=eq.WEEKLY&count_in_monthly=eq.true&close_at=not.is.null&order=close_at.desc&limit=120&select=id,close_at,count_in_monthly")
 ]);
 const period=periods[0]??null;
 const periodId=period?.id??quiz.monthly_period_id;
 const groupId=membership[0]?.group_id??null;
 const final=isSettlementMonthClosed(month);
 if(!groupId)return {periodId,groupId:null,ranking:[],me:null,final,label:`${month} 월간 기록`};
 const allowed=await eligiblePeopleForGroup(groupId,kstDate);
 const ids=monthQuizzes.filter(q=>settlementMonthForQuiz(q.close_at)===month).map(q=>q.id);
 const monthSubs=ids.length?await supabaseRest<Array<SubmissionRow & {id:string}>>(
  `submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&order=submitted_at.asc&select=id,person_id,group_id_snapshot,score,quiz_id,submitted_at`):[];
 // An accidental retry never produces extra cumulative score.
 const scores=new Map<string,number>(),seen=new Set<string>();
 for(const sub of monthSubs){
  const key=sub.quiz_id+":"+sub.person_id;
  if(seen.has(key))continue;
  seen.add(key);scores.set(sub.person_id,(scores.get(sub.person_id)??0)+sub.score);
 }
 const ranking=rankWithMissing(allowed.map(p=>({...p,score:scores.get(p.personId)??null})));
 return {periodId,groupId,
  ranking:ranking.filter(r=>r.rank===1),
  me:(()=>{const mine=ranking.find(r=>r.personId===personId);return mine?{...mine,rank:null}:null;})(),
  final,label:final?`${month} 최종 결과`:`${month} 현재 순위`};
}
