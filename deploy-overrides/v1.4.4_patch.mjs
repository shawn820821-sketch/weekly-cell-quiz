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

function patchOptional(path,reps){
  let s=fs.readFileSync(path,'utf8');
  for(const [a,b,label] of reps){
    if(!s.includes(a)) throw new Error(`v1.4.6 patch target missing [${label}] in ${path}`);
    s=s.replace(a,b);
  }
  fs.writeFileSync(path,s);
}

// v1.4.6 — weekly rollover / stale client state / stats hardening
patchOptional('src/server/appRepository.ts',[
['  const today = new Date().toISOString().slice(0, 10);\n  const [groups, people, memberships, roles, quizzes] = await Promise.all([',
 '  const now = new Date();\n  const today = now.toISOString().slice(0, 10);\n  const nowIso = encodeURIComponent(now.toISOString());\n  const [groups, people, memberships, roles, quizzes] = await Promise.all([','bootstrap-now'],
['    supabaseRest<QuizRow[]>("quizzes?quiz_type=eq.WEEKLY&status=in.(OPEN,SCHEDULED)&order=open_at.asc&limit=3&select=id,title,subtitle,life_date_range,bible_range,open_at,close_at,status,quiz_type,selection_mode,random_question_count,published_question_count"),',
 '    supabaseRest<QuizRow[]>(`quizzes?quiz_type=eq.WEEKLY&status=neq.DRAFT&open_at=lte.${nowIso}&close_at=gte.${nowIso}&order=open_at.desc&limit=1&select=id,title,subtitle,life_date_range,bible_range,open_at,close_at,status,quiz_type,selection_mode,random_question_count,published_question_count`),','bootstrap-window'],
['  const now = Date.now();\n  const currentQuiz = quizzes.find((q) => q.open_at && q.close_at && new Date(q.open_at).getTime() <= now && now <= new Date(q.close_at).getTime()) ?? quizzes[0] ?? null;',
 '  const currentQuiz = quizzes[0] ?? null;','bootstrap-current']
]);

patchOptional('src/app/api/admin/dashboard/route.ts',[
['    const current = quizzes.find((q) => q.status === "OPEN") ?? quizzes[0] ?? null;',
 '    const now = Date.now();\n    const current = quizzes.find((q) => q.open_at && q.close_at && new Date(q.open_at).getTime() <= now && now <= new Date(q.close_at).getTime()) ?? null;','admin-dashboard-current']
]);

patchOptional('src/app/api/admin/stats/route.ts',[
['  const quizzes=await supabaseRest<Array<{id:string;title:string;status:string}>>("quizzes?quiz_type=eq.WEEKLY&order=open_at.desc&limit=1&select=id,title,status");\n  const quiz=quizzes[0]??null;if(!quiz)return NextResponse.json({quiz:null,participation:0,average:null,questions:[]});',
 '  const now=new Date();const nowIso=encodeURIComponent(now.toISOString());\n  const quizzes=await supabaseRest<Array<{id:string;title:string;status:string;open_at:string|null;close_at:string|null}>>(`quizzes?quiz_type=eq.WEEKLY&status=neq.DRAFT&open_at=lte.${nowIso}&close_at=gte.${nowIso}&order=open_at.desc&limit=1&select=id,title,status,open_at,close_at`);\n  const quiz=quizzes[0]??null;if(!quiz)return NextResponse.json({quiz:null,participation:0,average:null,questions:[]});','admin-stats-current']
]);

patchOptional('src/server/leaderRepository.ts',[
['  const current=quizRows.find(q=>q.status==="OPEN")??quizRows[0]??null;',
 '  const now=Date.now();\n  const current=quizRows.find(q=>q.open_at&&q.close_at&&new Date(q.open_at).getTime()<=now&&now<=new Date(q.close_at).getTime())??null;','leader-current']
]);

patchOptional('src/server/participantRepository.ts',[
['  return quizzes.filter(q=>q.quiz_type==="WEEKLY" || q.quiz_type==="SPECIAL").map(q=>{',
 '  const now=Date.now();\n  return quizzes.filter(q=>(q.quiz_type==="WEEKLY" || q.quiz_type==="SPECIAL") && Boolean(q.close_at) && new Date(q.close_at!).getTime()<now).map(q=>{','archive-ended-only']
]);

patchOptional('src/state/useQuizApp.ts',[
['type Persisted={groupId:string;person:Person|null;answers:Array<number|null>;questionIndex:number;weeklyResult:QuizResult|null;sessionId:string|null};',
 'type Persisted={groupId:string;person:Person|null;answers:Array<number|null>;questionIndex:number;weeklyResult:QuizResult|null;sessionId:string|null;weeklyQuizId?:string|null};','persisted-quiz-id'],
['type BootstrapQuiz={id:string;title:string;subtitle:string|null;life_date_range:string|null;bible_range:string|null;published_question_count:number|null;random_question_count:number|null;selection_mode:"FIXED"|"RANDOM"};',
 'type BootstrapQuiz={id:string;title:string;subtitle:string|null;life_date_range:string|null;bible_range:string|null;published_question_count:number|null;random_question_count:number|null;selection_mode:"FIXED"|"RANDOM"};\nconst EMPTY_WEEKLY_QUIZ:QuizDefinition={id:"",title:"이번 주 퀴즈가 아직 열리지 않았어요",subtitle:"공개 시간에 자동으로 표시됩니다.",lifeDateRange:"",bibleRange:"",questions:[]};','empty-quiz'],
[' const [weeklyQuiz,setWeeklyQuiz]=useState<QuizDefinition>(mockWeeklyQuiz); const [quiz,setQuiz]=useState<QuizDefinition>(mockWeeklyQuiz);',
 ' const [weeklyQuiz,setWeeklyQuiz]=useState<QuizDefinition>(USE_MOCK?mockWeeklyQuiz:EMPTY_WEEKLY_QUIZ); const [quiz,setQuiz]=useState<QuizDefinition>(USE_MOCK?mockWeeklyQuiz:EMPTY_WEEKLY_QUIZ);','no-mock-fallback'],
[' useEffect(()=>{if(!hydrated||testMode)return;window.localStorage.setItem(STORAGE_KEY,JSON.stringify({groupId,person,answers,questionIndex,weeklyResult,sessionId} satisfies Persisted));},[hydrated,testMode,groupId,person,answers,questionIndex,weeklyResult,sessionId]);',
 ' useEffect(()=>{if(!hydrated||testMode||USE_MOCK)return;try{const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){const saved=JSON.parse(raw) as Persisted;if(saved.weeklyQuizId!==weeklyQuiz.id){restoredAnswers.current=null;setAnswers([]);setQuestionIndex(0);setWeeklyResult(null);setResult(null);setSessionId(null);}}}catch{}},[hydrated,testMode,weeklyQuiz.id]);\n\n useEffect(()=>{if(!hydrated||testMode)return;window.localStorage.setItem(STORAGE_KEY,JSON.stringify({groupId,person,answers,questionIndex,weeklyResult,sessionId,weeklyQuizId:weeklyQuiz.id||null} satisfies Persisted));},[hydrated,testMode,groupId,person,answers,questionIndex,weeklyResult,sessionId,weeklyQuiz.id]);\n\n useEffect(()=>{if(!hydrated||USE_MOCK||testMode)return;let stopped=false;async function refreshCurrentWeek(){try{const r=await fetch(`/api/bootstrap?t=${Date.now()}`,{cache:"no-store"});if(!r.ok||stopped)return;const data=await r.json();const nextId=data.currentQuiz?.id??"";if(nextId!==weeklyQuiz.id)window.location.reload();}catch{}}const onFocus=()=>void refreshCurrentWeek();const onVisible=()=>{if(document.visibilityState==="visible")void refreshCurrentWeek();};window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisible);const timer=window.setInterval(()=>void refreshCurrentWeek(),5*60*1000);return()=>{stopped=true;window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible);window.clearInterval(timer);};},[hydrated,testMode,weeklyQuiz.id]);','persist-and-refresh'],
['try{const target=override?{...weeklyQuiz,id:override.id,title:override.title??"Quiz",subtitle:override.subtitle??"",bibleRange:override.bibleRange??"",lifeDateRange:override.lifeDateRange??"",questions:[]}:weeklyQuiz;setQuiz(target);',
 'try{const target=override?{...weeklyQuiz,id:override.id,title:override.title??"Quiz",subtitle:override.subtitle??"",bibleRange:override.bibleRange??"",lifeDateRange:override.lifeDateRange??"",questions:[]}:weeklyQuiz;if(!target.id)throw new Error("이번 주 퀴즈가 아직 열리지 않았습니다.");setQuiz(target);','start-empty-guard']
]);

patchOptional('src/components/HomeScreen.tsx',[
['export function HomeScreen({person,group,quiz,result,monthlyRanking,specialCount=0,onStart,onReview,onStats,onArchive,onSpecial,onWeeklyResult,onMonthlyResult,onSettings}:Props){const monthly=monthlyRanking?.me;const leader=monthlyRanking?.ranking?.find(r=>r.rank===1);return <><Brand/>',
 'export function HomeScreen({person,group,quiz,result,monthlyRanking,specialCount=0,onStart,onReview,onStats,onArchive,onSpecial,onWeeklyResult,onMonthlyResult,onSettings}:Props){const monthly=monthlyRanking?.me;const leader=monthlyRanking?.ranking?.find(r=>r.rank===1);const quizAvailable=Boolean(quiz.id);return <><Brand/>','home-available'],
['<div className="weeklyBody"><button className="btn btnPrimary full" onClick={onStart}>{result?"결과 보기":"퀴즈 시작하기"} →</button></div>',
 '<div className="weeklyBody"><button className="btn btnPrimary full" disabled={!quizAvailable} onClick={onStart}>{quizAvailable?(result?"결과 보기 →":"퀴즈 시작하기 →"):"이번 주 퀴즈 없음"}</button></div>','home-button']
]);

{
  const path='src/app/api/admin/quizzes/route.ts';
  let s=fs.readFileSync(path,'utf8');
  const before='export async function GET() {\n  try { await requireAdmin(); return NextResponse.json({ quizzes: await supabaseRest("quizzes?order=created_at.desc&select=*") }); }\n  catch (error) { const m = error instanceof Error ? error.message : "오류"; return NextResponse.json({ error:m }, { status:m === "ADMIN_REQUIRED" ? 403 : 500 }); }\n}';
  const after='export async function GET() {\n  try {\n    await requireAdmin();\n    const rows=await supabaseRest<any[]>("quizzes?order=created_at.desc&select=*");\n    const now=Date.now();\n    const quizzes=rows.map(q=>{\n      if(q.quiz_type!=="WEEKLY"||q.status==="DRAFT"||!q.open_at||!q.close_at)return q;\n      const open=new Date(q.open_at).getTime(),close=new Date(q.close_at).getTime();\n      return {...q,status:now<open?"SCHEDULED":now<=close?"OPEN":"CLOSED"};\n    });\n    return NextResponse.json({quizzes});\n  }\n  catch (error) { const m = error instanceof Error ? error.message : "오류"; return NextResponse.json({ error:m }, { status:m === "ADMIN_REQUIRED" ? 403 : 500 }); }\n}';
  if(!s.includes(before)) throw new Error('v1.4.6 patch target missing [admin-quizzes-status]');
  fs.writeFileSync(path,s.replace(before,after));
}

// Draft question deletion (requested operator feature)
{
  const path='src/app/api/admin/questions/route.ts';
  let s=fs.readFileSync(path,'utf8');
  if(!s.includes('export async function DELETE(request: Request)')){
    s += `

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { questionId?: string; quizId?: string };
    if (!body.questionId || !body.quizId) return NextResponse.json({ error: "삭제할 문제 정보가 필요합니다." }, { status: 400 });
    const quizzes = await supabaseRest<Array<{id:string;status:string;selection_mode:string;random_question_count:number|null}>>(`quizzes?id=eq.${body.quizId}&select=id,status,selection_mode,random_question_count`);
    const quiz = quizzes[0];
    if (!quiz) return NextResponse.json({ error: "퀴즈를 찾지 못했습니다." }, { status: 404 });
    if (quiz.status !== "DRAFT") return NextResponse.json({ error: "DRAFT 상태의 퀴즈 문제만 삭제할 수 있습니다." }, { status: 409 });
    await supabaseRest(`questions?id=eq.${body.questionId}&quiz_id=eq.${body.quizId}`, { method: "DELETE" });
    const remaining = await supabaseRest<Array<{id:string}>>(`questions?quiz_id=eq.${body.quizId}&selected=eq.true&select=id`);
    const selectedCount = remaining.length;
    const nextRandom = quiz.selection_mode === "RANDOM" ? Math.min(Number(quiz.random_question_count ?? selectedCount), selectedCount) : null;
    await supabaseRest(`quizzes?id=eq.${body.quizId}`, { method: "PATCH", body: JSON.stringify({published_question_count: quiz.selection_mode === "RANDOM" ? nextRandom : selectedCount,random_question_count: nextRandom}) });
    return NextResponse.json({ ok: true, selectedCount });
  } catch (error) {
    const m = error instanceof Error ? error.message : "문제 삭제 실패";
    return NextResponse.json({ error: m }, { status: m === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
`;
  }
  fs.writeFileSync(path,s);
}
