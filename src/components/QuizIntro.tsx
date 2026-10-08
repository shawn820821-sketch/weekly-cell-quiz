import type { QuizDefinition } from "@/domain/types";
export function QuizIntro({ quiz, onBack, onStart }: { quiz: QuizDefinition; onBack: () => void; onStart: () => void }) {
  const count = quiz.publishedQuestionCount ?? quiz.questions.length;
  return <><div className="topbar"><button className="back" onClick={onBack}>‹</button><strong>주간 셀 퀴즈</strong><span /></div>
  <section className="questionScene introScene"><div><div className="eyebrow">{quiz.subtitle}</div><h1 className="question introTitle">{quiz.title}</h1><p className="source">{quiz.lifeDateRange}<br />{quiz.bibleRange}</p></div>
  <div className="card translucent"><p><strong>{count || "–"}문제 · 100점 만점</strong></p><p className="subtle">토요일까지 참여할 수 있어요.<br/>제출 후 공개 가능한 정답과 설명을 볼 수 있어요.</p></div>
  <button className="btn btnPrimary full" onClick={onStart}>시작하기 →</button></section></>;
}
