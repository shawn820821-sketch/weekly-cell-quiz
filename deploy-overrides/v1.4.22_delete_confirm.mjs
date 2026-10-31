import fs from "node:fs";
const path="src/app/operator/page.tsx";
let src=fs.readFileSync(path,"utf8");
const before='  const confirmed=window.prompt("실수로 삭제하지 않도록 퀴즈 제목을 그대로 입력해 주세요.\\n"+selectedQuiz.title,"");\n  if(confirmed!==selectedQuiz.title){if(confirmed!==null)setError("퀴즈 제목이 일치하지 않아 삭제하지 않았습니다.");return;}\n';
const count=src.split(before).length-1;
if(count!==1)throw new Error("v1.4.22: delete prompt anchor expected once, found "+count);
src=src.replace(before,"");
if(src.includes("window.prompt("))throw new Error("v1.4.22: title prompt still present");
if(!src.includes('if(!window.confirm("이 주차와 여기에 들어 있는 모든 문제 후보를 삭제할까요?'))
 throw new Error("v1.4.22: confirmation dialog missing");
if(!src.includes('body:JSON.stringify({quizId:selectedQuiz.id,confirmTitle:selectedQuiz.title})'))
 throw new Error("v1.4.22: server quiz title identity check unexpectedly changed");
fs.writeFileSync(path,src);
console.log("v1.4.22: one confirmation dialog for deleting scheduled/draft quiz; no title typing; server safety unchanged");
