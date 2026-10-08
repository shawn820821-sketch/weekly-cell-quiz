# Weekly Cell Quiz v0.6 — Operations Report

## Added
- Monthly Excel template bundled at `public/templates/주간셀퀴즈_문제템플릿_원본.xlsx`
- Excel preview parser for `사용안내 / 작성예시 / 1주차~5주차` workbook convention
- New monthly import and existing-import replacement modes
- Replacement diff preview (old/new counts + added/removed samples)
- Replacement safety: OPEN/CLOSED quizzes cannot be replaced
- Imported rows become unselected question candidates; Admin checks final questions later
- Bulk participant group move with effective date and historical membership closing
- Leader/Admin role grant UI and API
- First-time operator gets 6-digit one-time setup code; existing operator keeps existing 4-digit PIN
- Operator can change own 4-digit PIN
- Import history list for selecting a month/file to replace

## Excel rules
- Original template remains unchanged; duplicate it each month.
- Sheets: 사용안내, 작성예시, 1주차, 2주차, 3주차, 4주차, 5주차.
- Question types: MCQ, OX.
- MCQ key: A/B/C/D. OX key: O/X.
- Difficulty: EASY/MEDIUM/HARD.
- Candidate count <= 10 produces a recommendation warning, not a hard error.
- Structural errors block commit.

## Deferred
- Google Sheets direct sync
- Role revoke / admin transfer wizard / last-admin protection UI
- Advanced Excel row-level diff beyond prompt-set comparison
- Special reward inventory
