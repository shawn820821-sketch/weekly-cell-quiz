import fs from "node:fs";

function replace(path,before,after,label){
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes(before)) throw new Error("Patch target not found: "+label);
  s=s.replace(before,after);
  fs.writeFileSync(path,s);
}
function write(path,content){fs.mkdirSync(path.split("/").slice(0,-1).join("/"),{recursive:true});fs.writeFileSync(path,content);}

write("src/app/api/admin/quizzes/status/route.ts",`import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function POST(request:Request){
 try{
  await requireAdmin();
  const {quizId,action}=await request.json() as {quizId?:string;action?:"CLOSE"|"DRAFT"};
  if(!quizId||!action)return NextResponse.json({error:"퀴즈와 변경 상태를 확인해주세요."},{status:400});
  const rows=await supabaseRest<Array<{id:string;status:string}>>(\`quizzes?id=eq.\${quizId}&limit=1&select=id,status\`);
  if(!rows[0])return NextResponse.json({error:"퀴즈를 찾을 수 없습니다."},{status:404});
  if(action==="CLOSE"){await supabaseRest(\`quizzes?id=eq.\${quizId}\`,{method:"PATCH",body:JSON.stringify({status:"CLOSED",close_at:new Date().toISOString()})});return NextResponse.json({ok:true,status:"CLOSED"});}
  await supabaseRest(\`quizzes?id=eq.\${quizId}\`,{method:"PATCH",body:JSON.stringify({status:"DRAFT",open_at:null,close_at:null})});
  return NextResponse.json({ok:true,status:"DRAFT"});
 }catch(e){const m=e instanceof Error?e.message:"상태 변경 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}
}
`);

write("src/app/api/admin/test-reset/route.ts",`import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/operatorAuth";
import { supabaseRest } from "@/lib/supabase/rest";
export async function POST(request:Request){try{await requireAdmin();const {quizId}=await request.json() as {quizId?:string};if(!quizId)return NextResponse.json({error:"quizId가 필요합니다."},{status:400});const sessions=await supabaseRest<Array<{id:string}>>(\`quiz_sessions?quiz_id=eq.\${quizId}&mode=eq.TEST&select=id\`);const ids=sessions.map(s=>s.id);if(ids.length){const subs=await supabaseRest<Array<{id:string}>>(\`submissions?session_id=in.(\${ids.join(",")})&select=id\`);const subIds=subs.map(s=>s.id);if(subIds.length)await supabaseRest(\`answers?submission_id=in.(\${subIds.join(",")})\`,{method:"DELETE"});await supabaseRest(\`submissions?session_id=in.(\${ids.join(",")})\`,{method:"DELETE"});await supabaseRest(\`quiz_sessions?id=in.(\${ids.join(",")})\`,{method:"DELETE"});}return NextResponse.json({ok:true,deletedSessions:ids.length});}catch(e){const m=e instanceof Error?e.message:"TEST 기록 초기화 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
`);

let groups=fs.readFileSync("src/app/api/admin/groups/route.ts","utf8");
if(!groups.includes("export async function PATCH")) groups += `
export async function PATCH(request:Request){try{await requireAdmin();const body=await request.json();if(!body.id)return NextResponse.json({error:"id 필요"},{status:400});const group=await supabaseRest(\`groups?id=eq.\${body.id}\`,{method:"PATCH",body:JSON.stringify({name:body.name,active:body.active})});return NextResponse.json({group});}catch(e){const m=e instanceof Error?e.message:"셀 수정 실패";return NextResponse.json({error:m},{status:m==="ADMIN_REQUIRED"?403:500});}}
`;
fs.writeFileSync("src/app/api/admin/groups/route.ts",groups);

replace("src/server/seasonSpecialRepository.ts",
`  const rows=await supabaseRest<MonthlyPeriodRow[]>("monthly_periods",{method:"POST",body:JSON.stringify({season_id:input.seasonId,name:input.name,starts_on:input.startsOn,ends_on:input.endsOn,closed:false})});
  return rows[0];`,
`  const rows=await supabaseRest<MonthlyPeriodRow[]>("monthly_periods",{method:"POST",body:JSON.stringify({season_id:input.seasonId,name:input.name,starts_on:input.startsOn,ends_on:input.endsOn,closed:false})});
  const period=rows[0];
  if(period){
    const start=\`\${input.startsOn}T00:00:00.000Z\`; const endExclusive=new Date(\`\${input.endsOn}T00:00:00.000Z\`); endExclusive.setUTCDate(endExclusive.getUTCDate()+1);
    const candidates=await supabaseRest<Array<{id:string;monthly_period_id:string|null}>>(\`quizzes?quiz_type=eq.WEEKLY&open_at=gte.\${encodeURIComponent(start)}&open_at=lt.\${encodeURIComponent(endExclusive.toISOString())}&select=id,monthly_period_id\`);
    const attach=candidates.filter(q=>!q.monthly_period_id).map(q=>q.id);
    if(attach.length)await supabaseRest(\`quizzes?id=in.(\${attach.join(",")})\`,{method:"PATCH",body:JSON.stringify({monthly_period_id:period.id})});
  }
  return period;`,"monthly period link");

replace("src/server/seasonSpecialRepository.ts",
`  const names=new Map(people.map(p=>[p.id,p.display_name]));
  const agg=new Map<string,{personId:string;groupId:string|null;score:number;participationCount:number;name:string}>();
  for(const s of subs){ if(!names.has(s.person_id)) continue; const key=\`\${s.person_id}:\${s.group_id_snapshot??""}\`; const cur=agg.get(key)??{personId:s.person_id,groupId:s.group_id_snapshot,score:0,participationCount:0,name:names.get(s.person_id)!}; cur.score+=s.score; cur.participationCount+=1; agg.set(key,cur); }
  const ranked=competitionRanks([...agg.values()]);`,
`  const names=new Map(people.map(p=>[p.id,p.display_name]));
  const memberships=await supabaseRest<Array<{person_id:string;group_id:string}>>(\`group_memberships?starts_on=lte.\${period.ends_on}&or=(ends_on.is.null,ends_on.gte.\${period.ends_on})&select=person_id,group_id\`);
  const eligibleMemberships=memberships.filter(m=>names.has(m.person_id));
  const agg=new Map<string,{personId:string;groupId:string|null;score:number;participationCount:number;name:string}>();
  for(const m of eligibleMemberships){const key=\`\${m.person_id}:\${m.group_id}\`;agg.set(key,{personId:m.person_id,groupId:m.group_id,score:0,participationCount:0,name:names.get(m.person_id)!});}
  for(const sub of subs){ if(!names.has(sub.person_id)) continue; const key=\`\${sub.person_id}:\${sub.group_id_snapshot??""}\`; const cur=agg.get(key)??{personId:sub.person_id,groupId:sub.group_id_snapshot,score:0,participationCount:0,name:names.get(sub.person_id)!}; cur.score+=sub.score; cur.participationCount+=1; agg.set(key,cur); }
  const active=[...agg.values()].filter(r=>r.participationCount>0);
  const rankedActive=competitionRanks(active); const rankMap=new Map(rankedActive.map(r=>[\`\${r.personId}:\${r.groupId??""}\`,r.rank]));
  const ranked=[...agg.values()].map(r=>({...r,rank:r.participationCount>0?(rankMap.get(\`\${r.personId}:\${r.groupId??""}\`)??null):null}));`,"monthly missing");

replace("src/server/seasonSpecialRepository.ts",
"  const winners=ranked.filter(r=>r.rank===1);",
"  const winners=ranked.filter(r=>r.rank===1 && r.participationCount>0);","monthly winners");

replace("src/server/participantRepository.ts",
`  return quizzes.map(q=>{ const st=settingMap.get(q.id); const attempts=subs.filter(s=>s.quiz_id===q.id); const latest=attempts[0]??null; const pass=passMap.get(q.id)??null; return {quizId:q.id,title:q.title,openAt:q.open_at,closeAt:q.close_at,specialMode:st?.special_mode??"NORMAL",passScore:st?.pass_score??80,retryMode:st?.retry_mode??"NONE",maxAttempts:st?.max_attempts??null,theme:st?.theme??"DEFAULT",issuePass:st?.issue_pass??false,customPassMessage:st?.custom_pass_message??null,attemptCount:attempts.length,latestScore:latest?.score??null,passed:Boolean(pass),pass}; });`,
`  return quizzes.map(q=>{ const st=settingMap.get(q.id); const attempts=subs.filter(s=>s.quiz_id===q.id); const latest=attempts[0]??null; const pass=passMap.get(q.id)??null; const passed=Boolean(pass); const retry=st?.retry_mode??"NONE"; const max=st?.max_attempts??null; const canAttempt=!passed && (attempts.length===0 || retry==="UNTIL_PASS" || (retry==="MAX_ATTEMPTS"&&attempts.length<(max??1))); return {quizId:q.id,title:q.title,openAt:q.open_at,closeAt:q.close_at,specialMode:st?.special_mode??"NORMAL",passScore:st?.pass_score??80,retryMode:retry,maxAttempts:max,theme:st?.theme??"DEFAULT",issuePass:st?.issue_pass??false,customPassMessage:st?.custom_pass_message??null,attemptCount:attempts.length,latestScore:latest?.score??null,passed,canAttempt,pass}; });`,"special retry status");

replace("src/components/SpecialScreen.tsx",
'<small>{s.passed ? "PASS 완료" : `${s.passScore}점 이상 PASS`}</small>',
'<small>{s.specialMode==="PASS"?(s.passed?"PASS 완료":`${s.passScore}점 이상 PASS`):s.specialMode==="RANKING"?"점수 순위형":"일반 참여형"}</small>',"special label");
replace("src/components/SpecialScreen.tsx",
'{s.passed ? <div className="passStamp">PASS</div> : <button className="btn btnPrimary full" onClick={()=>onStart(s.quizId)}>도전하기</button>}',
'{s.specialMode==="PASS"&&s.passed ? <div className="passStamp">PASS</div> : s.canAttempt!==false ? <button className="btn btnPrimary full" onClick={()=>onStart(s.quizId)}>도전하기</button> : <div className="subtle">도전 가능 횟수를 모두 사용했어요.</div>}',"special button");

replace("src/app/operator/page.tsx",
' const [specialTitle,setSpecialTitle]=useState(""); const [specialMode,setSpecialMode]=useState("PASS"); const [passScore,setPassScore]=useState(80); const [retryMode,setRetryMode]=useState("UNTIL_PASS"); const [issuePass,setIssuePass]=useState(true);',
' const [specialTitle,setSpecialTitle]=useState(""); const [specialMode,setSpecialMode]=useState("PASS"); const [passScore,setPassScore]=useState(80); const [retryMode,setRetryMode]=useState("UNTIL_PASS"); const [maxAttempts,setMaxAttempts]=useState(3); const [answerRevealMode,setAnswerRevealMode]=useState("AFTER_PASS"); const [answerRevealAt,setAnswerRevealAt]=useState(""); const [specialMessage,setSpecialMessage]=useState(""); const [issuePass,setIssuePass]=useState(true);',"special state");

const marker=' async function addPerson()';
let op=fs.readFileSync("src/app/operator/page.tsx","utf8");
const extra=`
 async function changeQuizStatus(action:"CLOSE"|"DRAFT"){if(!activeQuiz)return;if(action==="DRAFT"&&!confirm("공개를 취소하고 DRAFT로 되돌릴까요? 공개 기간도 초기화됩니다."))return;setBusy(true);try{const j=await jsonFetch("/api/admin/quizzes/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:activeQuiz,action})});await loadAdmin();await loadQuestions(activeQuiz);showSuccess(j.status==="CLOSED"?"퀴즈를 마감했습니다. 신규 공식 응시는 시작할 수 없습니다.":"퀴즈 공개를 취소하고 DRAFT로 되돌렸습니다.");}catch(e){setError(e instanceof Error?e.message:"상태 변경 실패");}finally{setBusy(false);}}
 async function resetTestRecords(){if(!activeQuiz||!confirm("이 퀴즈의 TEST 기록만 모두 초기화할까요? 공식/연습 기록은 삭제되지 않습니다."))return;setBusy(true);try{const j=await jsonFetch("/api/admin/test-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:activeQuiz})});showSuccess(\`TEST 기록을 초기화했습니다. \${j.deletedSessions??0}개 세션 삭제\`);}catch(e){setError(e instanceof Error?e.message:"TEST 기록 초기화 실패");}finally{setBusy(false);}}
 async function togglePerson(p:Person){setBusy(true);try{await jsonFetch("/api/admin/people",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:p.id,name:p.display_name,active:!p.active,rankingEligible:p.ranking_eligible})});await loadAdmin();showSuccess(\`\${p.display_name}님을 \${p.active?"비활성":"활성"} 상태로 변경했습니다.\`);}catch(e){setError(e instanceof Error?e.message:"참가자 수정 실패");}finally{setBusy(false);}}
 async function toggleGroup(g:Group){setBusy(true);try{await jsonFetch("/api/admin/groups",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:g.id,name:g.name,active:!g.active})});await loadAdmin();showSuccess(\`\${g.name} 셀을 \${g.active?"비활성":"활성"} 상태로 변경했습니다.\`);}catch(e){setError(e instanceof Error?e.message:"셀 수정 실패");}finally{setBusy(false);}}
`;
if(!op.includes(extra.trim())){if(!op.includes(marker))throw new Error("operator function marker missing");op=op.replace(marker,extra+marker);}
fs.writeFileSync("src/app/operator/page.tsx",op);

replace("src/app/operator/page.tsx",
' async function addPerson(){const name=prompt("새 참가자 이름");if(!name)return;await jsonFetch("/api/admin/people",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});await loadAdmin();}',
' async function addPerson(){const name=prompt("새 참가자 이름");if(!name)return;setBusy(true);try{await jsonFetch("/api/admin/people",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});await loadAdmin();showSuccess(`${name} 참가자가 등록되었습니다.`);}catch(e){setError(e instanceof Error?e.message:"참가자 추가 실패");}finally{setBusy(false);}}',"person feedback");
replace("src/app/operator/page.tsx",
' async function addGroup(){const name=prompt("새 셀 이름");if(!name)return;await jsonFetch("/api/admin/groups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});await loadAdmin();}',
' async function addGroup(){const name=prompt("새 셀 이름");if(!name)return;setBusy(true);try{await jsonFetch("/api/admin/groups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});await loadAdmin();showSuccess(`${name} 셀이 등록되었습니다.`);}catch(e){setError(e instanceof Error?e.message:"셀 추가 실패");}finally{setBusy(false);}}',"group feedback");
replace("src/app/operator/page.tsx",'setSelectedPeople([]);await loadAdmin();alert("셀 이동을 저장했습니다.");','setSelectedPeople([]);await loadAdmin();showSuccess("선택한 참가자의 셀 이동을 저장했습니다.");',"move feedback");
replace("src/app/operator/page.tsx",'setCurrentPinChange("");setNewPinChange("");alert("PIN을 변경했습니다.");','setCurrentPinChange("");setNewPinChange("");showSuccess("PIN을 변경했습니다.");',"pin feedback");
replace("src/app/operator/page.tsx",'await bootstrap();alert("권한을 해제했습니다.");','await bootstrap();showSuccess("권한을 해제했습니다.");',"revoke feedback");
replace("src/app/operator/page.tsx",
' async function createSeasonUi(){await jsonFetch("/api/admin/seasons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:seasonName,startsOn:seasonStart,endsOn:seasonEnd,active:true})});setSeasonName("");await loadSeasonSpecial();}',
' async function createSeasonUi(){await jsonFetch("/api/admin/seasons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:seasonName,startsOn:seasonStart,endsOn:seasonEnd,active:true})});setSeasonName("");await loadSeasonSpecial();showSuccess("Season이 생성되고 활성화되었습니다.");}',"season feedback");
replace("src/app/operator/page.tsx",
' async function createPeriodUi(){await jsonFetch("/api/admin/monthly-periods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({seasonId:periodSeason,name:periodName,startsOn:periodStart,endsOn:periodEnd})});setPeriodName("");await loadSeasonSpecial();}',
' async function createPeriodUi(){await jsonFetch("/api/admin/monthly-periods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({seasonId:periodSeason,name:periodName,startsOn:periodStart,endsOn:periodEnd})});setPeriodName("");await loadSeasonSpecial();await loadAdmin();showSuccess("월간 기간이 생성되고 해당 기간의 Weekly Quiz가 자동 연결되었습니다.");}',"period feedback");
replace("src/app/operator/page.tsx",'alert(`결산 완료 · Winner ${j.winners?.length??0}명`);await loadSeasonSpecial();','showSuccess(`월간 결산이 확정되었습니다. Winner ${j.winners?.length??0}명`);await loadSeasonSpecial();',"settle feedback");
replace("src/app/operator/page.tsx",
' async function createSpecialUi(){await jsonFetch("/api/admin/special",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:specialTitle,specialMode,passScore,retryMode,issuePass,publishedQuestionCount:10,selectionMode:"FIXED"})});setSpecialTitle("");await loadSeasonSpecial();}',
' async function createSpecialUi(){await jsonFetch("/api/admin/special",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:specialTitle,specialMode,passScore,retryMode,maxAttempts,answerRevealMode,answerRevealAt:answerRevealMode==="AT_TIME"&&answerRevealAt?new Date(answerRevealAt).toISOString():null,customPassMessage:specialMessage||null,issuePass,publishedQuestionCount:10,selectionMode:"FIXED"})});setSpecialTitle("");await loadSeasonSpecial();await loadAdmin();showSuccess("Special Quiz 초안이 생성되었습니다. 퀴즈 · 문제에서 문제를 선택하고 공개해주세요.");}',"special create");

replace("src/app/operator/page.tsx",
'<button className="ghost" disabled={busy||!activeQuiz||selectedCount===0} onClick={()=>window.open(`/?test=1&quizId=${encodeURIComponent(activeQuiz)}`,"_blank","noopener,noreferrer")}>TEST 모드로 열기</button>',
'<button className="ghost" disabled={busy||!activeQuiz||selectedCount===0} onClick={()=>window.open(`/?test=1&quizId=${encodeURIComponent(activeQuiz)}`,"_blank","noopener,noreferrer")}>TEST 모드로 열기</button><button className="ghost" disabled={busy||!activeQuiz} onClick={()=>void resetTestRecords()}>TEST 기록 초기화</button><button className="ghost" disabled={busy||!activeQuiz} onClick={()=>void changeQuizStatus("CLOSE")}>지금 마감</button><button className="ghost" disabled={busy||!activeQuiz} onClick={()=>void changeQuizStatus("DRAFT")}>공개 취소 → DRAFT</button>',"quiz controls");

replace("src/app/operator/page.tsx",
'<small>{p.group_name??"셀 미배정"}</small></label>)',
'<span><small>{p.group_name??"셀 미배정"}</small><button type="button" className="ghost" onClick={e=>{e.preventDefault();void togglePerson(p);}}>{p.active?"비활성":"활성"}</button></span></label>)',"person toggle");
replace("src/app/operator/page.tsx",
'<div className="adminRow" key={g.id}><span>{g.name}</span><small>{g.active?"운영 중":"비활성"}</small></div>)',
'<div className="adminRow" key={g.id}><span>{g.name}</span><span><small>{g.active?"운영 중":"비활성"}</small> <button className="ghost" onClick={()=>void toggleGroup(g)}>{g.active?"비활성":"활성"}</button></span></div>)',"group toggle");

replace("src/app/operator/page.tsx",
'{specialMode==="PASS"&&<><label>PASS 점수<input type="range" min="0" max="100" step="5" value={passScore} onChange={e=>setPassScore(Number(e.target.value))}/><strong>{passScore}점</strong></label><label>재도전<select value={retryMode} onChange={e=>setRetryMode(e.target.value)}><option value="UNTIL_PASS">통과할 때까지</option><option value="NONE">재도전 없음</option><option value="MAX_ATTEMPTS">횟수 제한</option></select></label><label><input type="checkbox" checked={issuePass} onChange={e=>setIssuePass(e.target.checked)}/> PASS 입장권 발급</label></>}',
'{specialMode==="PASS"&&<><label>PASS 점수<input type="range" min="0" max="100" step="5" value={passScore} onChange={e=>setPassScore(Number(e.target.value))}/><strong>{passScore}점</strong></label><label><input type="checkbox" checked={issuePass} onChange={e=>setIssuePass(e.target.checked)}/> PASS 입장권 발급</label><label>PASS 메시지<input value={specialMessage} onChange={e=>setSpecialMessage(e.target.value)} placeholder="축하합니다!"/></label></>}<label>재도전<select value={retryMode} onChange={e=>setRetryMode(e.target.value)}><option value="UNTIL_PASS">통과할 때까지</option><option value="NONE">재도전 없음</option><option value="MAX_ATTEMPTS">횟수 제한</option></select></label>{retryMode==="MAX_ATTEMPTS"&&<label>최대 도전<input type="number" min={1} max={20} value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value))}/></label>}<label>정답 공개<select value={answerRevealMode} onChange={e=>setAnswerRevealMode(e.target.value)}><option value="IMMEDIATE">제출 즉시</option><option value="AFTER_PASS">PASS 후</option><option value="AFTER_END">퀴즈 종료 후</option><option value="AT_TIME">지정 시간</option></select></label>{answerRevealMode==="AT_TIME"&&<label>정답 공개 시간<input type="datetime-local" value={answerRevealAt} onChange={e=>setAnswerRevealAt(e.target.value)}/></label>}',"special options");

const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));pkg.version="1.2.0";fs.writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");
