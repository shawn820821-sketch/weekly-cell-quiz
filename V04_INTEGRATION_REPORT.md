# v0.4 Integration Report

## Goal
Mock E2E를 실제 Supabase API 경로로 전환하고 Weekly/Monthly result를 붙인다.

## Implemented
- Participant bootstrap from DB
- Official quiz session start/resume
- Frozen random question set
- Correct answer secrecy before submit
- Server scoring and idempotent submit
- Review data returned only after submit
- Weekly own-cell ranking
- Monthly cumulative own-cell ranking
- Tie ranking: competition rank, 가나다순 display for equal scores
- Local answer resume
- Mock fallback switch for UI development

## Important invariants
- Client never sends or decides official score.
- Client does not receive correct answer keys before submission.
- Official session uniqueness remains enforced in DB.
- Practice/Test are excluded from ranking endpoints.
- Ranking is scoped to the submission-time group snapshot.

## Not yet included
- Operator PIN authentication
- Admin dashboard CRUD
- Excel import/replacement
- Question candidate checkbox workflow
- Special PASS/ticket persistence
- Monthly final snapshot/lock job
