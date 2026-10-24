import { supabaseRest } from "@/lib/supabase/rest";
import { monthCycleBounds,settlementMonthForQuiz,isSettlementMonthClosed } from "@/lib/monthlyCycle";

type SeasonRow = { id:string; name:string; starts_on:string; ends_on:string; active:boolean };
type MonthlyPeriodRow = { id:string; season_id:string|null; name:string; starts_on:string; ends_on:string; closed:boolean };
type SubmissionRow = { person_id:string; group_id_snapshot:string|null; score:number; quiz_id:string; submitted_at:string };
type PersonRow = { id:string; display_name:string; ranking_eligible:boolean };
type QuizRow = { id:string; monthly_period_id:string|null; quiz_type:string; close_at:string|null; count_in_monthly:boolean };

function competitionRanks(rows:Array<{personId:string; groupId:string|null; score:number; participationCount:number; name:string}>){
  const byGroup = new Map<string, typeof rows>();
  for (const row of rows) { const k=row.groupId ?? "__UNGROUPED__"; const list=byGroup.get(k)??[]; list.push(row); byGroup.set(k,list); }
  const out:Array<typeof rows[number] & {rank:number}> = [];
  for (const list of byGroup.values()) {
    list.sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,"ko-KR"));
    let last:number|null=null; let rank=0;
    list.forEach((r,i)=>{ if(last===null || r.score!==last) rank=i+1; last=r.score; out.push({...r,rank}); });
  }
  return out;
}

export async function listSeasons(){ return supabaseRest<SeasonRow[]>("seasons?order=starts_on.desc&select=*"); }
export async function createSeason(input:{name:string;startsOn:string;endsOn:string;active:boolean}){
  if(input.active){ await supabaseRest("seasons?active=eq.true",{method:"PATCH",body:JSON.stringify({active:false})}); }
  const rows=await supabaseRest<SeasonRow[]>("seasons",{method:"POST",body:JSON.stringify({name:input.name,starts_on:input.startsOn,ends_on:input.endsOn,active:input.active})});
  return rows[0];
}
export async function setActiveSeason(id:string){
  await supabaseRest("seasons?active=eq.true",{method:"PATCH",body:JSON.stringify({active:false})});
  const rows=await supabaseRest<SeasonRow[]>(`seasons?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({active:true})});
  return rows[0];
}
export async function listMonthlyPeriods(){ return supabaseRest<MonthlyPeriodRow[]>("monthly_periods?order=starts_on.desc&select=*"); }
export async function createMonthlyPeriod(input:{seasonId:string;name:string;startsOn:string;endsOn:string}){
 const month=input.endsOn.slice(0,7);
 const bounds=monthCycleBounds(month);
 // A month is entirely defined by its last Sunday. Ignore any manually entered start date.
 if(input.endsOn!==bounds.endsOn)throw new Error("월간 결산일은 그달의 마지막 일요일이어야 합니다.");
 const duplicates=await supabaseRest<MonthlyPeriodRow[]>(`monthly_periods?ends_on=eq.${bounds.endsOn}&select=id,season_id,name,starts_on,ends_on,closed`);
 if(duplicates.length)throw new Error("이미 등록된 월간 결산 기간입니다.");
 const rows=await supabaseRest<MonthlyPeriodRow[]>("monthly_periods",{method:"POST",body:JSON.stringify({
  season_id:input.seasonId,name:input.name||`${month.slice(0,4)}년 ${Number(month.slice(5))}월`,
  starts_on:bounds.startsOn,ends_on:bounds.endsOn,closed:false
 })});
 const period=rows[0];
 if(period){
  const quizzes=await supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&close_at=not.is.null&select=id,monthly_period_id,quiz_type,close_at,count_in_monthly");
  const attach=quizzes.filter(q=>!q.monthly_period_id && settlementMonthForQuiz(q.close_at)===month).map(q=>q.id);
  if(attach.length)await supabaseRest(`quizzes?id=in.(${attach.join(",")})`,{method:"PATCH",body:JSON.stringify({monthly_period_id:period.id})});
 }
 return period;
}

export async function settleMonthlyPeriod(periodId:string){
 const periods=await supabaseRest<MonthlyPeriodRow[]>(`monthly_periods?id=eq.${periodId}&limit=1&select=*`);
 const period=periods[0];
 if(!period)throw new Error("월간 기간을 찾지 못했습니다.");
 if(period.closed)throw new Error("이미 최종 결산된 월입니다.");
 const month=period.ends_on.slice(0,7);
 if(period.ends_on!==monthCycleBounds(month).endsOn)throw new Error("마지막 일요일 결산 규칙에 맞지 않는 기간입니다.");
 if(!isSettlementMonthClosed(month))throw new Error("마지막 일요일이 끝난 후 월요일부터 결산할 수 있습니다.");
 const all=await supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&close_at=not.is.null&count_in_monthly=eq.true&select=id,monthly_period_id,quiz_type,close_at,count_in_monthly");
 const ids=all.filter(q=>settlementMonthForQuiz(q.close_at)===month).map(q=>q.id);
 if(!ids.length)throw new Error("해당 월에 포함되는 주간 퀴즈가 없습니다.");
 const [subs,people]=await Promise.all([
  supabaseRest<SubmissionRow[]>(`submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&order=submitted_at.asc&select=person_id,group_id_snapshot,score,quiz_id,submitted_at`),
  supabaseRest<PersonRow[]>("people?ranking_eligible=eq.true&select=id,display_name,ranking_eligible")
 ]);
 const names=new Map(people.map(p=>[p.id,p.display_name]));
 const memberships=await supabaseRest<Array<{person_id:string;group_id:string}>>(
  `group_memberships?starts_on=lte.${period.ends_on}&or=(ends_on.is.null,ends_on.gte.${period.ends_on})&select=person_id,group_id`);
 const eligibleMemberships=memberships.filter(m=>names.has(m.person_id));
 const agg=new Map<string,{personId:string;groupId:string|null;score:number;participationCount:number;name:string}>();
 for(const m of eligibleMemberships){
  const key=`${m.person_id}:${m.group_id}`;
  agg.set(key,{personId:m.person_id,groupId:m.group_id,score:0,participationCount:0,name:names.get(m.person_id)!});
 }
 const seen=new Set<string>();
 for(const sub of subs){
  if(!names.has(sub.person_id))continue;
  const attemptKey=`${sub.quiz_id}:${sub.person_id}`;
  if(seen.has(attemptKey))continue;
  seen.add(attemptKey);
  const key=`${sub.person_id}:${sub.group_id_snapshot??""}`;
  const cur=agg.get(key)??{personId:sub.person_id,groupId:sub.group_id_snapshot,score:0,participationCount:0,name:names.get(sub.person_id)!};
  cur.score+=sub.score;cur.participationCount+=1;agg.set(key,cur);
 }
 const active=[...agg.values()].filter(r=>r.participationCount>0);
 const ranks=competitionRanks(active);
 const rankMap=new Map(ranks.map(r=>[`${r.personId}:${r.groupId??""}`,r.rank]));
 const ranked=[...agg.values()].map(r=>({...r,rank:r.participationCount>0?rankMap.get(`${r.personId}:${r.groupId??""}`)??null:null}));
 await supabaseRest(`monthly_results?monthly_period_id=eq.${periodId}`,{method:"DELETE"});
 await supabaseRest(`monthly_winners?monthly_period_id=eq.${periodId}`,{method:"DELETE"});
 if(ranked.length)await supabaseRest("monthly_results",{method:"POST",body:JSON.stringify(
  ranked.map(r=>({monthly_period_id:periodId,person_id:r.personId,group_id:r.groupId,total_score:r.score,participation_count:r.participationCount,rank:r.rank}))
 )});
 const winners=ranked.filter(r=>r.rank===1&&r.participationCount>0);
 if(winners.length)await supabaseRest("monthly_winners",{method:"POST",body:JSON.stringify(
  winners.map(r=>({monthly_period_id:periodId,group_id:r.groupId,person_id:r.personId,total_score:r.score}))
 )});
 await supabaseRest(`monthly_periods?id=eq.${periodId}`,{method:"PATCH",body:JSON.stringify({closed:true})});
 return {periodId,results:ranked,winners};
}

export async function listSpecialQuizzes(){
  const quizzes=await supabaseRest<any[]>("quizzes?quiz_type=eq.SPECIAL&order=created_at.desc&select=*");
  if(!quizzes.length) return [];
  const settings=await supabaseRest<any[]>(`special_quiz_settings?quiz_id=in.(${quizzes.map(q=>q.id).join(",")})&select=*`);
  const map=new Map(settings.map(s=>[s.quiz_id,s])); return quizzes.map(q=>({...q,special:map.get(q.id)??null}));
}
export async function createSpecialQuiz(input:any,createdBy:string){
  const q=await supabaseRest<any[]>("quizzes",{method:"POST",body:JSON.stringify({quiz_type:"SPECIAL",status:"DRAFT",title:input.title,subtitle:input.subtitle??null,open_at:input.openAt??null,close_at:input.closeAt??null,selection_mode:input.selectionMode??"FIXED",random_question_count:input.selectionMode==="RANDOM"?Number(input.randomQuestionCount??10):null,published_question_count:Number(input.publishedQuestionCount??10),created_by:createdBy})});
  const quiz=q[0];
  const passScore=Number(input.passScore??80); if(passScore<0||passScore>100||passScore%5!==0) throw new Error("PASS 점수는 0~100, 5점 단위여야 합니다.");
  await supabaseRest("special_quiz_settings",{method:"POST",body:JSON.stringify({quiz_id:quiz.id,special_mode:input.specialMode??"PASS",pass_score:passScore,retry_mode:input.retryMode??"UNTIL_PASS",max_attempts:input.retryMode==="MAX_ATTEMPTS"?Number(input.maxAttempts??1):null,answer_reveal_mode:input.answerRevealMode??"AFTER_PASS",answer_reveal_at:input.answerRevealMode==="AT_TIME"?input.answerRevealAt:null,theme:input.theme??"DEFAULT",issue_pass:Boolean(input.issuePass),custom_pass_message:input.customPassMessage??null})});
  return quiz;
}
