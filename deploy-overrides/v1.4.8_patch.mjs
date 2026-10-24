import fs from "node:fs";

// Applied after v1.4.4_patch.mjs. Preserve the original archive and quiz UI.
{
  const path="src/app/api/quiz/start/route.ts";
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes('import { supabaseRest }'))s='import { supabaseRest } from "@/lib/supabase/rest";\n'+s;
  const anchor='if(!session){ const candidates=await getSelectedQuestions(';
  if(!s.includes(anchor))throw new Error("PRACTICE_RESUME_ANCHOR_MISSING");
  const resume='if(mode==="PRACTICE"){const unfinished=await supabaseRest<Array<{id:string;quiz_id:string;person_id:string;mode:string;group_id_snapshot:string|null;assigned_question_ids:string[];attempt_no:number}>>("quiz_sessions?quiz_id=eq."+body.quizId+"&person_id=eq."+body.personId+"&mode=eq.PRACTICE&completed_at=is.null&order=started_at.desc&limit=1&select=*");if(unfinished[0]){session=unfinished[0];resumed=true;}}\n    ';
  s=s.replace(anchor,resume+anchor);
  fs.writeFileSync(path,s);
}

{
  const path="src/state/useQuizApp.ts";
  let s=fs.readFileSync(path,"utf8");
  const start=s.indexOf("function goHome()");
  const end=s.indexOf("function resetPractice()",start);
  if(start<0||end<0)throw new Error("ARCHIVE_BACK_ANCHOR_MISSING");
  const chunk=s.slice(start,end);
  const changed=chunk.replace(/setScreen\(([^;]+)\);/,(_,destination)=>'setScreen(playKind==="PRACTICE"&&(screen==="quiz"||screen==="intro")?"archive":('+destination+'));');
  if(chunk===changed)throw new Error("ARCHIVE_BACK_SCREEN_MISSING");
  s=s.slice(0,start)+changed+s.slice(end);
  fs.writeFileSync(path,s);
}
console.log("v1.4.8 practice resume patch applied");
