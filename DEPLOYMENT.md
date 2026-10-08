# Weekly Cell Quiz — Deployment Checklist

## 1. Supabase
1. Create one Supabase project.
2. Open SQL Editor.
3. Run migrations in order: `0001_core.sql` → `0007_qa_fix_pack.sql`.
4. For development only, optionally run `supabase/seed.sql`.
5. Copy Project URL and service-role key.

## 2. Environment
Copy `.env.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
OPERATOR_SESSION_SECRET=USE_A_LONG_RANDOM_SECRET
```

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed to client code or committed to git.

Generate a session secret locally, for example:

```bash
openssl rand -base64 48
```

## 3. Install and verify

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Open `/api/health`. It should return HTTP 200 and `"ok": true`.

## 4. First operator
1. Seed or create the first ADMIN role.
2. Use the one-time setup-code flow to create the operator's own 4-digit PIN.
3. Confirm admin login.
4. Create the active Season and cells/participants.
5. Import the monthly Excel copy and select published questions.
6. Use TEST MODE before scheduling the first Weekly Quiz.

## 5. Vercel
1. Import the repository/project into Vercel.
2. Add the same three environment variables to Production/Preview as needed.
3. Deploy.
4. Verify `/api/health`, participant flow, operator login, official submission, practice, monthly results.

## 6. Release gate
Do not open to real participants until all pass:
- migrations applied without error
- `/api/health` = 200
- first admin PIN setup works
- participant select/home works on phone
- official quiz submit returns score/review
- second official Weekly attempt becomes Practice / cannot overwrite official record
- Special answer-release policy verified
- leader cannot access other-cell/Admin data
- Excel NEW and REPLACE preview verified
- monthly settlement test verified
- inactive historical participant remains in past result snapshot
