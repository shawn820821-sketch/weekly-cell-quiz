import type { PlayableQuestion } from "@/domain/types";
type Props = {
  questions: PlayableQuestion[];
  question: PlayableQuestion;
  questionIndex: number;
  answers: Array<number | null>;
  answeredCount: number;
  onBack: () => void;
  onQuestion: (index: number) => void;
  onAnswer: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
};
export function QuizQuestion(props: Props) {
  const { questions, question, questionIndex, answers, answeredCount } = props;
  return <>
    <div className="topbar"><button className="back" onClick={props.onBack}>‹</button><strong>주간 셀 퀴즈</strong><span>{questionIndex + 1}/{questions.length}</span></div>
    <div className="progress"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
    <div className="navigator">{questions.map((item, index) => <button key={item.id} className={`qdot ${answers[index] !== null ? "answered" : ""} ${index === questionIndex ? "current" : ""}`} onClick={() => props.onQuestion(index)}>{index + 1}</button>)}</div>
    <section className="questionScene">
      <div className="eyebrow">{question.type === "OX" ? "O / X" : "4지선다"} · Q{questionIndex + 1}</div>
      <div className="question">{question.text}</div><div className="source">{question.source}</div>
      <div className="choices">{question.choices.map((choice, index) => <button key={choice} className={`choice ${answers[questionIndex] === index ? "selected" : ""}`} onClick={() => props.onAnswer(index)}><span className="choiceIndex">{question.type === "OX" ? choice : index + 1}</span><span>{choice}</span></button>)}</div>
    </section>
    <div className="quizActions"><button className="btn btnSecondary" onClick={props.onPrev} disabled={questionIndex === 0}>← 이전</button><button className="btn btnPrimary" onClick={props.onNext}>{questionIndex === questions.length - 1 ? "마지막" : "다음 →"}</button></div>
    <div className="submitArea"><button className="btn btnGhost full" onClick={props.onSubmit}>제출하기 · {answeredCount}/{questions.length} 답변</button></div>
  </>;
}
