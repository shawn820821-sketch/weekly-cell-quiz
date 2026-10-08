-- v1.0 QA Fix Pack

create table if not exists public.quiz_result_verses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  verse_text text not null,
  reference text not null,
  sort_order integer not null default 0
);

create table if not exists public.common_result_verses (
  id uuid primary key default gen_random_uuid(),
  verse_text text not null,
  reference text not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

alter table public.quiz_result_verses enable row level security;
alter table public.common_result_verses enable row level security;

insert into public.common_result_verses (verse_text, reference, sort_order)
select * from (values
  ('너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라', '잠언 16:3', 10),
  ('주의 말씀은 내 발에 등이요 내 길에 빛이니이다', '시편 119:105', 20),
  ('항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라', '데살로니가전서 5:16-18', 30)
) as v(verse_text, reference, sort_order)
where not exists (select 1 from public.common_result_verses);
