# v0.2 Architecture

## Goal
Move the validated v0.1 participant E2E loop into a Next.js/TypeScript shape without changing product rules.

## Layers
- `src/domain`: pure types + score/random selection functions. No React, no browser, no DB.
- `src/data`: temporary mock source. This layer is replaced by Supabase queries later.
- `src/state`: client UX state and local resume persistence.
- `src/components`: renderable screens/components.
- `src/app`: routing/composition.

## Important invariants
- Regular quiz has no timer.
- Group tab + visible member list, no dropdown.
- Score is server-authoritative later; current local scorer mirrors the rule for prototype only.
- `round(correct / total * 100)` for Weekly and Special.
- Official/Practice/Test separation is NOT implemented yet; this is next with Supabase.
- Random question selection helper exists, but default flow remains fixed questions.
- When random mode is implemented with DB, selected question IDs must be frozen per session.

## Next task
Supabase schema + server-side official submission contract:
Person, Group, GroupMembership, Season, Quiz, Question, QuizSession, Submission, Answer.
