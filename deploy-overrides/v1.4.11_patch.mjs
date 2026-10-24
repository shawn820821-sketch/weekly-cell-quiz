import fs from "node:fs";
// Official 4th-week submissions remain untouched; only monthly ranking queries skip excluded quizzes.
for (const path of ["src/server/resultRepository.ts","src/app/api/admin/monthly-ranking/route.ts"]) {
  let s=fs.readFileSync(path,"utf8");
  const old="quizzes?quiz_type=eq.WEEKLY&content_month_key=eq."+ "${month}" + "&select=id";
  const next="quizzes?quiz_type=eq.WEEKLY&content_month_key=eq."+ "${month}" + "&count_in_monthly=eq.true&select=id";
  if(!s.includes(old))throw new Error("MONTHLY_FILTER_MISSING: "+path);
  fs.writeFileSync(path,s.replace(old,next));
}
{
  const path="src/components/HomeScreen.tsx";
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes('import { useState } from "react";'))s='import { useState } from "react";\n'+s;
  const leader='const leader=monthlyRanking?.ranking?.find(r=>r.rank===1);';
  if(!s.includes(leader))throw new Error("HOME_LEADER_HOOK_MISSING");
  s=s.replace(leader,leader+'const [closedNoticeOpen,setClosedNoticeOpen]=useState(false);');
  const tinyNotice=/\{!quiz\.id&&<p className="subtle">[\s\S]*?<\/p>\}/;
  if(!tinyNotice.test(s))throw new Error("SMALL_NOTICE_NOT_FOUND");
  s=s.replace(tinyNotice,"");
  const button=/<button className="btn btnPrimary full" disabled=\{[^}]+\} onClick=\{onStart\}>/;
  if(!button.test(s))throw new Error("CLOSED_BUTTON_NOT_FOUND");
  s=s.replace(button,'<button type="button" className="btn btnPrimary full" onClick={quiz.id?onStart:()=>setClosedNoticeOpen(true)}>');
  if(!s.includes('"다음 퀴즈 공개 전"'))throw new Error("CLOSED_BUTTON_LABEL_NOT_FOUND");
  s=s.replace('"다음 퀴즈 공개 전"','"마감됨 · 다음 공개 시간 확인 →"');
  const i=s.lastIndexOf('</>}');
  if(i<0)throw new Error("HOME_CLOSE_NOT_FOUND");
  s=s.slice(0,i)+"{closedNoticeOpen&&<div className=\"modalWrap\" role=\"dialog\" aria-modal=\"true\" aria-label=\"퀴즈 마감 및 다음 공개 안내\">\n <div className=\"modal\">\n <h3>이번 주 퀴즈가 마감되었어요</h3>\n <p className=\"subtle\" style={{fontSize:17,fontWeight:700,lineHeight:1.7,margin:\"14px 0 24px\"}}>\n {nextQuiz?.openAt?new Intl.DateTimeFormat(\"ko-KR\",{timeZone:\"Asia/Seoul\",month:\"long\",day:\"numeric\",weekday:\"long\",hour:\"2-digit\",minute:\"2-digit\",hourCycle:\"h23\"}).format(new Date(nextQuiz.openAt))+\"부터 다시 참여해 주세요.\":\"현재 참여할 수 있는 퀴즈가 없어요. 다음 공개 일정을 확인해 주세요.\"}\n </p>\n <button type=\"button\" className=\"btn btnPrimary full\" onClick={()=>setClosedNoticeOpen(false)}>확인</button>\n </div></div>}"+s.slice(i);
  if(!s.includes('role="dialog"'))throw new Error("DIALOG_INSERT_FAILED");
  fs.writeFileSync(path,s);
}
console.log("v1.4.11 monthly exclusion and closure dialog installed");
