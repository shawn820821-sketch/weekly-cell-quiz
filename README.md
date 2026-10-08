# Weekly Cell Quiz v1.0.1 QA Fix

# 주간 셀 퀴즈 v0.7

v0.7 adds the monthly content operations layer on top of v0.5.

## Included
- Participant E2E: selection → weekly quiz → server scoring → result/review
- Weekly/monthly result APIs
- Operator 4-digit PIN authentication
- Admin dashboard and question candidate selection
- Fixed/random question selection
- Excel monthly content import + replacement preview
- Original Excel template bundled under `public/templates/`
- Participant/group maintenance + bulk group move
- Leader/Admin role grant + first-login setup code
- Operator PIN change

## Setup
1. Apply Supabase migrations `0001` through `0004` in order.
2. Copy `.env.example` to `.env.local` and set Supabase URL/service key + operator session secret.
3. Run `npm install` (v0.7 adds the `xlsx` package).
4. Run `npm run dev`.
5. Open `/operator` for operator/admin functions.

## Monthly Excel workflow
1. Keep `주간셀퀴즈_문제템플릿_원본.xlsx` untouched.
2. Copy it and name the copy for the month, e.g. `2026-11_주간셀퀴즈.xlsx`.
3. Fill weekly sheets.
4. Admin → Excel → 새 월 파일 불러오기 → Preview → Commit.
5. Admin → 퀴즈·문제 → check only the questions to publish.
6. To update an unlaunched month, choose `기존 월 파일 교체`, select the previous import, upload the revised file, review the diff, then confirm.

OPEN/CLOSED quizzes are protected from file replacement.


## v0.7
Season / Monthly settlement / Special Quiz 운영 기능과 스냅샷 테이블을 추가했습니다. 자세한 내용은 `V07_SEASON_SPECIAL_REPORT.md`를 확인하세요.


## v0.8 participant completion
- 내 기록 / 월별 기록 / 최근 주간 기록 / Special PASS
- 지난 퀴즈 Archive + Practice 진입
- 진행 중 Special Quiz participant surface
- Weekly 공식결과와 Practice/Special 결과 분리
- Special 재도전 정책 + PASS persistence
- Migration: `0006_participant_history_special.sql`

See `V08_PARTICIPANT_REPORT.md`.


## v1.0 additions
- Leader-only participation/status dashboard
- Admin current-week statistics and per-question correctness
- Phone-review HTML distributed separately

## v1.1 deploy-prep additions
- `/api/health` environment readiness endpoint
- `src/lib/env.ts` required-env validation
- `supabase/seed.sql` development seed
- `DEPLOYMENT.md` Supabase + Vercel release checklist
