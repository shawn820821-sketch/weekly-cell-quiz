# v1.0 Leader / Statistics Report

- Leader-only dashboard is now separated from Admin scope.
- Leader sees only the target cell assigned by active LEADER role.
- Current-week participation, missing members, official weekly scores, current monthly cumulative scores and cell average are available.
- Admin statistics endpoint returns current weekly participation, average score and per-question correctness rate.
- Participant/private answer details are not exposed to ordinary participants; operator statistics remain operator-only.
- Phone preview includes Leader dashboard and Admin statistics mock screens for quick mobile review.

## UI scope
- Operator login auto-routes by active role.
- Leader-only session never calls Admin endpoints.
- Leader page has no cross-cell selector.
- Admin gets a Statistics tab with current quiz correctness rates.
