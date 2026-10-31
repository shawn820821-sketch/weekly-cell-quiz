import fs from "node:fs";
function uniqueReplace(path,before,after){
 const s=fs.readFileSync(path,"utf8");
 const count=s.split(before).length-1;
 if(count!==1)throw new Error("v1.4.21 anchor mismatch "+path+": "+String(before).slice(0,60)+" found "+count);
 fs.writeFileSync(path,s.replace(before,after));
}
const api="src/app/api/admin/import/recommended-commit/route.ts";
uniqueReplace(api,'mode:"NEW",status:"PENDING",created_by:admin.personId,',
                   'mode:"NEW",status:"PREVIEW",created_by:admin.personId,');
uniqueReplace(api,'{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(questions)}',
                   '{method:"POST",body:JSON.stringify(questions)}');
const p="src/app/api/admin/import/recommended-preview/route.ts";
uniqueReplace(p,'import { NextResponse } from "next/server";',
  'import { NextResponse } from "next/server";\nimport * as XLSX from "xlsx";');
uniqueReplace(p,
 'const book=parseRecommendedWorkbook(Buffer.from(await file.arrayBuffer()));',
 'const bytes=Buffer.from(await file.arrayBuffer());\n  const sheets=XLSX.read(bytes,{type:"buffer",bookSheets:true}).SheetNames;\n  if(!sheets.some(n=>/^20\\d{2}-\\d{2}-\\d{2}$/.test(n)))\n   return NextResponse.json({error:"추천출제 v4 형식이 아닙니다.",notRecommendedFile:true},{status:415});\n  const book=parseRecommendedWorkbook(bytes);');
const originalPreview="src/app/api/admin/import/preview/route.ts";
uniqueReplace(originalPreview,
 '  const parsed=parseMonthlyWorkbook(Buffer.from(await file.arrayBuffer()));',
 '  const parsed=parseMonthlyWorkbook(Buffer.from(await file.arrayBuffer()));\n  if(parsed.totalQuestions===0)return NextResponse.json({error:"Excel에서 인식된 문제가 0개입니다. 지원하는 파일 형식을 확인해 주세요."},{status:400});');
const uiPath="src/app/operator/page.tsx";
let ui=fs.readFileSync(uiPath,"utf8");
const unwanted=/<section className="adminPanel importRecommended">[\s\S]*?<\/section>/;
if((ui.match(/<section className="adminPanel importRecommended">/g)||[]).length!==1||!unwanted.test(ui))
 throw new Error("v1.4.21 duplicated panel was not found exactly once");
ui=ui.replace(unwanted,"");
const origStart=' async function previewFile(file:File){';
const origEnd=' async function previewUrl()';
const start=ui.indexOf(origStart);
const end=ui.indexOf(origEnd,start);
if(start<0||end<0||ui.indexOf(origStart,start+1)>=0)throw new Error("v1.4.21 previewFile cannot be uniquely located");
const previewMethod=" async function previewFile(file:File){\n  setBusy(true);setError(\"\");setSuccess(\"\");\n  setPreview(null);setRecommendedFile(null);setRecommendedPreview(null);\n  try{\n   const v4form=new FormData();v4form.append(\"file\",file);\n   const vr=await fetch(\"/api/admin/import/recommended-preview\",{method:\"POST\",body:v4form,cache:\"no-store\"});\n   const vj=await vr.json();\n   if(vr.ok){\n    setRecommendedFile(file);setRecommendedPreview(vj);setImportMode(\"NEW\");\n    if(vj.conflicts?.length)\n     showSuccess(\"Excel v4 확인: \"+vj.totalCandidates+\"개 후보, 추천 \"+vj.totalSelected+\"개. 기존 예약 \"+vj.conflicts.length+\"개와 겹칩니다. 미리보기를 확인한 후 해당 예약만 삭제하세요.\");\n    else\n     showSuccess(\"Excel v4 확인: \"+vj.totalCandidates+\"개 후보, 추천 \"+vj.totalSelected+\"개. 자동예약 가능한 상태입니다.\");\n    return;\n   }\n   if(vr.status!==415||vj.notRecommendedFile!==true)\n    throw new Error(vj.error??\"Excel v4 검증에 실패했습니다.\");\n   const f=new FormData();\n   f.append(\"file\",file);f.append(\"mode\",importMode);\n   f.append(\"replaceImportId\",replaceImportId);f.append(\"monthKey\",monthKey.trim());\n   const r=await fetch(\"/api/admin/import/preview\",{method:\"POST\",body:f});\n   const j=await r.json();\n   if(!r.ok)throw new Error(j.error??\"미리보기 실패\");\n   if(!j.totalQuestions)throw new Error(\"문제를 0개 읽었습니다. Excel 형식과 시트를 확인해 주세요.\");\n   setPreview(j);showSuccess(\"Excel 파일을 읽었습니다. \"+j.totalQuestions+\"개 후보 문제를 확인해주세요.\");\n  }catch(e){setError(e instanceof Error?e.message:\"Excel 미리보기 실패\");}\n  finally{setBusy(false);}\n }\n";
ui=ui.slice(0,start)+previewMethod+ui.slice(end);
const urlpos=ui.indexOf(' async function previewUrl()');
const endpos=ui.indexOf(' async function commitImport()',urlpos);
if(urlpos<0||endpos<0)throw new Error("v1.4.21 previewUrl not found");
const urlfrag=ui.slice(urlpos,endpos);
const urlSuccess='setPreview(j);showSuccess(';
if(!urlfrag.includes(urlSuccess))throw new Error("v1.4.21 previewUrl result anchor missing");
ui=ui.slice(0,urlpos)+urlfrag.replace(urlSuccess,'if(!j.totalQuestions)throw new Error("문제를 0개 읽었습니다. Excel 형식을 확인해 주세요.");setRecommendedPreview(null);setRecommendedFile(null);setPreview(j);showSuccess(')+ui.slice(endpos);
const oldInput='onChange={e=>{const f=e.target.files?.[0];if(f)void previewFile(f);}}';
const newInput='onChange={e=>{const f=e.target.files?.[0];e.currentTarget.value="";if(f)void previewFile(f);}}';
if(ui.split(oldInput).length!==2)throw new Error("v1.4.21 file input not found once");
ui=ui.replace(oldInput,newInput);
const oldTitle='<h1>Excel 문제 불러오기</h1>';
if(ui.split(oldTitle).length!==2)throw new Error("v1.4.21 header not found");
ui=ui.replace(oldTitle,'<h1>Excel 문제 불러오기</h1><p>기존 템플릿과 추천출제(Y) Excel v4 파일을 이곳에서 자동 구분합니다. 추천출제 파일은 월 파일 교체를 선택하지 않아도 됩니다.</p>');
const v4Preview="{recommendedPreview&&<section className=\"adminPanel\">\n <div className=\"adminTitleRow\"><div>\n  <h3>{recommendedPreview.fileName} · 추천 자동선택 미리보기</h3>\n  <p>주차 {recommendedPreview.weeks?.length??0}개 · 후보 {recommendedPreview.totalCandidates}문항 · 추천 {recommendedPreview.totalSelected}문항</p>\n </div></div>\n {(recommendedPreview.weeks??[]).map((w:any)=><div className=\"importWeek\" key={w.sheet}>\n  <strong>{w.title}</strong>\n  <span>{w.sheet} 공개 · {w.closeAt.slice(0,10)} 마감 · 후보 {w.candidateCount}개 / 자동선택 {w.selectedCount}개</span>\n  <small>추천 번호: {(w.selectedNumbers??[]).join(\", \")}</small>\n </div>)}\n {(recommendedPreview.warnings??[]).map((w:string,i:number)=><p key={i}>{w}</p>)}\n {recommendedPreview.conflicts?.length>0?\n  <div>\n   <p><strong>현재 동일 공개일의 기존 예약 {recommendedPreview.conflicts.length}개가 있어 자동등록이 차단됩니다.</strong></p>\n   {recommendedPreview.conflicts.map((q:any)=><p key={q.quizId}>{q.openDate}: {q.title} ({q.status})</p>)}\n   <button type=\"button\" className=\"ghost\" disabled={busy} onClick={()=>setTab(\"quiz\")}>해당 기존 예약 확인·삭제</button>\n   <button type=\"button\" className=\"ghost\" disabled={busy||!recommendedFile}\n    onClick={()=>{if(recommendedFile)void previewFile(recommendedFile);}}>충돌 다시 확인</button>\n  </div>:\n  <button className=\"primary\" type=\"button\" disabled={busy||!recommendedPreview.ready||!recommendedFile}\n    onClick={()=>void commitRecommendedV4()}>추천 10문항 자동선택 + 4주차 자동예약 확정</button>}\n </section>}";
const legacyPreview='{preview&&<section className="adminPanel">';
if(ui.split(legacyPreview).length!==2)throw new Error("v1.4.21 regular preview node not found exactly once");
ui=ui.replace(legacyPreview,v4Preview+legacyPreview);
fs.writeFileSync(uiPath,ui);
const revisedCommit=fs.readFileSync(api,"utf8");
const revisedPreview=fs.readFileSync(p,"utf8");
if(revisedCommit.includes('status:"PENDING"')||revisedCommit.includes('Prefer:"return=minimal"'))
 throw new Error("v1.4.21 invalid Supabase status or empty response parsing");
if(!revisedCommit.includes('status:"PREVIEW"')||!revisedPreview.includes('notRecommendedFile:true'))
 throw new Error("v1.4.21 validated status or file format detection missing");
if(fs.readFileSync(uiPath,"utf8").includes('className="adminPanel importRecommended"'))
 throw new Error("v1.4.21 duplicated import panel remains");
if(!fs.readFileSync(uiPath,"utf8").includes('setRecommendedFile(file);setRecommendedPreview(vj)'))
 throw new Error("v1.4.21 v4 auto recognition missing");
console.log("v1.4.21: DB constraint, POST result and unified Excel UI: 6 guards PASS");
