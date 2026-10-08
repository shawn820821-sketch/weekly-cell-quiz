import type { Question } from "./types";

export function pickRandomQuestions(pool: Question[], count: number, random = Math.random): Question[] {
  if (count <= 0) return [];
  if (count >= pool.length) return [...pool];
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
