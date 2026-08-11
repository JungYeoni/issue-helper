# [Design] 이슈 제목 수정 시 코멘트 갱신 — 2026-08-12

## 목적

지금은 `issues: opened` 이벤트에서만 동작해서, 이슈를 연 뒤 제목을 고치면 코멘트의 브랜치명/커밋 메시지 제안이 낡은 채로 남는다. 제목이 바뀌면 코멘트도 최신 제목 기준으로 갱신되게 한다.

## 트리거 변경

`.github/workflows/issue-helper.yml`의 `on.issues.types`에 `edited`를 추가한다.

```yaml
on:
  issues:
    types: [opened, edited]
  workflow_call:
```

`edited` 이벤트는 제목뿐 아니라 본문·라벨·담당자 변경 등에도 발생하므로, **제목이 실제로 바뀐 경우에만** 동작하도록 job 레벨에 조건을 추가한다:

```yaml
jobs:
  suggest:
    if: github.event_name != 'issues' || github.event.action != 'edited' || github.event.changes.title != null
```

이 조건은 "issues 이벤트이고, action이 edited이고, changes에 title이 없는 경우"에만 스킵되고, 그 외(다른 이벤트, opened, 제목이 바뀐 edited)는 전부 실행된다. `workflow_call`로 호출되는 경우 `github.event_name`이 `issues`가 아니므로 항상 실행된다.

## 코멘트 갱신 방식

`.github/workflows/issue-helper.yml`의 `github-script` 스텝을 아래 흐름으로 바꾼다:

1. `buildComment`로 최신 제안 코멘트 본문을 만든다 (기존과 동일).
2. `github.rest.issues.listComments`로 해당 이슈의 코멘트를 조회하고, 본문이 `## Guide by YEONI-ISSUE-HELPER`로 시작하는 코멘트를 찾는다.
3. 찾으면 `github.rest.issues.updateComment`로 그 코멘트 본문을 최신 내용으로 덮어쓴다.
4. 못 찾으면(최초 실행이거나 코멘트가 수동으로 삭제된 경우) 기존처럼 `github.rest.issues.createComment`로 새로 만든다.

이벤트 종류(`opened`/`edited`/`workflow_call`)에 따라 분기하지 않고 하나의 로직으로 처리한다 — `opened`나 `workflow_call` 시점에는 기존 코멘트가 없을 것이므로 자연히 3번 생성 경로를 타게 된다.

## 예시 흐름

1. 이슈 #70을 "결측치 확인"으로 열면 → 기존 코멘트 없음 → 새 코멘트 생성.
2. 제목을 "결측치 확인 및 보정"으로 수정하면 → 기존 코멘트 있음 → 그 코멘트를 새 제목 기준 브랜치명/커밋 메시지로 갱신.
3. 본문만 수정하면(제목 그대로) → job 조건에서 스킵, 아무 반응 없음.

## 권한

추가 권한 변경 없음. 기존 `issues: write`가 `listComments`(읽기)와 `updateComment`(쓰기)를 모두 포함한다.

## 엣지 케이스

- 코멘트가 100개를 넘는 이슈에서 `listComments` 기본 페이지네이션(1페이지, 최대 30~100개)으로 오래된 페이지에 있는 기존 코멘트를 못 찾을 수 있다 — 이 레포의 용도상 이슈당 코멘트가 그렇게 쌓일 가능성이 낮아 이번 범위에서는 페이지네이션을 구현하지 않는다.
- 사용자가 YEONI-ISSUE-HELPER 코멘트를 수동으로 삭제한 뒤 제목을 수정하면 → 못 찾으므로 새로 생성된다 (의도된 폴백 동작).
- `reopened` 이벤트는 이번에도 트리거 대상에 넣지 않는다.

## 범위 외 (Out of scope)

- `reopened`, 라벨/담당자 변경 등 제목 외 이벤트에 대한 반응.
- 코멘트 갱신 이력(누가 언제 제목을 바꿨는지)을 별도로 남기는 것 — 코멘트는 항상 최신 상태만 보여준다.
- `listComments` 페이지네이션.
