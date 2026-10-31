-- RUN ON ISOLATED SUPABASE DEVELOPMENT BRANCH ONLY (after installing staging-only-safe-preserve-excel.sql)
-- NEVER RUN ON PRODUCTION. Every fixture row and backup insert is rolled back.
BEGIN;
DO $test$
DECLARE
  v_quiz_id uuid;
  v_person_id uuid;
  i integer;
  j integer;
  q public.quizzes%rowtype;
  x public.questions%rowtype;
  v_weeks jsonb:='[]'::jsonb;
  v_candidates jsonb;
  v_selected jsonb;
  v_question_snapshot jsonb;
  v_qa jsonb;
  v_result jsonb;
  v_backup uuid;
  v_blocked boolean;
  v_protected_count integer;
  v_selected_count integer;
  v_backup_count integer;
BEGIN
  -- Four future scheduled quizzes, 15 candidates each and exactly 10 selected.
  FOR i IN 1..4 LOOP
    v_quiz_id:=gen_random_uuid();
    INSERT INTO public.quizzes(id, title,quiz_type,status,selection_mode,published_question_count,
      open_at,close_at,content_month_key,content_week_index)
    VALUES(v_quiz_id,'TEST PRESERVE '||i,'WEEKLY','SCHEDULED','FIXED',10,
      clock_timestamp()+interval '100 days'+i*interval '7 days',
      clock_timestamp()+interval '105 days'+i*interval '7 days','2098-01',i);
    FOR j IN 1..15 LOOP
      INSERT INTO public.questions(quiz_id,candidate_order,sort_order,selected,question_type,prompt,
       choices,correct_index,explanation,hint,bible_range,difficulty,note)
      VALUES (v_quiz_id,j,j,j<=10,'MCQ','before-'||i||'-'||j,
       '["old A","old B","old C","old D"]'::jsonb,0,'old explanation',null,'Amos 1:1','MEDIUM','old');
    END LOOP;

    SELECT * INTO STRICT q FROM public.quizzes WHERE id=v_quiz_id;
    v_candidates:='[]'::jsonb;
    FOR x IN SELECT * FROM public.questions WHERE quiz_id=v_quiz_id ORDER BY candidate_order LOOP
      v_qa:=jsonb_build_object('id',x.id,'selected',x.selected,'candidate_order',x.candidate_order,
       'sort_order',x.sort_order,'question_type',x.question_type::text,'prompt',x.prompt,
       'choices',x.choices,'correct_index',x.correct_index,'explanation',x.explanation,
       'hint',x.hint,'bible_range',x.bible_range,'difficulty',x.difficulty,'note',x.note,'import_id',x.import_id);
      v_candidates:=v_candidates || jsonb_build_array(jsonb_build_object(
       'id',x.id,'no',x.candidate_order,'baseline',v_qa,
       'patch',jsonb_build_object('prompt','after-'||i||'-'||x.candidate_order,
       'hint','non-spoiler hint','choices','["new A","new B","new C","new D"]'::jsonb),
       'changes',jsonb_build_array(jsonb_build_object('field','prompt'))));
    END LOOP;
    SELECT to_jsonb(array_agg(id::text ORDER BY id::text)) INTO v_selected
      FROM public.questions WHERE quiz_id=v_quiz_id AND selected;
    v_weeks:=v_weeks || jsonb_build_array(jsonb_build_object(
      'quizId',v_quiz_id,'baseline',to_jsonb(q),'unchangedSelectionIds',v_selected,
      'candidates',v_candidates));
  END LOOP;

  -- Success path: single atomic function call updates 60 questions and stores four full backups.
  SELECT public.apply_preserved_excel_import(
    jsonb_build_object('weeks',v_weeks),'mock-v3.xlsx',repeat('a',64),repeat('b',64),gen_random_uuid())
    INTO v_result;
  IF (v_result->>'quizzes')::int<>4 OR (v_result->>'changedQuestions')::int<>60
  THEN RAISE EXCEPTION 'Incorrect update results: %',v_result; END IF;
  v_backup:=(v_result->>'backupId')::uuid;
  SELECT jsonb_array_length(snapshot) INTO v_backup_count
   FROM public.quiz_preserve_import_backups WHERE id=v_backup;
  IF v_backup_count<>4 THEN RAISE EXCEPTION 'Missing recovery snapshots'; END IF;
  SELECT count(*) INTO v_protected_count FROM public.questions
   WHERE prompt LIKE 'after-%' AND hint='non-spoiler hint' AND
     id IN (SELECT (candidate->>'id')::uuid FROM jsonb_array_elements(v_weeks) w,
       LATERAL jsonb_array_elements(w->'candidates') candidate);
  IF v_protected_count<>60 THEN RAISE EXCEPTION 'Partial update: %',v_protected_count; END IF;
  SELECT count(*) INTO v_selected_count FROM public.questions
   WHERE selected AND quiz_id IN (SELECT (w->>'quizId')::uuid FROM jsonb_array_elements(v_weeks) w);
  IF v_selected_count<>40 THEN RAISE EXCEPTION 'Selection flags changed'; END IF;
  IF EXISTS (
   SELECT 1 FROM public.quizzes WHERE id IN
     (SELECT (w->>'quizId')::uuid FROM jsonb_array_elements(v_weeks) w)
    AND (status::text<>'SCHEDULED' OR published_question_count<>10))
    THEN RAISE EXCEPTION 'Reservation settings changed'; END IF;

  -- Test manual recovery from automatically saved full snapshot.
  FOR v_qa IN SELECT value FROM public.quiz_preserve_import_backups b,
     LATERAL jsonb_array_elements(b.snapshot)
     WHERE b.id=v_backup LOOP
    FOR v_question_snapshot IN SELECT value FROM jsonb_array_elements(v_qa->'questions') LOOP
     UPDATE public.questions SET
       prompt=v_question_snapshot->>'prompt',
       choices=v_question_snapshot->'choices',
       correct_index=(v_question_snapshot->>'correct_index')::int,
       explanation=v_question_snapshot->>'explanation',
       hint=v_question_snapshot->>'hint',
       bible_range=v_question_snapshot->>'bible_range',
       difficulty=v_question_snapshot->>'difficulty',
       note=v_question_snapshot->>'note'
      WHERE id=(v_question_snapshot->>'id')::uuid;
    END LOOP;
  END LOOP;
  SELECT count(*) INTO v_protected_count FROM public.questions
   WHERE prompt LIKE 'before-%' AND
     id IN (SELECT (candidate->>'id')::uuid FROM jsonb_array_elements(v_weeks) w,
       LATERAL jsonb_array_elements(w->'candidates') candidate);
  IF v_protected_count<>60 THEN RAISE EXCEPTION 'Recovery test failed'; END IF;

  -- OPEN must fail without any write.
  v_quiz_id:=(v_weeks->0->>'quizId')::uuid;
  UPDATE public.quizzes SET status='OPEN' WHERE id=v_quiz_id;
  v_blocked:=false;
  BEGIN
    PERFORM public.apply_preserved_excel_import(
      jsonb_build_object('weeks',v_weeks),'blocked.xlsx',repeat('a',64),repeat('b',64),gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'OPEN protection failed'; END IF;
  UPDATE public.quizzes SET status='SCHEDULED' WHERE id=v_quiz_id;

  -- Even a started/unsubmitted session must block update.
  v_person_id:=gen_random_uuid();
  INSERT INTO public.people(id,display_name,active) VALUES(v_person_id,'staging-only-audit',true);
  INSERT INTO public.quiz_sessions(quiz_id,person_id,mode,assigned_question_ids)
  VALUES(v_quiz_id,v_person_id,'OFFICIAL',
   (SELECT array_agg(id ORDER BY candidate_order) FROM public.questions
    WHERE quiz_id=v_quiz_id AND selected));
  v_blocked:=false;
  BEGIN
    PERFORM public.apply_preserved_excel_import(
      jsonb_build_object('weeks',v_weeks),'blocked.xlsx',repeat('a',64),repeat('b',64),gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Session protection failed'; END IF;
  RAISE NOTICE 'PASS: 4 quizzes/60 updates/40 selections/atomic backup/restore/OPEN+session protection';
END;
$test$;
ROLLBACK;