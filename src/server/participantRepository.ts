import { supabaseRest } from "@/lib/supabase/rest";

type SubmissionRow = {
  id:string; quiz_id:string; person_id:string; mode:"OFFICIAL"|"PRACTICE"|"TEST";
  group_id_snapshot:string|null; correct_count:number; question_count:number; score:number; submitted_at:string; attempt_no:number;
};
type QuizRow = { id:string; title:string; quiz_type:"WEEKLY"|"SPECIAL"; season_id:string|null; monthly_period_id:string|null; open_at:string|null; close_at:string|null; status:string; bible_range:string|null; life_date_range:string|null };
type PeriodRow = { id:string; name:string; starts_on:string; ends_on:string; closed:boolean };
type GroupRow = { id:string; name:string };
type MonthlyResultRow = { monthly_period_id:string; person_id:string; group_id:string|null; total_score:number; participation_count:number; rank:number|null };
type PassRow = { quiz_id:string; person_id:string; score:number; passed_at:string; pass_issued:boolean; used_at:string|null };
type SpecialSettingRow = { quiz_id:string; special_mode:string; pass_score:number; retry_mode:string; max_attempts:number|null; theme:string; issue_pass:boolean; custom_pass_message:string|null };

export async function getParticipantStats(personId:string){
  const [subs, quizzes, periods, groups, monthly, passes] = await Promise.all([
    supabaseRest<SubmissionRow[]>(`submissions?person_id=eq.${personId}&mode=eq.OFFICIAL&order=submitted_at.desc&select=id,quiz_id,person_id,mode,group_id_snapshot,correct_count,question_count,score,submitted_at,attempt_no`),
    supabaseRest<QuizRow[]>("quizzes?select=id,title,quiz_type,season_id,monthly_period_id,open_at,close_at,status,bible_range,life_date_range"),
    supabaseRest<PeriodRow[]>("monthly_periods?order=starts_on.desc&select=id,name,starts_on,ends_on,closed"),
    supabaseRest<GroupRow[]>("groups?select=id,name"),
    supabaseRest<MonthlyResultRow[]>(`monthly_results?person_id=eq.${personId}&order=settled_at.desc&select=monthly_period_id,person_id,group_id,total_score,participation_count,rank`),
    supabaseRest<PassRow[]>(`special_pass_records?person_id=eq.${personId}&order=passed_at.desc&select=quiz_id,person_id,score,passed_at,pass_issued,used_at`),
  ]);
  const quizMap=new Map(quizzes.map(q=>[q.id,q])); const periodMap=new Map(periods.map(p=>[p.id,p])); const groupMap=new Map(groups.map(g=>[g.id,g.name]));
  const weekly=subs.filter(s=>quizMap.get(s.quiz_id)?.quiz_type==="WEEKLY" && s.attempt_no===1);
  const officialWeeklyCount=weekly.length;
  const perfectCount=weekly.filter(s=>s.score===100).length;
  const recent=weekly.slice(0,12).map(s=>({quizId:s.quiz_id,title:quizMap.get(s.quiz_id)?.title??"주간 퀴즈",score:s.score,correct:s.correct_count,total:s.question_count,submittedAt:s.submitted_at,groupName:s.group_id_snapshot?groupMap.get(s.group_id_snapshot)??null:null}));
  const monthlyHistory=monthly.map(r=>({periodId:r.monthly_period_id,periodName:periodMap.get(r.monthly_period_id)?.name??"월간 기록",totalScore:r.total_score,participationCount:r.participation_count,rank:r.rank,groupName:r.group_id?groupMap.get(r.group_id)??null:null,closed:periodMap.get(r.monthly_period_id)?.closed??true}));
  const specialPasses=passes.map(p=>({quizId:p.quiz_id,title:quizMap.get(p.quiz_id)?.title??"Special Quiz",score:p.score,passedAt:p.passed_at,passIssued:p.pass_issued,usedAt:p.used_at}));
  return {officialWeeklyCount,perfectCount,recent,monthlyHistory,specialPasses};
}

export async function getParticipantArchive(personId:string){
  const [subs, quizzes, periods, groups] = await Promise.all([
    supabaseRest<SubmissionRow[]>(`submissions?person_id=eq.${personId}&mode=eq.OFFICIAL&order=submitted_at.desc&select=id,quiz_id,person_id,mode,group_id_snapshot,correct_count,question_count,score,submitted_at,attempt_no`),
    supabaseRest<QuizRow[]>("quizzes?order=open_at.desc&select=id,title,quiz_type,season_id,monthly_period_id,open_at,close_at,status,bible_range,life_date_range"),
    supabaseRest<PeriodRow[]>("monthly_periods?select=id,name,starts_on,ends_on,closed"),
    supabaseRest<GroupRow[]>("groups?select=id,name"),
  ]);
  const subMap=new Map<string,SubmissionRow>();
  for(const s of subs){ if(s.attempt_no===1 && !subMap.has(s.quiz_id)) subMap.set(s.quiz_id,s); }
  const periodMap=new Map(periods.map(p=>[p.id,p.name])); const groupMap=new Map(groups.map(g=>[g.id,g.name]));
  return quizzes.filter(q=>q.quiz_type==="WEEKLY" || q.quiz_type==="SPECIAL").map(q=>{
    const s=subMap.get(q.id);
    return {quizId:q.id,title:q.title,quizType:q.quiz_type,periodName:q.monthly_period_id?periodMap.get(q.monthly_period_id)??null:null,bibleRange:q.bible_range,lifeDateRange:q.life_date_range,openAt:q.open_at,closeAt:q.close_at,status:q.status,official:s?{score:s.score,correct:s.correct_count,total:s.question_count,submittedAt:s.submitted_at,groupName:s.group_id_snapshot?groupMap.get(s.group_id_snapshot)??null:null}:null};
  });
}

export async function getActiveSpecials(personId:string){
  const now=new Date().toISOString();
  const quizzes=await supabaseRest<QuizRow[]>(`quizzes?quiz_type=eq.SPECIAL&status=in.(SCHEDULED,OPEN)&open_at=lte.${encodeURIComponent(now)}&close_at=gte.${encodeURIComponent(now)}&order=open_at.asc&select=id,title,quiz_type,season_id,monthly_period_id,open_at,close_at,status,bible_range,life_date_range`);
  if(!quizzes.length) return [];
  const ids=quizzes.map(q=>q.id).join(",");
  const [settings,subs,passes]=await Promise.all([
    supabaseRest<SpecialSettingRow[]>(`special_quiz_settings?quiz_id=in.(${ids})&select=*`),
    supabaseRest<SubmissionRow[]>(`submissions?person_id=eq.${personId}&quiz_id=in.(${ids})&mode=eq.OFFICIAL&order=submitted_at.desc&select=id,quiz_id,person_id,mode,group_id_snapshot,correct_count,question_count,score,submitted_at,attempt_no`),
    supabaseRest<PassRow[]>(`special_pass_records?person_id=eq.${personId}&quiz_id=in.(${ids})&select=quiz_id,person_id,score,passed_at,pass_issued,used_at`),
  ]);
  const settingMap=new Map(settings.map(s=>[s.quiz_id,s])); const passMap=new Map(passes.map(p=>[p.quiz_id,p]));
  return quizzes.map(q=>{ const st=settingMap.get(q.id); const attempts=subs.filter(s=>s.quiz_id===q.id); const latest=attempts[0]??null; const pass=passMap.get(q.id)??null; const passed=Boolean(pass); const retry=st?.retry_mode??"NONE"; const max=st?.max_attempts??null; const canAttempt=!passed && (attempts.length===0 || retry==="UNTIL_PASS" || (retry==="MAX_ATTEMPTS"&&attempts.length<(max??1))); return {quizId:q.id,title:q.title,openAt:q.open_at,closeAt:q.close_at,specialMode:st?.special_mode??"NORMAL",passScore:st?.pass_score??80,retryMode:retry,maxAttempts:max,theme:st?.theme??"DEFAULT",issuePass:st?.issue_pass??false,customPassMessage:st?.custom_pass_message??null,attemptCount:attempts.length,latestScore:latest?.score??null,passed,canAttempt,pass}; });
}
