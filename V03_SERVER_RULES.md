# v0.3 Server Rules

## 공식 응시
- `OFFICIAL` session은 `(quiz_id, person_id)`당 최대 1개다.
- 마감 전에 생성된 OFFICIAL session은 마감 후에도 제출할 수 있다.
- 마감 후에는 새 OFFICIAL session만 생성할 수 없다.
- 이미 공식 session이 있으면 `/api/quiz/start`는 기존 session을 반환해 이어풀기를 지원한다.

## 랜덤 출제
- `FIXED`: 선택된 문제를 순서대로 Session에 저장한다.
- `RANDOM`: 선택된 후보에서 `random_question_count`개를 Session 시작 시 한 번 뽑는다.
- `assigned_question_ids`를 Session에 영구 저장하므로 재접속/새로고침으로 문제를 다시 뽑지 않는다.

## 제출
- 클라이언트는 점수나 정답 여부를 보내지 않는다.
- 클라이언트는 `questionId + selectedIndex`만 보낸다.
- 서버가 Session의 frozen question IDs와 DB 정답키로 재계산한다.
- 미응답은 `null`이며 오답 처리한다.
- 공식 제출은 DB unique index로도 중복을 차단한다.
- 같은 Session 재전송은 기존 Submission을 반환하여 네트워크 재시도에 안전하게 만든다.

## 점수
`round(correctCount / questionCount * 100)`

예:
- 7/8 = 88
- 2/3 = 67
- 3/3 = 100

Weekly와 Special 모두 동일하다.

## 셀 기록
Session 생성 시 `group_id_snapshot`을 저장한다.
이후 사용자가 다른 셀로 이동해도 과거 Ranking의 당시 셀은 변하지 않는다.

## TEST / PRACTICE
- `PRACTICE`: 여러 번 생성/제출 가능. 공식 Ranking/Monthly 합산에서 제외한다.
- `TEST`: Admin QA용. 공식 통계에서 제외한다.

## 보안
- 브라우저에는 Supabase service role key를 절대 노출하지 않는다.
- 참가자 쓰기는 Next.js server route를 통해서만 처리한다.
- RLS는 전체 핵심 테이블에 활성화되어 있으며 v0.3에는 anon 직접 write policy를 만들지 않는다.
