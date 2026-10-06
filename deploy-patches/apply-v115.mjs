import fs from "node:fs";

const pagePath="src/app/operator/page.tsx";
let s=fs.readFileSync(pagePath,"utf8");

function rep(before,after,label){
 if(!s.includes(before)) throw new Error("Patch target not found: "+label);
 s=s.replace(before,after);
}

rep(
'type Quiz={id:string;title:string;status:string;selection_mode:"FIXED"|"RANDOM";random_question_count:number|null;published_question_count:number|null};',
'type Quiz={id:string;title:string;status:string;selection_mode:"FIXED"|"RANDOM";random_question_count:number|null;published_question_count:number|null;open_at:string|null;close_at:string|null};',
"quiz type"
);
rep(
' const [operators,setOperators]=useState<Operator[]>([]); const [session,setSession]=useState<any>(null); const [selectedOperator,setSelectedOperator]=useState(""); const [pin,setPin]=useState(""); const [setupCode,setSetupCode]=useState(""); const [newPin,setNewPin]=useState(""); const [error,setError]=useState("");',
' const [operators,setOperators]=useState<Operator[]>([]); const [session,setSession]=useState<any>(null); const [selectedOperator,setSelectedOperator]=useState(""); const [pin,setPin]=useState(""); const [setupCode,setSetupCode]=useState(""); const [newPin,setNewPin]=useState(""); const [error,setError]=useState(""); const [success,setSuccess]=useState("");',
"success state"
);
rep(
' const [tab,setTab]=useState<"dashboard"|"quiz"|"import"|"people"|"permissions"|"season"|"monthly"|"special"|"stats">("dashboard"); const [leaderDashboard,setLeaderDashboard]=useState<any>(null); const [adminStats,setAdminStats]=useState<any>(null); const [dashboard,setDashboard]=useState<any>(null); const [quizzes,setQuizzes]=useState<Quiz[]>([]); const [activeQuiz,setActiveQuiz]=useState(""); const [questions,setQuestions]=useState<Question[]>([]); const [selectionMode,setSelectionMode]=useState<"FIXED"|"RANDOM">("FIXED"); const [randomCount,setRandomCount]=useState(10); const [people,setPeople]=useState<Person[]>([]); const [groups,setGroups]=useState<Group[]>([]); const [busy,setBusy]=useState(false);',
' const [tab,setTab]=useState<"dashboard"|"quiz"|"import"|"people"|"permissions"|"season"|"monthly"|"special"|"stats">("dashboard"); const [leaderDashboard,setLeaderDashboard]=useState<any>(null); const [adminStats,setAdminStats]=useState<any>(null); const [dashboard,setDashboard]=useState<any>(null); const [quizzes,setQuizzes]=useState<Quiz[]>([]); const [activeQuiz,setActiveQuiz]=useState(""); const [questions,setQuestions]=useState<Question[]>([]); const [selectionMode,setSelectionMode]=useState<"FIXED"|"RANDOM">("FIXED"); const [randomCount,setRandomCount]=useState(10); const [publishStart,setPublishStart]=useState(""); const [publishEnd,setPublishEnd]=useState(""); const [people,setPeople]=useState<Person[]>([]); const [groups,setGroups]=useState<Group[]>([]); const [busy,setBusy]=useState(false);',
"publish state"
);
rep(
' const [imports,setImports]=useState<ImportItem[]>([]); const [importMode,setImportMode]=useState<"NEW"|"REPLACE">("NEW"); const [monthKey,setMonthKey]=useState(""); const [preview,setPreview]=useState<ImportPreview|null>(null); const [replaceImportId,setReplaceImportId]=useState("");',
' const [imports,setImports]=useState<ImportItem[]>([]); const [importMode,setImportMode]=useState<"NEW"|"REPLACE">("NEW"); const [monthKey,setMonthKey]=useState(""); const [preview,setPreview]=useState<ImportPreview|null>(null); const [replaceImportId,setReplaceImportId]=useState(""); const [importUrl,setImportUrl]=useState("");',
"import url state"
);

rep(
' const currentOperator=operators.find(o=>o.id===selectedOperator); const selectedCount=useMemo(()=>questions.filter(q=>q.selected).length,[questions]);',
' const currentOperator=operators.find(o=>o.id===selectedOperator); const selectedCount=useMemo(()=>questions.filter(q=>q.selected).length,[questions]);\n function localDateTimeValue(iso:string|null){if(!iso)return "";const d=new Date(iso);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}\n function defaultWeeklyWindow(){const now=new Date();const day=now.getDay();const diff=(day+6)%7;const start=new Date(now);start.setDate(now.getDate()-diff);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+5);end.setHours(23,59,0,0);const fmt=(d:Date)=>{const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);};return [fmt(start),fmt(end)] as const;}\n function showSuccess(message:string){setError("");setSuccess(message);window.setTimeout(()=>setSuccess(current=>current===message?"":current),4500);}',
"helpers"
);

rep(
' async function loadQuestions(id:string){if(!id)return;const j=await jsonFetch(`/api/admin/questions?quizId=${id}`);setQuestions(j.questions??[]);const q=quizzes.find(x=>x.id===id);if(q){setSelectionMode(q.selection_mode);setRandomCount(q.random_question_count??10);}}',
' async function loadQuestions(id:string){if(!id)return;const j=await jsonFetch(`/api/admin/questions?quizId=${id}`);setQuestions(j.questions??[]);const q=quizzes.find(x=>x.id===id);if(q){setSelectionMode(q.selection_mode);setRandomCount(q.random_question_count??10);if(q.open_at&&q.close_at){setPublishStart(localDateTimeValue(q.open_at));setPublishEnd(localDateTimeValue(q.close_at));}else{const [start,end]=defaultWeeklyWindow();setPublishStart(start);setPublishEnd(end);}}}',
"load questions schedule"
);

rep(
' async function saveSelection(){setBusy(true);setError("");try{await jsonFetch("/api/admin/questions/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:activeQuiz,selectedQuestionIds:questions.filter(q=>q.selected).map(q=>q.id),selectionMode,randomQuestionCount:randomCount})});await loadAdmin();await loadQuestions(activeQuiz);}catch(e){setError(e instanceof Error?e.message:"저장 실패");}finally{setBusy(false);}}',
' async function saveSelection(){setBusy(true);setError("");setSuccess("");try{await jsonFetch("/api/admin/questions/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:activeQuiz,selectedQuestionIds:questions.filter(q=>q.selected).map(q=>q.id),selectionMode,randomQuestionCount:randomCount})});await loadAdmin();await loadQuestions(activeQuiz);showSuccess(`문제 선택이 저장되었습니다. ${selectedCount}개 문제를 출제 대상으로 저장했습니다.`);}catch(e){setError(e instanceof Error?e.message:"저장 실패");}finally{setBusy(false);}}\n async function publishQuiz(){if(!activeQuiz||!publishStart||!publishEnd)return;setBusy(true);setError("");setSuccess("");try{const j=await jsonFetch("/api/admin/quizzes/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:activeQuiz,openAt:new Date(publishStart).toISOString(),closeAt:new Date(publishEnd).toISOString()})});await loadAdmin();showSuccess(j.status==="OPEN"?"퀴즈가 공개되었습니다. 참가자 화면에서 지금 바로 시작할 수 있습니다.":"퀴즈가 예약되었습니다. 설정한 공개 시작 시간부터 참가자 화면에 표시됩니다.");}catch(e){setError(e instanceof Error?e.message:"퀴즈 공개 실패");}finally{setBusy(false);}}',
"save/publish functions"
);

rep(
' async function previewFile(file:File){setBusy(true);setError("");try{const f=new FormData();f.append("file",file);f.append("mode",importMode);f.append("replaceImportId",replaceImportId);const r=await fetch("/api/admin/import/preview",{method:"POST",body:f});const j=await r.json();if(!r.ok)throw new Error(j.error??"미리보기 실패");setPreview(j);}catch(e){setError(e instanceof Error?e.message:"미리보기 실패");}finally{setBusy(false);}}',
' async function previewFile(file:File){setBusy(true);setError("");setSuccess("");try{const f=new FormData();f.append("file",file);f.append("mode",importMode);f.append("replaceImportId",replaceImportId);const r=await fetch("/api/admin/import/preview",{method:"POST",body:f});const j=await r.json();if(!r.ok)throw new Error(j.error??"미리보기 실패");setPreview(j);showSuccess(`Excel 파일을 읽었습니다. ${j.totalQuestions}개 후보 문제를 확인해주세요.`);}catch(e){setError(e instanceof Error?e.message:"미리보기 실패");}finally{setBusy(false);}}\n async function previewUrl(){if(!importUrl.trim())return;setBusy(true);setError("");setSuccess("");try{const j=await jsonFetch("/api/admin/import/preview-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:importUrl.trim(),mode:importMode,replaceImportId})});setPreview(j);showSuccess(`주소에서 Excel 파일을 읽었습니다. ${j.totalQuestions}개 후보 문제를 확인해주세요.`);}catch(e){setError(e instanceof Error?e.message:"주소 불러오기 실패");}finally{setBusy(false);}}',
"preview functions"
);

rep(
' async function commitImport(){if(!preview)return;setBusy(true);try{await jsonFetch("/api/admin/import/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:preview.fileName,sourceHash:preview.hash,monthKey,mode:importMode,replaceImportId:replaceImportId||null,weeks:preview.weeks})});alert("후보 문제를 불러왔습니다. 퀴즈·문제에서 체크해 실제 출제문제를 선택하세요.");setPreview(null);await loadAdmin();setTab("quiz");}catch(e){setError(e instanceof Error?e.message:"Import 실패");}finally{setBusy(false);}}',
' async function commitImport(){if(!preview)return;setBusy(true);setError("");setSuccess("");try{const j=await jsonFetch("/api/admin/import/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:preview.fileName,sourceHash:preview.hash,monthKey,mode:importMode,replaceImportId:replaceImportId||null,weeks:preview.weeks})});setPreview(null);await loadAdmin();setTab("quiz");showSuccess(`퀴즈 후보가 등록되었습니다. ${j.createdQuizIds?.length??0}개 주차 퀴즈를 만들었습니다. 문제를 선택한 뒤 공개해주세요.`);}catch(e){setError(e instanceof Error?e.message:"Import 실패");}finally{setBusy(false);}}',
"commit feedback"
);

rep(
'<section className="adminMain">{error&&<div className="errorBanner">{error}</div>}',
'<section className="adminMain">{success&&<div className="successBanner">✓ {success}</div>}{error&&<div className="errorBanner">{error}</div>}',
"success banner"
);

rep(
'{tab==="quiz"&&<><div className="adminTitleRow"><div><p className="eyebrow">QUESTION CANDIDATES</p><h1>문제 선택</h1></div><div className="selectionCount"><strong>{selectedCount}</strong>개 선택 / 후보 {questions.length}개</div></div><div className="adminControls"><select value={activeQuiz} onChange={e=>setActiveQuiz(e.target.value)}>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title} · {q.status}</option>)}</select><label><input type="radio" checked={selectionMode==="FIXED"} onChange={()=>setSelectionMode("FIXED")}/> 고정 출제</label><label><input type="radio" checked={selectionMode==="RANDOM"} onChange={()=>setSelectionMode("RANDOM")}/> 랜덤 출제</label>{selectionMode==="RANDOM"&&<label>출제 수 <input className="smallInput" type="number" min={1} max={selectedCount||1} value={randomCount} onChange={e=>setRandomCount(Number(e.target.value))}/></label>}<button className="primary" disabled={busy||selectedCount===0} onClick={()=>void saveSelection()}>선택 저장</button></div><div className="candidateList">',
'{tab==="quiz"&&<><div className="adminTitleRow"><div><p className="eyebrow">QUESTION CANDIDATES</p><h1>문제 선택 · 공개</h1></div><div className="selectionCount"><strong>{selectedCount}</strong>개 선택 / 후보 {questions.length}개</div></div><div className="adminControls"><select value={activeQuiz} onChange={e=>setActiveQuiz(e.target.value)}>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title} · {q.status}</option>)}</select><label><input type="radio" checked={selectionMode==="FIXED"} onChange={()=>setSelectionMode("FIXED")}/> 고정 출제</label><label><input type="radio" checked={selectionMode==="RANDOM"} onChange={()=>setSelectionMode("RANDOM")}/> 랜덤 출제</label>{selectionMode==="RANDOM"&&<label>출제 수 <input className="smallInput" type="number" min={1} max={selectedCount||1} value={randomCount} onChange={e=>setRandomCount(Number(e.target.value))}/></label>}<button className="primary" disabled={busy||selectedCount===0} onClick={()=>void saveSelection()}>선택 저장</button></div><section className="adminPanel publishPanel"><div className="adminTitleRow"><div><h3>퀴즈 공개</h3><p>선택 저장 후 공개 기간을 확인하고 공개하세요.</p></div><span className="statusPill">{quizzes.find(q=>q.id===activeQuiz)?.status??"DRAFT"}</span></div><div className="formGrid"><label>공개 시작<input type="datetime-local" value={publishStart} onChange={e=>setPublishStart(e.target.value)}/></label><label>마감<input type="datetime-local" value={publishEnd} onChange={e=>setPublishEnd(e.target.value)}/></label></div><button className="primary" disabled={busy||selectedCount===0||!publishStart||!publishEnd} onClick={()=>void publishQuiz()}>퀴즈 공개 / 예약</button></section><div className="candidateList">',
"quiz publish UI"
);

rep(
'<label>Excel 파일<input type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void previewFile(f);}}/></label></div></div>',
'<label>Excel 파일<input type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void previewFile(f);}}/></label><label>또는 HTTPS 파일 주소<input value={importUrl} onChange={e=>setImportUrl(e.target.value)} placeholder="https://.../quiz.xlsx"/><button type="button" className="ghost" disabled={busy||!importUrl.trim()} onClick={()=>void previewUrl()}>주소에서 불러오기</button></label></div></div>',
"URL import UI"
);

fs.writeFileSync(pagePath,s);

fs.mkdirSync("src/app/api/admin/quizzes/publish",{recursive:true});
fs.mkdirSync("src/app/api/admin/import/preview-url",{recursive:true});
fs.copyFileSync("deploy-patches/v115-publish-route.ts","src/app/api/admin/quizzes/publish/route.ts");
fs.copyFileSync("deploy-patches/v115-preview-url-route.ts","src/app/api/admin/import/preview-url/route.ts");

const cssPath="src/app/globals.css";
let css=fs.readFileSync(cssPath,"utf8");
if(!css.includes(".successBanner{")){
 css += '\n.successBanner{position:sticky;top:12px;z-index:20;margin-bottom:16px;padding:14px 16px;border:1px solid #b8d8c8;background:#edf8f2;color:#174f37;border-radius:10px;font-weight:800;box-shadow:0 8px 24px rgba(23,79,55,.08)}\n.publishPanel{margin:16px 0}.publishPanel .formGrid{margin:12px 0}.publishPanel p{margin:.25rem 0 0;color:#667085}\n';
 fs.writeFileSync(cssPath,css);
}

const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
pkg.version="1.1.5";
fs.writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");
