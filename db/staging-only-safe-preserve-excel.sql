-- STAGING ONLY. DO NOT EXECUTE AGAINST PRODUCTION UNTIL REVIEW AND BACKUP APPROVAL.
-- Requires only the existing questions/quizzes/quiz_sessions/submissions tables.
-- All four weeks are checked, backed up and patched in one PostgreSQL transaction.
create table if not exists public.quiz_preserve_import_backups (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid not null,
 source_name text not null,
 source_hash text not null,
 preview_hash text not null,
 quiz_ids uuid[] not null,
 snapshot jsonb not null,
 changed_questions integer not null,
 changed_fields integer not null
);
alter table public.quiz_preserve_import_backups enable row level security;
revoke all on public.quiz_preserve_import_backups from public, anon, authenticated;
grant select,insert on public.quiz_preserve_import_backups to service_role;

create or replace function public.apply_preserved_excel_import(
 p_plan jsonb,p_source_name text,p_source_hash text,p_preview_hash text,p_actor uuid
) returns jsonb
language plpgsql security invoker set search_path = public
as $fn$
declare
 wk jsonb;
 c jsonb;
 baseline jsonb;
 original jsonb;
 patch jsonb;
 qr public.quizzes%rowtype;
 row_question public.questions%rowtype;
 v_quiz_id uuid;
 v_question_id uuid;
 selected_count integer;
 count_existing integer;
 count_plan integer;
 changed_count integer:=0;
 changed_fields integer:=0;
 backup_id uuid;
 backup_payload jsonb:='[]'::jsonb;
 snapshot_questions jsonb;
 seen_quizzes uuid[]:='{}'::uuid[];
 selected_ids text[];
 expected_selected text[];
begin
 if p_actor is null or p_source_hash !~ '^[0-9a-f]{64}$' or p_preview_hash !~ '^[0-9a-f]{64}$'
 then raise exception 'Invalid audit or fingerprint'; end if;
 if jsonb_typeof(p_plan->'weeks') <> 'array'
    or jsonb_array_length(p_plan->'weeks') < 1
    or jsonb_array_length(p_plan->'weeks') > 8
 then raise exception 'Invalid week plan'; end if;

 -- Lock all parent quizzes in deterministic order; a foreign-key session insert
 -- requires a conflicting KEY SHARE lock, so it cannot race past our checks.
 for qr in
  select q.* from public.quizzes q
  where q.id in (select (x.value->>'quizId')::uuid from jsonb_array_elements(p_plan->'weeks') x)
  order by q.id
  for update
 loop
  seen_quizzes:=array_append(seen_quizzes,qr.id);
 end loop;
 if cardinality(seen_quizzes)<>jsonb_array_length(p_plan->'weeks')
 then raise exception 'Missing or duplicate planned quiz IDs'; end if;

 for wk in select value from jsonb_array_elements(p_plan->'weeks') loop
  v_quiz_id:=(wk->>'quizId')::uuid;
  select * into strict qr from public.quizzes where id=v_quiz_id;
  baseline:=wk->'baseline';
  if qr.status::text<>'SCHEDULED'
    or qr.open_at<=clock_timestamp()
    or qr.quiz_type::text<>'WEEKLY'
    or qr.selection_mode::text<>'FIXED'
    or qr.published_question_count<>10
  then raise exception 'Quiz is no longer a safe scheduled fixed quiz: %',v_quiz_id; end if;
  if qr.title is distinct from baseline->>'title'
    or qr.status::text is distinct from baseline->>'status'
    or qr.open_at is distinct from (baseline->>'open_at')::timestamptz
    or qr.close_at is distinct from (baseline->>'close_at')::timestamptz
    or qr.selection_mode::text is distinct from baseline->>'selection_mode'
    or qr.random_question_count is distinct from (baseline->>'random_question_count')::int
    or qr.published_question_count is distinct from (baseline->>'published_question_count')::int
    or qr.import_id is distinct from (baseline->>'import_id')::uuid
    or qr.monthly_period_id is distinct from (baseline->>'monthly_period_id')::uuid
    or qr.content_month_key is distinct from baseline->>'content_month_key'
    or qr.content_week_index is distinct from (baseline->>'content_week_index')::int
  then raise exception 'Quiz reservation changed since preview: %',qr.title; end if;

  if exists(select 1 from public.quiz_sessions where quiz_id=qr.id)
     or exists(select 1 from public.submissions where quiz_id=qr.id)
  then raise exception 'Quiz now contains sessions/submissions: %',qr.title; end if;

  select count(*)::int,count(*) filter(where selected)::int into count_existing,selected_count
   from public.questions where quiz_id=v_quiz_id;
  count_plan:=jsonb_array_length(wk->'candidates');
  if count_existing<>count_plan or selected_count<>10
   then raise exception 'Question count or selected count changed: %',qr.title; end if;

  select array_agg(id::text order by id::text) into selected_ids
    from public.questions where quiz_id=v_quiz_id and selected;
  select array_agg(x order by x) into expected_selected
    from jsonb_array_elements_text(wk->'unchangedSelectionIds') x;
  if selected_ids is distinct from expected_selected
   then raise exception 'Selected question IDs changed: %',qr.title; end if;

  -- Preserve full recovery snapshot, including IDs and selected flags.
  select jsonb_agg(to_jsonb(q) order by q.candidate_order,q.id)
   into snapshot_questions from public.questions q where quiz_id=v_quiz_id;
  backup_payload:=backup_payload || jsonb_build_array(jsonb_build_object(
   'quiz',to_jsonb(qr),'questions',coalesce(snapshot_questions,'[]'::jsonb)
  ));

  for c in select value from jsonb_array_elements(wk->'candidates') loop
   v_question_id:=(c->>'id')::uuid;
   select * into strict row_question from public.questions where id=v_question_id and quiz_id=v_quiz_id for update;
   baseline:=c->'baseline';
   original:=jsonb_build_object(
    'id',row_question.id,'selected',row_question.selected,
    'candidate_order',row_question.candidate_order,'sort_order',row_question.sort_order,
    'question_type',row_question.question_type::text,'prompt',row_question.prompt,
    'choices',row_question.choices,'correct_index',row_question.correct_index,
    'explanation',row_question.explanation,'hint',row_question.hint,
    'bible_range',row_question.bible_range,'difficulty',row_question.difficulty,
    'note',row_question.note,'import_id',row_question.import_id
   );
   if original is distinct from baseline
    then raise exception 'Candidate changed after preview: quiz % question %',v_quiz_id,v_question_id; end if;
   if row_question.candidate_order<>(c->>'no')::int
    then raise exception 'Candidate identity mismatch: %',v_question_id; end if;
   patch:=c->'patch';
   if patch<>'{}'::jsonb then
    if (patch - array['prompt','choices','correct_index','explanation','hint','bible_range','difficulty','note'])<>'{}'::jsonb
     then raise exception 'Unsafe field in patch'; end if;
    update public.questions set
      prompt=case when patch?'prompt' then patch->>'prompt' else prompt end,
      choices=case when patch?'choices' then patch->'choices' else choices end,
      correct_index=case when patch?'correct_index' then (patch->>'correct_index')::int else correct_index end,
      explanation=case when patch?'explanation' then patch->>'explanation' else explanation end,
      hint=case when patch?'hint' then patch->>'hint' else hint end,
      bible_range=case when patch?'bible_range' then patch->>'bible_range' else bible_range end,
      difficulty=case when patch?'difficulty' then patch->>'difficulty' else difficulty end,
      note=case when patch?'note' then patch->>'note' else note end
    where id=v_question_id and quiz_id=v_quiz_id;
    changed_count:=changed_count+1;
    changed_fields:=changed_fields+(select count(*) from jsonb_object_keys(patch));
   end if;
  end loop;
 end loop;

 insert into public.quiz_preserve_import_backups(
  created_by,source_name,source_hash,preview_hash,quiz_ids,snapshot,changed_questions,changed_fields
 ) values (
  p_actor,p_source_name,p_source_hash,p_preview_hash,seen_quizzes,backup_payload,changed_count,changed_fields
 ) returning id into backup_id;
 return jsonb_build_object('ok',true,'backupId',backup_id,'quizzes',cardinality(seen_quizzes),'changedQuestions',changed_count,'changedFields',changed_fields);
end
$fn$;

revoke all on function public.apply_preserved_excel_import(jsonb,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.apply_preserved_excel_import(jsonb,text,text,text,uuid)
 to service_role;
