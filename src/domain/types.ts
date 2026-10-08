export type GroupId = string;
export type PersonId = string;
export type QuestionId = string;

export type Person = { id: PersonId; name: string; leader?: boolean; active?: boolean };
export type Group = { id: GroupId; name: string; members: Person[] };
export type QuestionType = "MCQ" | "OX";

export type PlayableQuestion = { id: QuestionId; type: QuestionType; text: string; source: string; choices: string[] };
export type ReviewQuestion = PlayableQuestion & { answerIndex: number; explanation: string };
export type Question = ReviewQuestion;

export type QuizDefinition = {
  id: string; title: string; subtitle: string; lifeDateRange: string; bibleRange: string;
  questions: PlayableQuestion[]; publishedQuestionCount?: number;
};

export type ResultVerse = { text: string; reference: string } | null;
export type QuizResult = { correct: number; total: number; score: number; submittedAt: string; verse?: ResultVerse };
export type WeeklyRankRow = { personId: string; name: string; score: number | null; rank: number | null; participated?: boolean };
export type RankingPayload = { ranking: WeeklyRankRow[]; me: WeeklyRankRow | null; final?: boolean; label?: string };
export type Screen = "select" | "home" | "intro" | "quiz" | "result" | "review" | "weekly-result" | "monthly-result" | "stats" | "archive" | "special" | "settings";
