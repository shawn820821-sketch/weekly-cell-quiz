# v1.0.1 QA Fix Report

## Fixed P0
- Special answer review now obeys IMMEDIATE / AFTER_PASS / AFTER_END / AT_TIME server-side.
- Weekly and Monthly rankings include eligible nonparticipants at the bottom with score/rank shown as “–”.
- Historical ranking lookup no longer filters people by current active status; eligibility uses historical membership date.
- Result verse is no longer hardcoded. Quiz-specific verse pool is preferred, with common verse pool fallback.
- Weekly Intro uses published question count/random count instead of showing 0 before session start.
- Participant Settings screen and Home navigation now include Settings, user change, operator mode, help/version.

## Fixed P1
- Weekly/Monthly result payloads expose progress/final state labels.
- Monthly settlement cannot be silently run again after FINAL.
- Monthly period end date is validated as that calendar month’s last Sunday.
- Admin role revoke endpoint added with last-active-Admin protection.
- Operator permission screen can revoke Leader/Admin roles.
- package version / README updated to v1.0.1 QA Fix.

## Validation
- TypeScript compiler invoked. No parser/syntax diagnostics were observed.
- Full type/build verification is blocked in this workspace because project dependencies (Next.js, React, Node typings, XLSX) are not installed. Run `npm install && npm run typecheck && npm run build` in the deployment environment.

## Deferred after v1
- Google Sheets direct sync
- Relay Quiz
- TeamMix integration
- random reward engine
- Year Result
- advanced analytics
- pass/ticket consume workflow
