import fs from "node:fs";

function patch(path,before,after,label){
 let s=fs.readFileSync(path,"utf8");
 if(!s.includes(before)) throw new Error("Patch target not found: "+label);
 s=s.replace(before,after);
 fs.writeFileSync(path,s);
}

patch("src/state/useQuizApp.ts",
 'type PlayKind="WEEKLY"|"SPECIAL"|"PRACTICE";',
 'type PlayKind="WEEKLY"|"SPECIAL"|"PRACTICE"|"TEST";',
 "play kind");

patch("src/state/useQuizApp.ts",
 ' const [weeklyQuiz,setWeeklyQuiz]=useState<QuizDefinition>(mockWeeklyQuiz); const [quiz,setQuiz]=useState<QuizDefinition>(mockWeeklyQuiz); const [playKind,setPlayKind]=useState<PlayKind>("WEEKLY");',
 ' const [weeklyQuiz,setWeeklyQuiz]=useState<QuizDefinition>(mockWeeklyQuiz); const [quiz,setQuiz]=useState<QuizDefinition>(mockWeeklyQuiz); const [playKind,setPlayKind]=useState<PlayKind>("WEEKLY"); const [testMode,setTestMode]=useState(false);',
 "test mode state");

patch("src/state/useQuizApp.ts",
 'useEffect(()=>{async function hydrate(){try{if(!USE_MOCK){const response=await fetch("/api/bootstrap",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error??"초기 데이터를 불러오지 못했습니다.");setGroups(data.groups);setGroupId((c:string)=>c||data.groups?.[0]?.id||"");const q:BootstrapQuiz|null=data.currentQuiz;if(q){const def={id:q.id,title:q.title,subtitle:q.subtitle??"지난주 말씀 돌아보기",lifeDateRange:q.life_date_range??"",bibleRange:q.bible_range??"",questions:[],publishedQuestionCount:q.published_question_count??q.random_question_count??undefined};setWeeklyQuiz(def);setQuiz(def);}}\n const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){const saved=JSON.parse(raw) as Persisted;setGroupId(c=>saved.groupId||c);setPerson(saved.person??null);setQuestionIndex(saved.questionIndex??0);restoredAnswers.current=saved.answers??null;setWeeklyResult(saved.weeklyResult??null);setResult(saved.weeklyResult??null);setSessionId(saved.sessionId??null);if(saved.person)setScreen("home");}}',
 'useEffect(()=>{async function hydrate(){try{const params=new URLSearchParams(window.location.search);const requestedTest=params.get("test")==="1";const testQuizId=params.get("quizId");setTestMode(requestedTest);if(!USE_MOCK){const response=await fetch("/api/bootstrap",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error??"초기 데이터를 불러오지 못했습니다.");setGroups(data.groups);setGroupId((c:string)=>c||data.groups?.[0]?.id||"");let q:BootstrapQuiz|null=data.currentQuiz;if(requestedTest&&testQuizId){const tr=await fetch(`/api/admin/quizzes/test-context?quizId=${encodeURIComponent(testQuizId)}`,{cache:"no-store"});const tj=await tr.json();if(!tr.ok)throw new Error(tj.error??"테스트 퀴즈를 불러오지 못했습니다.");q=tj.quiz;}if(q){const def={id:q.id,title:q.title,subtitle:q.subtitle??"지난주 말씀 돌아보기",lifeDateRange:q.life_date_range??"",bibleRange:q.bible_range??"",questions:[],publishedQuestionCount:q.published_question_count??q.random_question_count??undefined};setWeeklyQuiz(def);setQuiz(def);}}\n if(!requestedTest){const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){const saved=JSON.parse(raw) as Persisted;setGroupId(c=>saved.groupId||c);setPerson(saved.person??null);setQuestionIndex(saved.questionIndex??0);restoredAnswers.current=saved.answers??null;setWeeklyResult(saved.weeklyResult??null);setResult(saved.weeklyResult??null);setSessionId(saved.sessionId??null);if(saved.person)setScreen("home");}}}',
 "hydrate test");

patch("src/state/useQuizApp.ts",
 ' useEffect(()=>{if(!hydrated)return;window.localStorage.setItem(STORAGE_KEY,JSON.stringify({groupId,person,answers,questionIndex,weeklyResult,sessionId} satisfies Persisted));},[hydrated,groupId,person,answers,questionIndex,weeklyResult,sessionId]);',
 ' useEffect(()=>{if(!hydrated||testMode)return;window.localStorage.setItem(STORAGE_KEY,JSON.stringify({groupId,person,answers,questionIndex,weeklyResult,sessionId} satisfies Persisted));},[hydrated,testMode,groupId,person,answers,questionIndex,weeklyResult,sessionId]);',
 "skip persistence in test");

patch("src/state/useQuizApp.ts",
 ' async function startQuiz(mode:"OFFICIAL"|"PRACTICE"="OFFICIAL",override?:{id:string;title?:string;subtitle?:string;bibleRange?:string;lifeDateRange?:string;kind?:PlayKind}){',
 ' async function startQuiz(mode:"OFFICIAL"|"PRACTICE"|"TEST"="OFFICIAL",override?:{id:string;title?:string;subtitle?:string;bibleRange?:string;lifeDateRange?:string;kind?:PlayKind}){',
 "start mode");

patch("src/state/useQuizApp.ts",
 'setPlayKind(override?.kind??(mode==="PRACTICE"?"PRACTICE":"WEEKLY"));',
 'setPlayKind(override?.kind??(mode==="PRACTICE"?"PRACTICE":mode==="TEST"?"TEST":"WEEKLY"));',
 "test play kind");

patch("src/state/useQuizApp.ts",
 ' function goHome(){setQuiz(weeklyQuiz);setPlayKind("WEEKLY");setResult(weeklyResult);setSpecialResult(null);setQuestions(weeklyQuiz.questions);setScreen("home");}',
 ' function goHome(){setQuiz(weeklyQuiz);setPlayKind(testMode?"TEST":"WEEKLY");setResult(testMode?null:weeklyResult);setSpecialResult(null);setQuestions(weeklyQuiz.questions);setScreen(testMode?"intro":"home");}',
 "test go home");

patch("src/state/useQuizApp.ts",
 ' return {hydrated,busy,error,setError,screen,setScreen,groupId,setGroupId,group,person,setPerson,answers,answer,questionIndex,setQuestionIndex,question,answeredCount,missing,result,weeklyResult,sessionId,submit,startQuiz,resetPractice,quiz:runtimeQuiz,weeklyQuiz,groups,reviewQuestions,reviewAllowed,reviewMessage,weeklyRanking,monthlyRanking,stats,archive,specials,specialResult,playKind,goHome,startSpecial,startArchivedPractice};',
 ' return {hydrated,busy,error,setError,screen,setScreen,groupId,setGroupId,group,person,setPerson,answers,answer,questionIndex,setQuestionIndex,question,answeredCount,missing,result,weeklyResult,sessionId,submit,startQuiz,resetPractice,quiz:runtimeQuiz,weeklyQuiz,groups,reviewQuestions,reviewAllowed,reviewMessage,weeklyRanking,monthlyRanking,stats,archive,specials,specialResult,playKind,testMode,goHome,startSpecial,startArchivedPractice};',
 "return test mode");

patch("src/app/page.tsx",
 '<main className="appShell" aria-live="polite">',
 '<main className="appShell" aria-live="polite">\n{app.testMode&&<div className="testModeBanner"><strong>TEST MODE</strong><span>공식 기록·랭킹·통계에 반영되지 않습니다.</span></div>}',
 "test banner");

patch("src/app/page.tsx",
 'onConfirm={()=>{app.setPerson(personCandidate);setPersonCandidate(null);app.setScreen("home");}}',
 'onConfirm={()=>{app.setPerson(personCandidate);setPersonCandidate(null);app.setScreen(app.testMode?"intro":"home");}}',
 "test person confirm");

patch("src/app/page.tsx",
 'onStart={()=>void app.startQuiz(app.playKind==="PRACTICE"?"PRACTICE":"OFFICIAL",app.playKind==="WEEKLY"?undefined:{id:app.quiz.id,title:app.quiz.title,subtitle:app.quiz.subtitle,bibleRange:app.quiz.bibleRange,lifeDateRange:app.quiz.lifeDateRange,kind:app.playKind})}',
 'onStart={()=>void app.startQuiz(app.testMode?"TEST":app.playKind==="PRACTICE"?"PRACTICE":"OFFICIAL",app.testMode?{id:app.quiz.id,title:app.quiz.title,subtitle:app.quiz.subtitle,bibleRange:app.quiz.bibleRange,lifeDateRange:app.quiz.lifeDateRange,kind:"TEST"}:app.playKind==="WEEKLY"?undefined:{id:app.quiz.id,title:app.quiz.title,subtitle:app.quiz.subtitle,bibleRange:app.quiz.bibleRange,lifeDateRange:app.quiz.lifeDateRange,kind:app.playKind})}',
 "test start");

patch("src/app/page.tsx",
 'weeklyRanking={app.playKind==="WEEKLY"?app.weeklyRanking:null} monthlyRanking={app.playKind==="WEEKLY"?app.monthlyRanking:null}',
 'weeklyRanking={app.playKind==="WEEKLY"&&!app.testMode?app.weeklyRanking:null} monthlyRanking={app.playKind==="WEEKLY"&&!app.testMode?app.monthlyRanking:null}',
 "hide test rankings");

patch("src/app/page.tsx",
 'body={`${app.person.name}님의 ${app.playKind==="PRACTICE"?"연습":"이번 기록"}으로 저장됩니다.`}',
 'body={app.testMode?`${app.person.name}님의 TEST 기록으로 저장되며 공식 통계에는 반영되지 않습니다.`:`${app.person.name}님의 ${app.playKind==="PRACTICE"?"연습":"이번 기록"}으로 저장됩니다.`}',
 "test submit copy");

patch("src/app/api/quiz/start/route.ts",
 'import { NextResponse } from "next/server";',
 'import { NextResponse } from "next/server";\nimport { requireAdmin } from "@/server/operatorAuth";',
 "start admin import");

patch("src/app/api/quiz/start/route.ts",
 'const mode=body.mode??"OFFICIAL"; const quiz=await getQuiz(body.quizId);',
 'const mode=body.mode??"OFFICIAL"; if(mode==="TEST")await requireAdmin(); const quiz=await getQuiz(body.quizId);',
 "start test auth");

patch("src/app/api/quiz/submit/route.ts",
 'import { NextResponse } from "next/server";',
 'import { NextResponse } from "next/server";\nimport { requireAdmin } from "@/server/operatorAuth";',
 "submit admin import");

patch("src/app/api/quiz/submit/route.ts",
 ' const session=await getSession(body.sessionId);',
 ' const session=await getSession(body.sessionId);if(session.mode==="TEST")await requireAdmin();',
 "submit test auth");

patch("src/app/operator/page.tsx",
 '<button className="primary" disabled={busy||selectedCount===0||!publishStart||!publishEnd} onClick={()=>void publishQuiz()}>퀴즈 공개 / 예약</button></section>',
 '<div className="adminControls"><button className="primary" disabled={busy||selectedCount===0||!publishStart||!publishEnd} onClick={()=>void publishQuiz()}>퀴즈 공개 / 예약</button><button className="ghost" disabled={busy||!activeQuiz||selectedCount===0} onClick={()=>window.open(`/?test=1&quizId=${encodeURIComponent(activeQuiz)}`,"_blank","noopener,noreferrer")}>TEST 모드로 열기</button></div></section>',
 "admin test button");

fs.mkdirSync("src/app/api/admin/quizzes/test-context",{recursive:true});
fs.copyFileSync("deploy-patches/v116-test-context-route.ts","src/app/api/admin/quizzes/test-context/route.ts");

let css=fs.readFileSync("src/app/globals.css","utf8");
if(!css.includes(".testModeBanner{")){
 css+='\n.testModeBanner{position:sticky;top:0;z-index:50;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 14px;background:#fff3cd;border-bottom:1px solid #e2c46b;color:#5f4a00;font-size:14px}.testModeBanner strong{letter-spacing:.08em}.testModeBanner span{font-weight:600}\n';
 fs.writeFileSync("src/app/globals.css",css);
}

const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
pkg.version="1.1.6";
fs.writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");
