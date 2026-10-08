# Weekly Cell Quiz v0.8 — Participant Records / Archive / Special

## Added
- My Stats API + participant screen
- Archive API + participant archive screen
- Active Special API + Special participant screen
- HOME quick navigation to My Stats / Archive / Special
- Weekly official result isolated from Practice/Special current result
- Archived quiz Practice start path
- Special official attempt flow and PASS persistence
- Special retry policy enforcement (NONE / MAX_ATTEMPTS / UNTIL_PASS)
- Special PASS record and pass issuance state

## Schema
Migration `0006_participant_history_special.sql` adds `attempt_no` to sessions/submissions and replaces one-off official unique indexes with `(quiz_id, person_id, attempt_no)` uniqueness. Weekly always uses attempt 1 at the server layer; Special may increment attempts according to policy.

## Important invariants
- Practice never modifies Weekly official result or monthly ranking.
- Special never overwrites the Weekly result shown on HOME.
- Special PASS is persistent and cannot be rerolled by reopening the screen.
- Participant archive reads official records only; TEST is excluded.
- Historical group snapshot remains attached to old records.

## Verification
- Required v0.8 files: PASS
- ZIP integrity: PASS after packaging
- `tsc --noEmit`: cannot complete in this environment because Next.js/React/Node/XLSX packages and type declarations are not installed. The same dependency limitation existed in prior versions. Run `npm install && npm run typecheck && npm run build` in the actual development environment.
