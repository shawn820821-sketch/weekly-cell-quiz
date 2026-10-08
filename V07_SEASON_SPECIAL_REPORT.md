# Weekly Cell Quiz v0.7 — Season / Monthly / Special

## Added
- Custom Season create + active switch model
- Monthly Period create with explicit end date (last Sunday operational rule)
- Monthly settlement snapshot: total score, participation count, competition rank
- Monthly winner archive rows, including joint winners
- Special Quiz settings: NORMAL/RANKING/PASS
- PASS score 0–100 in 5-point steps, default 80
- Retry modes and answer release policy fields
- Digital pass issuance flag
- Operator UI tabs: Season / Monthly settlement / Special

## Settlement rules
- Only OFFICIAL Weekly submissions are included.
- PRACTICE and TEST are excluded.
- Results are grouped by submission-time group snapshot.
- Ties use competition ranking (1,1,3) and winner rows support joint winners.
- Settlement rewrites the period snapshot then locks monthly_periods.closed=true.

## Deferred
- Random reward details
- pass ticket used/scan operation
- annual boundary / Year Result
- relay quiz
- Google Sheets direct sync
