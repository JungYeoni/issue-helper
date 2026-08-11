# [Design] 대괄호 태그 제거 및 키워드 기반 커밋 타입 분류 — 2026-08-12

## 목적

지금까지 커밋 타입은 항상 `feat`로 고정돼 있었다. 실제로는 버그 수정, 리팩토링 등 다양한 성격의 이슈가 들어오는데 전부 `feat`로 표시되면 커밋 히스토리에서 변경 성격을 구분할 수 없다. 또한 이슈 제목 맨 앞에 `[도구]`, `[QA]` 같은 분류 태그를 붙이는 팀 컨벤션이 있는데, 이 태그가 브랜치명/커밋 메시지에 그대로 노출되면 지저분하다.

이번 변경으로 (1) 제목 맨 앞 대괄호 태그를 제거하고, (2) 제목에 포함된 키워드를 보고 커밋 타입을 `feat`/`fix`/`refactor`/`docs`/`chore` 중 하나로 자동 분류한다.

## 변경 범위

`slugify`(브랜치명 slug)와 `buildCommitMessage`(커밋 메시지) 양쪽에 적용된다. 브랜치명 접두사(`feat/...`)와 커밋 메시지 접두사(`feat: ...`)가 더 이상 고정값이 아니라 이슈별로 달라진다.

## 대괄호 태그 제거 규칙

제목 맨 앞에 오는 대괄호 하나(`[...]`)는 내용에 상관없이 제거한다. 이모지 제거 다음 순서로 적용한다 (이모지가 태그보다 앞에 오는 경우, 이모지를 먼저 지워야 태그가 "맨 앞"이 되기 때문). 제목 중간에 나오는 대괄호는 건드리지 않는다.

```
"🛠️ [도구] extract_hwpx.py가 버그" → (이모지 제거) → " [도구] extract_hwpx.py가 버그" → (태그 제거) → "extract_hwpx.py가 버그"
```

## 커밋 타입 분류 규칙

**원본 제목 전체**(대괄호 안 태그든 바깥 본문이든 구분 없이, trim만 적용, 이모지/태그 제거 이전)에서 키워드를 대소문자 구분 없이 부분 문자열로 검색한다. 아래 순서대로 검사해서 처음 매칭되는 타입을 쓴다. 아무것도 안 걸리면 `feat`.

| 우선순위 | 타입 | 매칭 키워드 |
|---|---|---|
| 1 | `fix` | 버그, 오류, 에러, bug, fix, error |
| 2 | `refactor` | 리팩토링, refactor |
| 3 | `docs` | 문서, docs |
| 4 | `chore` | 기타, chore |
| 5 (기본값) | `feat` | (매칭 없음) |

원본 제목 전체를 검사 대상으로 삼는 이유: 대괄호 태그가 `[도구]`처럼 타입과 무관한 분류어일 수 있고, 실제 성격을 나타내는 단어("버그" 등)는 본문에 있는 경우가 많다. 태그 텍스트만 보면 이런 경우를 놓친다.

## 예시

제목 `"🛠️ [도구] extract_hwpx.py가 <hp:fwSpace/> 뒤 텍스트를 못 읽는 버그"`, 이슈 #7, 생성일 2026-08-12

| 항목 | 결과 |
|---|---|
| 커밋 타입 | `fix` ("버그" 매칭) |
| 브랜치명 | `fix/20260812_#7_extract_hwpx.py가_hp_fwSpace_뒤_텍스트를_못_읽는_버그` |
| 커밋 메시지 | `fix: extract_hwpx.py가 <hp:fwSpace/> 뒤 텍스트를 못 읽는 버그 (#7)` |

## 구현 방식

`scripts/suggestion.js`:

- 기존 `COMMIT_TYPE = "feat"` 고정 상수를 제거하고, 대신 `COMMIT_TYPE_RULES`(우선순위 배열)와 `DEFAULT_COMMIT_TYPE = "feat"`를 상단에 정의한다.
- `resolveCommitType(title)` 함수를 추가한다. `title.trim()`을 소문자로 변환해 각 규칙의 키워드가 포함되는지 순서대로 검사하고, 매칭되는 첫 타입을 반환한다. 매칭이 없으면 `DEFAULT_COMMIT_TYPE`을 반환한다.
- `removeLeadingBracketTag(text)` 함수를 추가한다. 문자열 맨 앞(선행 공백 허용)의 `[...]` 하나를 제거한다.
- `slugify(title)`: `removeEmoji()` 다음 단계로 `removeLeadingBracketTag()`를 적용한다.
- `buildCommitMessage(issueNumber, title)`: 제목 정리 파이프라인에 `removeLeadingBracketTag()`를 추가하고(`removeEmoji` 다음), 커밋 타입은 `resolveCommitType(title)`로 계산해서 접두사로 쓴다.
- `buildBranchName(issueNumber, title, createdAt)`: 브랜치 접두사도 `resolveCommitType(title)`로 계산한다.
- `module.exports`에서 `COMMIT_TYPE`을 제거하고 `COMMIT_TYPE_RULES`, `DEFAULT_COMMIT_TYPE`을 추가한다 (README "커스터마이징" 섹션에서 이 두 값을 바꾸는 방법으로 안내를 갱신해야 함).

## 엣지 케이스

- 대괄호 태그가 없는 제목 → 태그 제거 단계는 아무 효과 없음, 기존 동작과 동일.
- 대괄호가 제목 중간에만 있는 경우(예: `"결측치 확인 [보류]"`) → 맨 앞이 아니므로 제거하지 않는다.
- 이모지 제거 후 남는 선행 공백 때문에 대괄호가 문자열 맨 앞이 아니게 되는 경우 → `removeLeadingBracketTag`의 정규식이 선행 공백을 허용하므로 정상 제거된다.
- 여러 키워드가 동시에 매칭되는 제목(예: "버그 수정 리팩토링") → 우선순위 표의 순서(`fix` > `refactor` > `docs` > `chore`)를 따른다.
- 태그 제거 후 slug가 빈 문자열이 되는 경우 → 기존 로직대로 `untitled`로 대체된다.

## 범위 외 (Out of scope)

- 태그/키워드 목록을 이슈 라벨이나 프로젝트 설정에서 읽어오는 것 — 지금은 소스 코드 상단 상수로만 관리한다.
- `test`/`style`/`perf`/`ci`/`build` 등 다른 conventional commit 타입 — 필요해지면 `COMMIT_TYPE_RULES`에 추가하면 된다.
- 이 작업과 별도로 논의 중인 "이슈 제목 수정 시 코멘트 갱신" 기능은 이 스펙에 포함하지 않는다 (워크플로우 트리거 변경이 필요한 별개 작업으로 다룬다).
