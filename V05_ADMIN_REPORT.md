# v0.5 Admin / Operator Report

## Added
- Operator list endpoint (Leader/Admin only)
- 4-digit numeric PIN login
- 5 failed attempts -> 5 minute lock
- 24-hour one-time 6-digit setup code issued by Admin
- First operator entry: setup code -> user chooses own 4-digit PIN
- HttpOnly signed operator session cookie (8h)
- Admin Dashboard API + screen
- Quiz list/create API
- Candidate question list/create API
- Candidate checkbox selection save
- FIXED and RANDOM publishing modes
- RANDOM count validation against selected candidate count
- People list/create/update API
- Group list/create API
- Basic participant/group Admin screen
- Operator audit/setup tables migration

## Security boundary
Participant identity remains frictionless and is not an operator credential. All Admin endpoints require a signed operator session with active ADMIN role. PIN hashes use scrypt with a random salt. The service-role key remains server-only.

## Deliberately not in v0.5
- Excel import/file replacement
- Membership bulk move UI
- Leader-only scoped dashboard
- Role assignment UI (setup-code endpoint is ready)
- Special editor
- Advanced analytics

These are the next operator increments; core participant flow remains unchanged.
