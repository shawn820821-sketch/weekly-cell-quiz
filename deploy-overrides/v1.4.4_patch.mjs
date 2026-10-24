import fs from 'node:fs';
function patch(path, reps){let s=fs.readFileSync(path,'utf8');for(const [a,b] of reps){if(!s.includes(a))throw new Error(`patch target missing in ${path}: ${a.slice(0,80)}`);s=s.replace(a,b)}fs.writeFileSync(path,s)}

patch('package.json', [['"version": "1.4.3"','"version": "1.4.6"']]);

patch('src/server/excelImport.ts', [
['export type ImportWeek = { sheetName:string; quizType:"WEEKLY"|"SPECIAL"; title:string; lifeDateRange:string; bibleRange:string; openAt:string; closeAt:string; memo:string; questions:ImportQuestion[]; errors:string[] };','export type ImportWeek = { sheetName:string; quizType:"WEEKLY"|"SPECIAL"; title:string; lifeDateRange:string; bibleRange:string; openAt:string; closeAt:string; memo:string; questions:ImportQuestion[]; errors:string[]; quizMonthKey:string|null; quizWeekIndex:number|null; quizLabel:string|null };'],
['function difficultyOf(v:unknown){const s=str(v).toUpperCase();return (["EASY","MEDIUM","HARD"].includes(s)?s:"MEDIUM") as "EASY"|"MEDIUM"|"HARD";}\n','function difficultyOf(v:unknown){const s=str(v).toUpperCase();return (["EASY","MEDIUM","HARD"].includes(s)?s:"MEDIUM") as "EASY"|"MEDIUM"|"HARD";}\n\nfunction deriveQuizCycle(lifeDateRange:string){\n  const m=lifeDateRange.match(/(20\\d{2})-(\\d{2})-(\\d{2})\\s*~\\s*(20\\d{2})-(\\d{2})-(\\d{2})/);\n  if(!m)return null;\n  const endUtc=new Date(Date.UTC(Number(m[4]),Number(m[5])-1,Number(m[6]),12,0,0));\n  const day=endUtc.getUTCDay(); const daysToMonday=((8-day)%7)||7;\n  const start=new Date(endUtc); start.setUTCDate(endUtc.getUTCDate()+daysToMonday);\n  const close=new Date(start); close.setUTCDate(start.getUTCDate()+5);\n  const yyyy=start.getUTCFullYear(), mm=start.getUTCMonth()+1, dd=start.getUTCDate();\n  const cy=close.getUTCFullYear(), cm=close.getUTCMonth()+1, cd=close.getUTCDate();\n  const weekIndex=Math.max(1,Math.ceil(cd/7));\n  const ord=["첫째","둘째","셋째","넷째","다섯째","여섯째"][weekIndex-1]??`${weekIndex}주차`;\n  const pad=(n:number)=>String(n).padStart(2,"0");\n  return {openAt:`${yyyy}-${pad(mm)}-${pad(dd)}T00:00:00+09:00`,closeAt:`${cy}-${pad(cm)}-${pad(cd)}T23:59:00+09:00`,monthKey:`${cy}-${pad(cm)}`,weekIndex,title:`${cm}월 ${ord} 주간 셀 퀴즈`,label:`${cm}월 ${weekIndex}주차 · ${mm}/${dd}–${cm}/${cd}`};\n}\n'],
['    const quizType: "WEEKLY"|"SPECIAL" = sheetName==="스페셜"?"SPECIAL":"WEEKLY";\n    const week:ImportWeek={sheetName,quizType,title:meta("퀴즈제목")||(quizType==="SPECIAL"?"스페셜 퀴즈":`${sheetName} 주간 셀 퀴즈`),lifeDateRange:meta("생명의삶 기간"),bibleRange:meta("성경범위"),openAt:meta("공개일시"),closeAt:meta("마감일시"),memo:meta("출제메모"),questions:[],errors:[]};','    const quizType: "WEEKLY"|"SPECIAL" = sheetName==="스페셜"?"SPECIAL":"WEEKLY";\n    const lifeDateRange=meta("생명의삶 기간"); const derived=quizType==="WEEKLY"?deriveQuizCycle(lifeDateRange):null;\n    const manualOpen=meta("공개일시"), manualClose=meta("마감일시");\n    const week:ImportWeek={sheetName,quizType,title:quizType==="SPECIAL"?(meta("퀴즈제목")||"스페셜 퀴즈"):(derived?.title||meta("퀴즈제목")||`${sheetName} 주간 셀 퀴즈`),lifeDateRange,bibleRange:meta("성경범위"),openAt:manualOpen||derived?.openAt||"",closeAt:manualClose||derived?.closeAt||"",memo:meta("출제메모"),questions:[],errors:[],quizMonthKey:derived?.monthKey??null,quizWeekIndex:derived?.weekIndex??null,quizLabel:derived?.label??null};']
]);

patch('src/app/api/admin/import/commit/route.ts', [
['type Week={sheetName:string;quizType?:"WEEKLY"|"SPECIAL";title:string;lifeDateRange:string;bibleRange:string;openAt:string;closeAt:string;questions:Q[];errors:string[]};','type Week={sheetName:string;quizType?:"WEEKLY"|"SPECIAL";title:string;lifeDateRange:string;bibleRange:string;openAt:string;closeAt:string;questions:Q[];errors:string[];quizMonthKey?:string|null;quizWeekIndex?:number|null;quizLabel?:string|null};'],
['type ExistingQuiz={id:string;status:string;quiz_type:"WEEKLY"|"SPECIAL";content_week_index:number|null;title:string;life_date_range:string|null};','type ExistingQuiz={id:string;status:string;quiz_type:"WEEKLY"|"SPECIAL";content_month_key:string|null;content_week_index:number|null;title:string;life_date_range:string|null;open_at?:string|null;close_at?:string|null};'],
['function weekIndex(sheetName:string){return Number(sheetName.match(/^(\\d+)주차$/)?.[1]||0)||null;}\nfunction sameProtectedWeek(w:Week,q:ExistingQuiz){\n const wi=weekIndex(w.sheetName);\n if(wi&&q.content_week_index===wi)return true;\n if(w.title.trim()===q.title.trim())return true;\n // 말씀 기간만 같은 것은 같은 Quiz 주차로 보지 않는다. 과거 주차 보정 시 같은 본문이 다음 주 Quiz로 이월될 수 있다.\n return false;\n}','function sameProtectedWeek(w:Week,q:ExistingQuiz){\n const month=w.quizMonthKey??null, wi=w.quizWeekIndex??null;\n if(month&&wi&&q.content_month_key===month&&q.content_week_index===wi)return true;\n if(w.openAt&&q.open_at&&new Date(w.openAt).getTime()===new Date(q.open_at).getTime())return true;\n return w.title.trim()===q.title.trim();\n}'],
['    const tagged=await supabaseRest<Array<{id:string}>>(`quizzes?quiz_type=eq.WEEKLY&content_month_key=eq.${inferredMonthKey}&select=id`);\n    tagged.forEach(x=>quizIds.add(x.id));','    const incomingMonthKeys=[...new Set(body.weeks.map(w=>w.quizMonthKey).filter(Boolean) as string[])];\n    for(const mk of incomingMonthKeys){const tagged=await supabaseRest<Array<{id:string}>>(`quizzes?quiz_type=eq.WEEKLY&content_month_key=eq.${mk}&select=id`);tagged.forEach(x=>quizIds.add(x.id));}'],
['select=id,status,quiz_type,content_week_index,title,life_date_range','select=id,status,quiz_type,content_month_key,content_week_index,title,life_date_range,open_at,close_at'],
['select=id,status,quiz_type,content_week_index,title,life_date_range','select=id,status,quiz_type,content_month_key,content_week_index,title,life_date_range,open_at,close_at'],
['    const wi=qt==="SPECIAL"?null:weekIndex(w.sheetName);\n    const qs=await supabaseRest<Array<{id:string}>>("quizzes?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({title:w.title,quiz_type:qt,status:"DRAFT",life_date_range:w.lifeDateRange||null,bible_range:w.bibleRange||null,open_at:w.openAt||null,close_at:w.closeAt||null,selection_mode:"FIXED",content_month_key:inferredMonthKey,content_week_index:wi,import_id:importId})});','    const wi=qt==="SPECIAL"?null:(w.quizWeekIndex??null); const quizMonthKey=qt==="SPECIAL"?null:(w.quizMonthKey??inferredMonthKey);\n    const qs=await supabaseRest<Array<{id:string}>>("quizzes?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({title:w.title,quiz_type:qt,status:"DRAFT",life_date_range:w.lifeDateRange||null,bible_range:w.bibleRange||null,open_at:w.openAt||null,close_at:w.closeAt||null,selection_mode:"FIXED",content_month_key:quizMonthKey,content_week_index:wi,import_id:importId})});']
]);

patch('src/app/operator/page.tsx', [
['weeks:Array<{sheetName:string;title:string;lifeDateRange:string;bibleRange:string;openAt:string;closeAt:string;memo:string;questions:any[];errors:string[]}>','weeks:Array<{sheetName:string;title:string;lifeDateRange:string;bibleRange:string;openAt:string;closeAt:string;memo:string;questions:any[];errors:string[];quizMonthKey?:string|null;quizWeekIndex?:number|null;quizLabel?:string|null}>'],
['Excel의 1주차~5주차는 <strong>말씀 기간</strong> 기준입니다.','Excel의 1주차~6주차는 <strong>말씀 기간</strong> 기준입니다.'],
['{preview.weeks.map(w=><div className="importWeek" key={w.sheetName}><strong>{w.sheetName} · {w.title}</strong><span>{w.questions.length}개 후보 · 힌트 {w.questions.filter((q:any)=>Boolean(q.hint)).length}개</span>{w.errors.map((e,i)=><small key={i}>{e}</small>)}</div>)}','{preview.weeks.map(w=><div className="importWeek" key={w.sheetName}><strong>{w.sheetName} → {w.quizLabel||w.title}</strong><span>{w.questions.length}개 후보 · 힌트 {w.questions.filter((q:any)=>Boolean(q.hint)).length}개</span>{w.lifeDateRange&&<small>말씀 {w.lifeDateRange}</small>}{w.errors.map((e,i)=><small key={i}>{e}</small>)}</div>)}']
]);

patch('src/app/globals.css', [
['.adminNav nav{display:grid;gap:5px;margin-top:32px}', '.adminNav nav{display:grid;gap:5px;margin-top:44px}'],
['.introGuide{margin:16px 0 10px;padding:18px}', '.introGuide{margin:10px 0 6px;padding:14px 16px}'],
['.introScene .meditationCard{margin-top:4px}', '.introScene .meditationCard{margin-top:0}'],
['.introScene>.btnPrimary{margin-top:14px}', '.introScene>.btnPrimary{margin-top:10px}']
]);
fs.writeFileSync("src/app/api/admin/dashboard/route.ts","import { NextResponse } from \"next/server\";\nimport { requireAdmin } from \"@/server/operatorAuth\";\nimport { supabaseRest } from \"@/lib/supabase/rest\";\n\nexport async function GET() {\n  try {\n    await requireAdmin();\n    const [people, groups, quizzes, submissions] = await Promise.all([\n      supabaseRest<Array<{ id:string }>>(\"people?active=eq.true&select=id\"),\n      supabaseRest<Array<{ id:string }>>(\"groups?active=eq.true&select=id\"),\n      supabaseRest<Array<{ id:string;title:string;status:string;open_at:string|null;close_at:string|null }>>(\"quizzes?quiz_type=eq.WEEKLY&order=open_at.desc&limit=6&select=id,title,status,open_at,close_at\"),\n      supabaseRest<Array<{ quiz_id:string;person_id:string;mode:string }>>(\"submissions?mode=eq.OFFICIAL&select=quiz_id,person_id,mode\"),\n    ]);\n    const now = Date.now();\n    const current = quizzes.find((q) => q.open_at && q.close_at && new Date(q.open_at).getTime() <= now && now <= new Date(q.close_at).getTime()) ?? quizzes.find((q) => q.close_at && new Date(q.close_at).getTime() < now) ?? null;\n    const currentSubmissions = current ? submissions.filter((s) => s.quiz_id === current.id).length : 0;\n    return NextResponse.json({ activePeople: people.length, activeGroups: groups.length, currentQuiz: current, participation: { submitted: currentSubmissions, eligible: people.length }, recentQuizzes: quizzes });\n  } catch (error) {\n    const message = error instanceof Error ? error.message : \"관리자 데이터를 불러오지 못했습니다.\";\n    return NextResponse.json({ error: message }, { status: message === \"ADMIN_REQUIRED\" ? 403 : 500 });\n  }\n}\n");
fs.writeFileSync("src/app/api/admin/stats/route.ts","import { NextResponse } from \"next/server\";\nimport { requireAdmin } from \"@/server/operatorAuth\";\nimport { supabaseRest } from \"@/lib/supabase/rest\";\nexport async function GET(){\n try{\n  await requireAdmin();\n  const now=Date.now();\n  const quizzes=await supabaseRest<Array<{id:string;title:string;status:string;open_at:string|null;close_at:string|null}>>(\"quizzes?quiz_type=eq.WEEKLY&status=neq.DRAFT&order=open_at.desc&limit=10&select=id,title,status,open_at,close_at\");\n  const quiz=quizzes.find(q=>q.open_at&&q.close_at&&new Date(q.open_at).getTime()<=now&&now<=new Date(q.close_at).getTime())??quizzes.find(q=>q.close_at&&new Date(q.close_at).getTime()<now)??null;if(!quiz)return NextResponse.json({quiz:null,participation:0,average:null,questions:[]});\n  const subs=await supabaseRest<Array<{id:string;score:number}>>(`submissions?quiz_id=eq.${quiz.id}&mode=eq.OFFICIAL&select=id,score`);\n  const ids=subs.map(s=>s.id);\n  const questions=await supabaseRest<Array<{id:string;prompt:string;sort_order:number}>>(`questions?quiz_id=eq.${quiz.id}&selected=eq.true&order=sort_order.asc&select=id,prompt,sort_order`);\n  const answers=ids.length?await supabaseRest<Array<{question_id:string;is_correct:boolean}>>(`answers?submission_id=in.(${ids.join(\",\")})&select=question_id,is_correct`):[];\n  const qstats=questions.map(q=>{const rows=answers.filter(a=>a.question_id===q.id);const correct=rows.filter(a=>a.is_correct).length;return {id:q.id,prompt:q.prompt,total:rows.length,correct,rate:rows.length?Math.round(correct/rows.length*100):null};});\n  const avg=subs.length?Math.round(subs.reduce((s,x)=>s+x.score,0)/subs.length):null;\n  return NextResponse.json({quiz,participation:subs.length,average:avg,questions:qstats});\n }catch(error){const message=error instanceof Error?error.message:\"통계를 불러오지 못했습니다.\";return NextResponse.json({error:message},{status:message===\"ADMIN_REQUIRED\"?403:500});}\n}\n");
fs.writeFileSync("src/server/leaderRepository.ts","import { supabaseRest } from \"@/lib/supabase/rest\";\nimport { requireOperator } from \"@/server/operatorAuth\";\n\ntype QuizRow={id:string;title:string;status:string;monthly_period_id:string|null;open_at:string|null;close_at:string|null};\ntype MembershipRow={person_id:string;group_id:string};\ntype PersonRow={id:string;display_name:string;active:boolean;ranking_eligible:boolean};\ntype SubmissionRow={person_id:string;quiz_id:string;score:number;group_id_snapshot:string|null;mode:string};\n\nexport async function getLeaderDashboard(){\n  const session=await requireOperator();\n  const leader=session.roles.find(r=>r.role===\"LEADER\"&&r.target_group_id);\n  if(!leader?.target_group_id) throw new Error(\"LEADER_REQUIRED\");\n  const groupId=leader.target_group_id;\n  const today=new Date().toISOString().slice(0,10);\n  const [quizRows,memberships,people]=await Promise.all([\n    supabaseRest<QuizRow[]>(\"quizzes?quiz_type=eq.WEEKLY&status=in.(OPEN,CLOSED,SCHEDULED)&order=open_at.desc&limit=8&select=id,title,status,monthly_period_id,open_at,close_at\"),\n    supabaseRest<MembershipRow[]>(`group_memberships?group_id=eq.${groupId}&starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&select=person_id,group_id`),\n    supabaseRest<PersonRow[]>(\"people?active=eq.true&select=id,display_name,active,ranking_eligible\"),\n  ]);\n  const now=Date.now();\n  const current=quizRows.find(q=>q.open_at&&q.close_at&&new Date(q.open_at).getTime()<=now&&now<=new Date(q.close_at).getTime())??quizRows.find(q=>q.close_at&&new Date(q.close_at).getTime()<now)??null;\n  const memberIds=memberships.map(m=>m.person_id);\n  const nameMap=new Map(people.map(p=>[p.id,p]));\n  if(!current||!memberIds.length){return {groupId,currentQuiz:current,members:[],submitted:0,eligible:memberIds.length,average:null,monthlyLeader:null};}\n  const currentSubs=await supabaseRest<SubmissionRow[]>(`submissions?quiz_id=eq.${current.id}&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,quiz_id,score,group_id_snapshot,mode`);\n  let monthlySubs:SubmissionRow[]=[];\n  if(current.monthly_period_id){\n    const monthlyQuizzes=await supabaseRest<Array<{id:string}>>(`quizzes?monthly_period_id=eq.${current.monthly_period_id}&quiz_type=eq.WEEKLY&select=id`);\n    const ids=monthlyQuizzes.map(q=>q.id);\n    if(ids.length) monthlySubs=await supabaseRest<SubmissionRow[]>(`submissions?quiz_id=in.(${ids.join(\",\")})&mode=eq.OFFICIAL&group_id_snapshot=eq.${groupId}&select=person_id,quiz_id,score,group_id_snapshot,mode`);\n  }\n  const weeklyBy=new Map(currentSubs.map(s=>[s.person_id,s.score]));\n  const monthlyBy=new Map<string,number>();\n  for(const s of monthlySubs) monthlyBy.set(s.person_id,(monthlyBy.get(s.person_id)??0)+s.score);\n  const members=memberIds.map(id=>({personId:id,name:nameMap.get(id)?.display_name??\"알 수 없음\",weeklyScore:weeklyBy.get(id)??null,monthlyScore:monthlyBy.get(id)??0,submitted:weeklyBy.has(id)})).sort((a,b)=>Number(b.submitted)-Number(a.submitted)||b.monthlyScore-a.monthlyScore||a.name.localeCompare(b.name,\"ko-KR\"));\n  const scores=currentSubs.map(s=>s.score);\n  const monthlyLeader=[...members].sort((a,b)=>b.monthlyScore-a.monthlyScore||a.name.localeCompare(b.name,\"ko-KR\"))[0]??null;\n  return {groupId,currentQuiz:current,members,submitted:currentSubs.length,eligible:memberIds.length,average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,monthlyLeader};\n}\n");
fs.writeFileSync("src/app/api/admin/quizzes/route.ts","import { NextResponse } from \"next/server\";\nimport { requireAdmin } from \"@/server/operatorAuth\";\nimport { supabaseRest } from \"@/lib/supabase/rest\";\n\nexport async function GET() {\n  try {\n    await requireAdmin();\n    const rows=await supabaseRest<any[]>(\"quizzes?order=created_at.desc&select=*\");\n    const now=Date.now();\n    const quizzes=rows.map(q=>{\n      if(q.quiz_type!==\"WEEKLY\"||q.status===\"DRAFT\"||!q.open_at||!q.close_at)return q;\n      const open=new Date(q.open_at).getTime(),close=new Date(q.close_at).getTime();\n      return {...q,status:now<open?\"SCHEDULED\":now<=close?\"OPEN\":\"CLOSED\"};\n    });\n    return NextResponse.json({quizzes});\n  }\n  catch (error) { const m = error instanceof Error ? error.message : \"오류\"; return NextResponse.json({ error:m }, { status:m === \"ADMIN_REQUIRED\" ? 403 : 500 }); }\n}\n\nexport async function POST(request: Request) {\n  try {\n    const admin = await requireAdmin();\n    const body = await request.json();\n    const quiz = await supabaseRest(\"quizzes\", { method: \"POST\", body: JSON.stringify({ title: body.title, subtitle: body.subtitle ?? null, quiz_type: body.quizType ?? \"WEEKLY\", status: \"DRAFT\", selection_mode: body.selectionMode ?? \"FIXED\", random_question_count: body.selectionMode === \"RANDOM\" ? Number(body.randomQuestionCount ?? 10) : null, published_question_count: Number(body.publishedQuestionCount ?? 10), life_date_range: body.lifeDateRange ?? null, bible_range: body.bibleRange ?? null, open_at: body.openAt ?? null, close_at: body.closeAt ?? null, created_by: admin.personId }) });\n    return NextResponse.json({ quiz }, { status: 201 });\n  } catch (error) { const m = error instanceof Error ? error.message : \"Quiz 생성 실패\"; return NextResponse.json({ error:m }, { status:m === \"ADMIN_REQUIRED\" ? 403 : 500 }); }\n}\n");

function stableEdit(path, fn){
  const source=fs.readFileSync(path,'utf8'), edited=fn(source);
  if(edited===source)throw new Error('v1.4.6 edit did not change: '+path);
  fs.writeFileSync(path,edited);
}
function requireChange(before,after,label){
  if(before===after)throw new Error('v1.4.6 required change not found: '+label);
  return after;
}

stableEdit('src/server/appRepository.ts',s=>{
  const first=s;
  s=requireChange(s,s.replace(/quizzes\?quiz_type=eq\.WEEKLY&status=in\.\(OPEN,SCHEDULED\)&order=open_at\.asc&limit=\d+&select=/g,
    'quizzes?quiz_type=eq.WEEKLY&status=neq.DRAFT&order=open_at.desc&limit=24&select='),'bootstrap-query');
  const old=/const currentQuiz\s*=\s*quizzes\.find\([\s\S]*?\?\?\s*quizzes\[0\]\s*\?\?\s*null;/;
  if(old.test(s)){
    s=s.replace(old,'const currentQuiz = quizzes.filter(q=>q.open_at && q.close_at && new Date(q.open_at).getTime()<=Date.now() && Date.now()<=new Date(q.close_at).getTime()).sort((a,b)=>new Date(b.open_at!).getTime()-new Date(a.open_at!).getTime())[0]??null;');
  }else{
    s=requireChange(s,s.replace(/const currentQuiz\s*=\s*.+?;/,
      'const currentQuiz = quizzes.filter(q=>q.open_at && q.close_at && new Date(q.open_at).getTime()<=Date.now() && Date.now()<=new Date(q.close_at).getTime()).sort((a,b)=>new Date(b.open_at!).getTime()-new Date(a.open_at!).getTime())[0]??null;'),'bootstrap-current');
  }
  return s;
});

stableEdit('src/server/participantRepository.ts',s=>
  requireChange(s,s.replace(
    'return quizzes.filter(q=>q.quiz_type==="WEEKLY" || q.quiz_type==="SPECIAL").map(q=>{',
    'return quizzes.filter(q=>(q.quiz_type==="WEEKLY" || q.quiz_type==="SPECIAL")&&Boolean(q.close_at)&&new Date(q.close_at!).getTime()<Date.now()).map(q=>{'
  ),'archive-past-only')
);

stableEdit('src/state/useQuizApp.ts',s=>{
  const before=s;
  const emptyDef='const EMPTY_WEEKLY_QUIZ:QuizDefinition={id:"",title:"이번 주 퀴즈가 아직 열리지 않았어요",subtitle:"공개 시간에 자동으로 표시됩니다.",lifeDateRange:"",bibleRange:"",questions:[]};\n';
  if(!s.includes('EMPTY_WEEKLY_QUIZ')) s=s.replace('export function useQuizApp(){',emptyDef+'\nexport function useQuizApp(){');
  s=s.replace(/useState<QuizDefinition>\(mockWeeklyQuiz\)/g,'useState<QuizDefinition>(USE_MOCK?mockWeeklyQuiz:EMPTY_WEEKLY_QUIZ)');
  s=s.replace(/type Persisted=\{([^}]*)\}/,(all,inner)=>
    all.includes('weeklyQuizId')?all:'type Persisted={'+inner+';weeklyQuizId?:string|null}');
  s=s.replace('setTestMode(requestedTest);if(!USE_MOCK){','setTestMode(requestedTest);let currentWeekId="";if(!USE_MOCK){');
  s=s.replace('if(q){const def=','if(q){currentWeekId=q.id;const def=');
  s=s.replace(
    'setWeeklyResult(saved.weeklyResult??null);setResult(saved.weeklyResult??null);setSessionId(saved.sessionId??null);',
    'setWeeklyResult(saved.weeklyQuizId===currentWeekId?saved.weeklyResult??null:null);setResult(saved.weeklyQuizId===currentWeekId?saved.weeklyResult??null:null);setSessionId(saved.weeklyQuizId===currentWeekId?saved.sessionId??null:null);'
  );
  s=s.replace('sessionId} satisfies Persisted','sessionId,weeklyQuizId:weeklyQuiz.id||null} satisfies Persisted');
  s=s.replace('[hydrated,testMode,groupId,person,answers,questionIndex,weeklyResult,sessionId]',
    '[hydrated,testMode,groupId,person,answers,questionIndex,weeklyResult,sessionId,weeklyQuiz.id]');
  s=s.replace('if(!person)return;setBusy(true);',
    'if(!person)return;if(!weeklyQuiz.id&&!override){setError("이번 주 퀴즈가 아직 열리지 않았습니다.");return;}setBusy(true);');
  const start=' useEffect(()=>{if(!person||USE_MOCK)return;async function loadPersonal()';
  const effect=" useEffect(()=>{if(!hydrated||USE_MOCK||testMode)return;let stopped=false;\n  async function refreshCurrentWeek(){try{const r=await fetch(\"/api/bootstrap?t=\"+Date.now(),{cache:\"no-store\"});if(!r.ok||stopped)return;const data=await r.json();const nextId=data.currentQuiz?.id??\"\";if(nextId!==weeklyQuiz.id)window.location.reload();}catch{}}\n  const onFocus=()=>void refreshCurrentWeek();const onVisible=()=>{if(document.visibilityState===\"visible\")void refreshCurrentWeek();};\n  window.addEventListener(\"focus\",onFocus);document.addEventListener(\"visibilitychange\",onVisible);\n  const timer=window.setInterval(()=>void refreshCurrentWeek(),5*60*1000);\n  return()=>{stopped=true;window.removeEventListener(\"focus\",onFocus);document.removeEventListener(\"visibilitychange\",onVisible);window.clearInterval(timer);};\n },[hydrated,testMode,weeklyQuiz.id]);\n";
  if(!s.includes('async function refreshCurrentWeek')) s=requireChange(s,s.replace(start,effect+'\n'+start),'client-revalidate');
  for(const flag of ['EMPTY_WEEKLY_QUIZ','currentWeekId','weeklyQuizId','refreshCurrentWeek']){
    if(!s.includes(flag))throw new Error('v1.4.6 missing hook: '+flag);
  }
  return requireChange(before,s,'quiz-state');
});

stableEdit('src/components/HomeScreen.tsx',s=>{
  const before=s;
  s=s.replace('<button className="btn btnPrimary full" onClick={onStart}>',
    '<button className="btn btnPrimary full" disabled={!quiz.id} onClick={onStart}>');
  return requireChange(before,s,'disable-empty-week-button');
});

stableEdit('src/app/api/quiz/start/route.ts',s=>{
 const before=s;
 s=s.replace('const quiz=await getQuiz(body.quizId);',
   'const quiz=await getQuiz(body.quizId);if(mode==="PRACTICE"&&quiz.quiz_type==="WEEKLY"&&(!quiz.close_at||new Date(quiz.close_at).getTime()>=Date.now()))return NextResponse.json({error:"지난 퀴즈만 연습할 수 있습니다."},{status:409});');
 return requireChange(before,s,'prevent-current-practice');
});
console.log('v1.4.6 rollover patch complete');


// v1.4.6 TS compatibility with the v1.4.3 client's different hook naming.
{
 const path='src/state/useQuizApp.ts';
 let s=fs.readFileSync(path,'utf8');
 s=s.replace('export function useQuizApp(){','export function useQuizApp(){const currentWeekIdRef=useRef("");');
 s=s.replace(/let currentWeekId="";/g,'');
 s=s.replace(/\bcurrentWeekId\b/g,'currentWeekIdRef.current');
 s=s.replace('const data=await response.json();',
   'const data=await response.json();currentWeekIdRef.current=data.currentQuiz?.id??"";');
 s=s.replace(/!hydrated\|\|USE_MOCK\|\|testMode/g,
   '!hydrated||USE_MOCK||window.location.search.includes("test=1")');
 s=s.replace(/\[hydrated,testMode,weeklyQuiz\.id\]/g,'[hydrated,weeklyQuiz.id]');
 if(!s.includes('const currentWeekIdRef=useRef("")'))throw new Error('currentWeekIdRef insertion failed');
 fs.writeFileSync(path,s);
}
