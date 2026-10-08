-- Weekly Cell Quiz v0.6 operational convenience features

create table if not exists public.content_imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_hash text not null,
  month_key text,
  mode text not null check (mode in ('NEW','REPLACE')),
  replaces_import_id uuid references public.content_imports(id),
  status text not null default 'COMMITTED' check (status in ('PREVIEW','COMMITTED','REPLACED','FAILED')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.people(id),
  created_at timestamptz not null default now()
);
create index if not exists content_imports_month_idx on public.content_imports(month_key, created_at desc);

alter table public.questions add column if not exists import_id uuid references public.content_imports(id);
alter table public.questions add column if not exists candidate_order integer;
alter table public.questions add column if not exists note text;

alter table public.content_imports enable row level security;
