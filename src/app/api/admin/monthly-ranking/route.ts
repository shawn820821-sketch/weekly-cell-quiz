import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
import { settlementMonthForDate,settlementMonthForQuiz,monthCycleBounds,isSettlementMonthClosed } from "@/lib/monthlyCycle";

type Quiz={id:string;close_at:string|null;count_in_monthly:boolean};
type Sub={person_id:string;quiz_id:string;group_id_snapshot:string|null;score:number;submitted_at:string};
type Person={id:string;display_name:string;active:boolean;ranking_eligible:boolean};
type Member={person_id:string;group_id:string};
type Group={id:string;name:string;active:boolean};

export async function GET(request:Request){
 try{
  await requireAdmin();
  const requested=new URL(request.url).searchParams.get("month");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const month=requested??settlementMonthForDate(new Date());
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:"월 형식은 YYYY-MM입니다."},{status:400});
  const [quizzes,people,groups,members]=await Promise.all([
   supabaseRest<Quiz[]>("quizzes?quiz_type=eq.WEEKLY&count_in_monthly=eq.true&close_at=not.is.null&order=close_at.desc&limit=120&select=id,close_at,count_in_monthly"),
   supabaseRest<Person[]>("people?active=eq.true&ranking_eligible=eq.true&select=id,display_name,active,ranking_eligible"),
   supabaseRest<Group[]>("groups?active=eq.true&order=name.asc&select=id,name,active"),
   supabaseRest<Member[]>(`group_memberships?starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,group_id`)
  ]);
  const ids=quizzes.filter(q=>settlementMonthForQuiz(q.close_at)===month).map(q=>q.id);
  const submissions=ids.length?await supabaseRest<Sub[]>(`submissions?quiz_id=in.(${ids.join(",")})&mode=eq.OFFICIAL&order=submitted_at.asc&select=person_id,quiz_id,group_id_snapshot,score,submitted_at`):[];
  const scores=new Map<string,number>(), seen=new Set<string>();
  for(const s of submissions){
   const subKey=s.quiz_id+":"+s.person_id;
   if(seen.has(subKey))continue;
   seen.add(subKey);
   if(s.group_id_snapshot){
    const key=s.group_id_snapshot+":"+s.person_id;
    scores.set(key,(scores.get(key)??0)+s.score);
   }
  }
  const personMap=new Map(people.map(p=>[p.id,p.display_name]));
  const result=groups.map(group=>{
   const rows=members.filter(m=>m.group_id===group.id&&personMap.has(m.person_id)).map(m=>({
    personId:m.person_id,name:personMap.get(m.person_id)!,score:scores.get(group.id+":"+m.person_id)??null
   })).sort((a,b)=>a.score===null?1:b.score===null?-1:(b.score-a.score)||a.name.localeCompare(b.name,"ko-KR"));
   let rank=0,last:number|null=null;
   return {groupId:group.id,name:group.name,ranking:rows.map((r,i)=>{
    if(r.score!==null&&(last===null||r.score!==last))rank=i+1;
    if(r.score!==null)last=r.score;
    return {...r,rank:r.score===null?null:rank};
   })};
  });
  return NextResponse.json({month,settlementSunday:monthCycleBounds(month).endsOn,closed:isSettlementMonthClosed(month),groups:result});
 }catch(e){
  const message=e instanceof Error?e.message:"월간 순위 조회 실패";
  return NextResponse.json({error:message},{status:message==="ADMIN_REQUIRED"?403:500});
 }
}
