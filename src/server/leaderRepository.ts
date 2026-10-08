import { supabaseRest } from "@/lib/supabase/rest";
import { requireOperator } from "@/server/operatorAuth";

type QuizRow={id:string;title:string;status:string;monthly_period_id:string|null;open_at:string|null;close_at:string|null};
type MembershipRow={person_id:string;group_id:string};
type PersonRow={id:string;display_name:string;active:boolean;ranking_eligible:boolean};
type SubmissionRow={person_id:string;quiz_id:string;score:number;group_id_snapshot:string|null;mode:string};

export async function getLeaderDashboard(){
  const session=await requireOperator();
  const leader=session.roles.find(r=>r.role==="LEADER"&&r.target_group_id);
  if(!leader?.target_group_id) throw new Error("LEADER_REQUIRED");
  const groupId=leader.target_group_id;
  const today=new Date().toISOString().slice(0,10);
  const [quizRows,memberships,people]=await Promise.all([
    supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&status=in.(OPEN,CLOSED,SCHEDULED)&order=open_at.desc&limit=8&select=id,title,status,monthly_period_id,open_at,close_at"),
    supabaseRest<MembershipRow[]>(`group_memberships?group_id=eq.${groupId}&starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,group_id`),
    supabaseRest<PersonRow[]>("people?active=eq.true&select=id,display_name,active,ranking_eligible"),
  ]);
  const current=quizRows.find(q=>q.status==="OPEN")??quizRows[0]??null;
  const memberIds=memberships.map(m=>m.person_id);
  const nameMap=new Map(people.map(p=>[p.id,p]));
  if(!current||!memberIds.length){return {groupId,currentQuiz:current,members:[],submitted:0,eligible:memberIds.length,average:null,monthlyLeader:null};}
  const currentSubs=await supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${current.id}&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,quiz_id,score,group_id_snapshot,mode`);
  let monthlySubs:SubmissionRow[]=[];
  if(current.monthly_period_id){
    const monthlyQuizzes=await supabaseRest<Array<{id:string}>>(`quizzes?monthly_period_id=eq.${current.monthly_period_id}&quiz_type=eq.WEEKLY&select=id`);
    const ids=monthlyQuizzes.map(q=>q.id);
    if(ids.length) monthlySubs=await supabaseRest<SubmissionRow[]>(`submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,quiz_id,score,group_id_snapshot,mode`);
  }
  const weeklyBy=new Map(currentSubs.map(s=>[s.person_id,s.score]));
  const monthlyBy=new Map<string,number>();
  for(const s of monthlySubs) monthlyBy.set(s.person_id,(monthlyBy.get(s.person_id)??0)+s.score);
  const members=memberIds.map(id=>({personId:id,name:nameMap.get(id)?.display_name??"알 수 없음",weeklyScore:weeklyBy.get(id)??null,monthlyScore:monthlyBy.get(id)??0,submitted:weeklyBy.has(id)})).sort((a,b)=>Number(b.submitted)-Number(a.submitted)||b.monthlyScore-a.monthlyScore||a.name.localeCompare(b.name,"ko-KR"));
  const scores=currentSubs.map(s=>s.score);
  const monthlyLeader=[...members].sort((a,b)=>b.monthlyScore-a.monthlyScore||a.name.localeCompare(b.name,"ko-KR"))[0]??null;
  return {groupId,currentQuiz:current,members,submitted:currentSubs.length,eligible:memberIds.length,average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,monthlyLeader};
}
