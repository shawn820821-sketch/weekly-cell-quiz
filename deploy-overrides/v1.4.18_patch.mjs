import fs from "node:fs";
// Click anywhere on a candidate except its interactive checkbox, delete button or explanation.
{
 const path="src/app/operator/page.tsx";
 let s=fs.readFileSync(path,"utf8");
 const before="<div key={q.id} className={q.selected?\"candidate selected\":\"candidate\"}>";
 const after="<div key={q.id} className={q.selected?\"candidate selected\":\"candidate\"} onClick={e=>{if(busy)return;const target=e.target as HTMLElement;if(target.closest(\"input,button,details,summary,a,select,textarea\"))return;setQuestions(prev=>prev.map(item=>item.id===q.id?{...item,selected:!item.selected}:item));}}>";
 if(!s.includes(before)||s.split(before).length!==2)throw new Error("CANDIDATE_CARD_ANCHOR_MISSING_OR_AMBIGUOUS");
 s=s.replace(before,after);
 if(!s.includes('target.closest("input,button,details,summary,a,select,textarea")'))throw new Error("NESTED_ACTION_GUARD_MISSING");
 fs.writeFileSync(path,s);
}
fs.appendFileSync("src/app/globals.css","\n/* v1.4.18: large selection targets on PC and mobile */\n.candidate{cursor:pointer;transition:border-color .15s,background-color .15s}\n.candidate:hover{border-color:#93a37f}\n.candidate:focus-within{outline:2px solid #8da478;outline-offset:2px}\n.candidate>input[type=\"checkbox\"]{width:26px;height:26px;min-width:26px;min-height:26px;margin:0;accent-color:#526f42;cursor:pointer}\n.candidateContent,.candidateNo,.candidateChoice{cursor:pointer}\n.candidateExplanation,.candidateExplanation *,.candidateDelete{cursor:auto}\n.candidateExplanation summary{cursor:pointer}\n");
console.log("v1.4.18 full-card selection and large checkbox installed");
