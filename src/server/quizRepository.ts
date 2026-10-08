import { supabaseRest } from "@/lib/supabase/rest";

type QuizRow = {
  id: string;
  quiz_type: "WEEKLY" | "SPECIAL";
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED";
  open_at: string | null;
  close_at: string | null;
  selection_mode: "FIXED" | "RANDOM";
  random_question_count: number | null;
};

type QuestionRow = {
  id: string;
  sort_order: number;
  question_type: "MCQ" | "OX";
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  source_label: string | null;
  target_group_id: string | null;
};

type SessionRow = {
  id: string;
  quiz_id: string;
  person_id: string;
  mode: "OFFICIAL" | "PRACTICE" | "TEST";
  group_id_snapshot: string | null;
  assigned_question_ids: string[];
  attempt_no: number;
};

export async function getQuiz(quizId: string): Promise<QuizRow> {
  const rows = await supabaseRest<QuizRow[]>(`quizzes?id=eq.${quizId}&select=*`);
  if (!rows[0]) throw new Error("Quiz not found.");
  return rows[0];
}

export async function getCurrentGroupId(personId: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await supabaseRest<Array<{ group_id: string }>>(
    `group_memberships?person_id=eq.${personId}&starts_on=lte.${today}&or=(ends_on.is.null,ends_on.gte.${today})&order=starts_on.desc&limit=1&select=group_id`,
  );
  return rows[0]?.group_id ?? null;
}

export async function getSelectedQuestions(quizId: string, groupId: string | null): Promise<QuestionRow[]> {
  const rows = await supabaseRest<QuestionRow[]>(
    `questions?quiz_id=eq.${quizId}&selected=eq.true&order=sort_order.asc&select=id,sort_order,question_type,prompt,choices,correct_index,explanation,source_label,target_group_id`,
  );
  return rows.filter((row) => row.target_group_id === null || row.target_group_id === groupId);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function assignQuestionIds(quiz: QuizRow, questions: QuestionRow[]): string[] {
  if (!questions.length) throw new Error("Quiz has no selected questions.");
  if (quiz.selection_mode === "FIXED") return questions.map((q) => q.id);
  const count = quiz.random_question_count ?? 0;
  if (count <= 0 || count > questions.length) throw new Error("Invalid random question count.");
  return shuffled(questions).slice(0, count).map((q) => q.id);
}

export function assertOfficialWindow(quiz: QuizRow, now = new Date()) {
  if (!quiz.open_at || !quiz.close_at) throw new Error("Quiz schedule is incomplete.");
  if (now < new Date(quiz.open_at)) throw new Error("Quiz is not open yet.");
  if (now > new Date(quiz.close_at)) throw new Error("Quiz is closed for new official sessions.");
}

export async function findOfficialSession(quizId: string, personId: string): Promise<SessionRow | null> {
  const rows = await supabaseRest<SessionRow[]>(
    `quiz_sessions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&limit=1&select=*`,
  );
  return rows[0] ?? null;
}

export async function findUnfinishedOfficialSession(quizId: string, personId: string): Promise<SessionRow | null> {
  const rows = await supabaseRest<SessionRow[]>(
    `quiz_sessions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&completed_at=is.null&order=attempt_no.desc&limit=1&select=*`,
  );
  return rows[0] ?? null;
}

export async function createSession(input: Omit<SessionRow, "id">): Promise<SessionRow> {
  const rows = await supabaseRest<SessionRow[]>("quiz_sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!rows[0]) throw new Error("Session creation failed.");
  return rows[0];
}

export async function getSession(sessionId: string): Promise<SessionRow> {
  const rows = await supabaseRest<SessionRow[]>(`quiz_sessions?id=eq.${sessionId}&select=*`);
  if (!rows[0]) throw new Error("Session not found.");
  return rows[0];
}

export async function getQuestionsByIds(ids: string[]): Promise<QuestionRow[]> {
  if (!ids.length) return [];
  const encoded = ids.join(",");
  return supabaseRest<QuestionRow[]>(`questions?id=in.(${encoded})&select=id,sort_order,question_type,prompt,choices,correct_index,explanation,source_label,target_group_id`);
}

type StoredSubmission = {
  id: string;
  correct_count: number;
  question_count: number;
  score: number;
  submitted_at: string;
};

export async function findSubmissionForSession(sessionId: string): Promise<StoredSubmission | null> {
  const rows = await supabaseRest<StoredSubmission[]>(
    `submissions?session_id=eq.${sessionId}&limit=1&select=id,correct_count,question_count,score,submitted_at`,
  );
  return rows[0] ?? null;
}

export async function saveSubmission(input: {
  session: SessionRow;
  correctCount: number;
  questionCount: number;
  score: number;
  answers: Array<{ question_id: string; selected_index: number | null; is_correct: boolean }>;
}): Promise<StoredSubmission> {
  const submissionRows = await supabaseRest<Array<StoredSubmission & { id: string }>>("submissions", {
    method: "POST",
    body: JSON.stringify({
      session_id: input.session.id,
      quiz_id: input.session.quiz_id,
      person_id: input.session.person_id,
      mode: input.session.mode,
      group_id_snapshot: input.session.group_id_snapshot,
      correct_count: input.correctCount,
      question_count: input.questionCount,
      score: input.score,
      attempt_no: input.session.attempt_no ?? 1,
    }),
  });
  const submission = submissionRows[0];
  if (!submission) throw new Error("Submission creation failed.");

  if (input.answers.length) {
    await supabaseRest("answers", {
      method: "POST",
      body: JSON.stringify(
        input.answers.map((answer) => ({ ...answer, submission_id: submission.id })),
      ),
    });
  }

  await supabaseRest(`quiz_sessions?id=eq.${input.session.id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed_at: new Date().toISOString() }),
  });

  return submission;
}


type SpecialSetting = { quiz_id:string; special_mode:"NORMAL"|"RANKING"|"PASS"; pass_score:number; retry_mode:"NONE"|"MAX_ATTEMPTS"|"UNTIL_PASS"; max_attempts:number|null; answer_reveal_mode:string; answer_reveal_at:string|null; issue_pass:boolean; custom_pass_message:string|null };
export async function getSpecialSetting(quizId:string):Promise<SpecialSetting|null>{ const rows=await supabaseRest<SpecialSetting[]>(`special_quiz_settings?quiz_id=eq.${quizId}&limit=1&select=*`); return rows[0]??null; }
export async function getOfficialAttemptCount(quizId:string,personId:string):Promise<number>{ const rows=await supabaseRest<Array<{id:string}>>(`submissions?quiz_id=eq.${quizId}&person_id=eq.${personId}&mode=eq.OFFICIAL&select=id`); return rows.length; }
export async function hasSpecialPass(quizId:string,personId:string):Promise<boolean>{ const rows=await supabaseRest<Array<{id:string}>>(`special_pass_records?quiz_id=eq.${quizId}&person_id=eq.${personId}&limit=1&select=id`); return Boolean(rows[0]); }
export async function saveSpecialPass(input:{quizId:string;personId:string;submissionId:string;score:number;issuePass:boolean}){ if(await hasSpecialPass(input.quizId,input.personId)) return; await supabaseRest("special_pass_records",{method:"POST",body:JSON.stringify({quiz_id:input.quizId,person_id:input.personId,submission_id:input.submissionId,score:input.score,pass_issued:input.issuePass})}); }
