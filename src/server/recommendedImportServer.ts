import { supabaseRest } from "@/lib/supabase/rest";
import type { RecommendedWeek } from "@/server/recommendedImport";

type QuizSummary={id:string;title:string;status:string;quiz_type:string;open_at:string|null;close_at:string|null};
export type Conflict={quizId:string;title:string;status:string;openDate:string};

export async function inspectRecommendedConflicts(weeks:RecommendedWeek[]){
 const quizzes=await supabaseRest<QuizSummary[]>(
  "quizzes?quiz_type=eq.WEEKLY&order=open_at.asc&limit=500&select=id,title,status,quiz_type,open_at,close_at");
 const targets=new Map(weeks.map(w=>[Date.parse(w.openAt),w]));
 const conflicts:Conflict[]=[];
 for(const quiz of quizzes){
  if(!quiz.open_at)continue;
  const open=Date.parse(quiz.open_at);
  const week=targets.get(open);
  if(week)conflicts.push({quizId:quiz.id,title:quiz.title,status:quiz.status,openDate:week.openDate});
 }
 return conflicts;
}
