import type { Question, QuizResult } from "./types";

export function scoreQuiz(questions: Question[], answers: Array<number | null>): QuizResult {
  const total = questions.length;
  if (total === 0) throw new Error("Cannot score an empty quiz.");
  const correct = questions.reduce((sum, question, index) => {
    return sum + (answers[index] === question.answerIndex ? 1 : 0);
  }, 0);

  return {
    correct,
    total,
    score: Math.round((correct / total) * 100),
    submittedAt: new Date().toISOString(),
  };
}
