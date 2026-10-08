import type { ReviewQuestion, QuizResult } from "@/domain/types";
export function AnswerReview({ questions, answers, result, onBack, onHome }: { questions: ReviewQuestion[]; answers: Array<number | null>; result: QuizResult; onBack: () => void; onHome: () => void }) {
  return <>
    <div className="topbar"><button className="back" onClick={onBack}>‹</button><strong>정답과 말씀 다시 보기</strong><span>{result.score}점</span></div>
    <div className="review">{questions.map((question, index) => {
      const answer = answers[index]; const good = answer === question.answerIndex;
      return <article className="reviewItem" key={question.id}><div className="eyebrow">Q{index + 1} · {question.source}</div><div className="reviewQ">{question.text}</div><div className={`answerLine ${good ? "good" : "bad"}`}>{good ? "✓ 내 답 · 정답" : "✕ 내 답"}: {answer === null ? "미답변" : question.choices[answer]}</div>{!good && <div className="answerLine good">✓ 정답: {question.choices[question.answerIndex]}</div>}<div className="explain"><strong>말씀 다시 보기</strong><br />{question.explanation}</div></article>;
    })}</div>
    <div className="bottomSpace" /><button className="btn btnPrimary full" onClick={onHome}>홈으로</button>
  </>;
}
