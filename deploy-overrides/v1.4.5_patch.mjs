import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8")}
function write(path,s){fs.writeFileSync(path,s)}
function must(ok,msg){if(!ok)throw new Error(msg)}

// v1.4.5
{
  const path="package.json";
  let s=read(path);
  if(s.includes('"version": "1.4.4"')) s=s.replace('"version": "1.4.4"','"version": "1.4.5"');
  write(path,s);
}

// Excel: keep the existing weekly-cycle derivation, but also accept tabs such as "11월 1주차".
{
  const path="src/server/excelImport.ts";
  let s=read(path);
  const beforeSpecial='wb.SheetNames.filter(n=>/^\\d+주차$/.test(n)||n==="스페셜")';
  const beforePlain='wb.SheetNames.filter(n=>/^\\d+주차$/.test(n))';
  const after='wb.SheetNames.filter(n=>/^(?:\\d{1,2}월\\s*)?\\d+주차$/.test(n)||n==="스페셜")';
  if(s.includes(beforeSpecial)) s=s.replace(beforeSpecial,after);
  else if(s.includes(beforePlain)) s=s.replace(beforePlain,after);
  must(s.includes('(?:\\d{1,2}월\\s*)?\\d+주차'),"v1.4.5: month-prefixed week sheet filter was not installed");
  write(path,s);
}

// Draft question deletion API.
{
  const path="src/app/api/admin/questions/route.ts";
  let s=read(path);
  if(!s.includes("export async function DELETE(request: Request)")){
    s+=`

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { questionId?: string; quizId?: string };
    if (!body.questionId || !body.quizId) return NextResponse.json({ error: "삭제할 문제 정보가 필요합니다." }, { status: 400 });

    const quizzes = await supabaseRest<Array<{id:string;status:string;selection_mode:string;random_question_count:number|null}>>(
      \`quizzes?id=eq.\${body.quizId}&select=id,status,selection_mode,random_question_count\`
    );
    const quiz = quizzes[0];
    if (!quiz) return NextResponse.json({ error: "퀴즈를 찾지 못했습니다." }, { status: 404 });
    if (quiz.status !== "DRAFT") return NextResponse.json({ error: "DRAFT 상태의 퀴즈 문제만 삭제할 수 있습니다." }, { status: 409 });

    await supabaseRest(\`questions?id=eq.\${body.questionId}&quiz_id=eq.\${body.quizId}\`, { method: "DELETE" });

    const remaining = await supabaseRest<Array<{id:string}>>(
      \`questions?quiz_id=eq.\${body.quizId}&selected=eq.true&select=id\`
    );
    const selectedCount = remaining.length;
    const nextRandom = quiz.selection_mode === "RANDOM"
      ? Math.min(Number(quiz.random_question_count ?? selectedCount), selectedCount)
      : null;

    await supabaseRest(\`quizzes?id=eq.\${body.quizId}\`, {
      method: "PATCH",
      body: JSON.stringify({
        published_question_count: quiz.selection_mode === "RANDOM" ? nextRandom : selectedCount,
        random_question_count: nextRandom
      })
    });

    return NextResponse.json({ ok: true, selectedCount });
  } catch (error) {
    const m = error instanceof Error ? error.message : "문제 삭제 실패";
    return NextResponse.json({ error: m }, { status: m === "ADMIN_REQUIRED" ? 403 : 500 });
  }
}
`;
  }
  must(s.includes("export async function DELETE(request: Request)"),"v1.4.5: question DELETE API was not installed");
  write(path,s);
}

// Admin UI: add a delete action to each candidate question.
{
  const path="src/app/operator/page.tsx";
  let s=read(path);

  if(!s.includes("async function deleteQuestion(q:Question)")){
    const marker=" async function togglePerson(p:Person)";
    must(s.includes(marker),"v1.4.5: operator function insertion point not found");
    const fn=` async function deleteQuestion(q:Question){if(!activeQuiz||!confirm(\`이 문제를 후보 목록에서 완전히 삭제할까요?\\n\\n\${q.prompt}\`))return;setBusy(true);setError("");try{await jsonFetch("/api/admin/questions",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({questionId:q.id,quizId:activeQuiz})});await loadQuestions(activeQuiz);await loadAdmin();showSuccess("문제를 삭제했습니다.");}catch(e){setError(e instanceof Error?e.message:"문제 삭제 실패");}finally{setBusy(false);}}\n`;
    s=s.replace(marker,fn+marker);
  }

  if(!s.includes("void deleteQuestion(q)")){
    const candidates=[
      '<span><strong>{q.prompt}</strong><small>{q.question_type} · {q.difficulty??"MEDIUM"}</small></span></label>',
      '<span><strong>{q.prompt}</strong><small>{q.question_type} · {q.difficulty??"MEDIUM"}{q.hint?" · 힌트":""}</small></span></label>'
    ];
    let changed=false;
    for(const old of candidates){
      if(s.includes(old)){
        const next=old.replace('</label>','<button type="button" className="ghost" disabled={busy||quizzes.find(x=>x.id===activeQuiz)?.status!=="DRAFT"} onClick={e=>{e.preventDefault();e.stopPropagation();void deleteQuestion(q)}}>삭제</button></label>');
        s=s.replace(old,next); changed=true; break;
      }
    }
    must(changed,"v1.4.5: candidate delete button insertion point not found");
  }

  must(s.includes("async function deleteQuestion(q:Question)")&&s.includes("void deleteQuestion(q)"),"v1.4.5: delete UI was not installed");
  write(path,s);
}
