# [Design] issue-helper GitHub Actions 워크플로우 — 2026-07-15

## 목적

이슈가 생성(`opened`)되면, 이슈 제목/번호를 기반으로 브랜치명과 커밋 메시지를 규칙 기반으로 생성해 해당 이슈에 코멘트로 남긴다. 외부 LLM API 호출 없이 순수 규칙 기반으로 동작하며, 별도 Secret 등록이 불필요하다.

## 트리거 및 권한

```yaml
on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write
```

- `GITHUB_TOKEN` 기본 권한만 사용. 별도 시크릿 불필요.
- 실행 환경: `ubuntu-latest`. slug/브랜치/커밋메시지 로직을 `scripts/suggestion.js` 모듈로 분리했기 때문에 `actions/checkout`으로 repo를 먼저 체크아웃해야 한다 (아래 "구현 방식" 참고).
- `contents: read`는 checkout에 필요. private 레포에서 이 권한 없이 `permissions: issues: write`만 선언하면 `actions/checkout`이 "Repository not found"로 실패한다 (public 레포에서는 공개 접근이라 우연히 성공했음 — 실제 private 레포 테스트로 확인).

## 구현 방식

로직(`slugify`, `buildBranchName`, `buildCommitMessage`, `buildComment`)은 `scripts/suggestion.js`에 순수 함수로 구현하고 `node:test`로 단위 테스트한다. 워크플로우는 `actions/checkout`으로 repo를 체크아웃한 뒤 `actions/github-script@v7` 스텝에서 `GITHUB_WORKSPACE` 경로로 이 모듈을 `require`해 `context.payload.issue`의 제목/번호를 넘기고, `github.rest.issues.createComment`로 코멘트를 작성한다. (최초 설계 시 YAML 인라인 구현을 고려했으나, 로직을 테스트 가능한 모듈로 분리하는 쪽을 선택하면서 checkout이 필요해졌다.)

## Slug 생성 규칙

제목을 다음 순서로 정규화한다 (한글 원문 유지, 번역/로마자 변환 없음):

1. 앞뒤 공백 제거 (`trim`)
2. 연속 공백/탭 → 단일 `-`
3. git 브랜치명에 사용할 수 없는 문자 제거: `~ ^ : ? * [ ] \ " ' < > | ..`(연속 마침표) 등
4. 연속된 `-` 를 하나로 축약
5. 앞뒤에 남은 `-` 또는 `.` 트리밍
6. 최대 50자로 자르기 (자른 후에도 5번 트리밍 재적용)
7. 위 과정 후 빈 문자열이면 `untitled` 로 대체

## 출력 규칙

| 항목 | 형식 | 예시 |
|---|---|---|
| 브랜치명 | `feat/{이슈번호}-{slug}` | `feat/123-서울-데이터-보고서-오류` |
| 커밋 메시지 | `feat: {원본 제목} (#{이슈번호})` | `feat: 서울 데이터 보고서 오류 (#123)` |
| 커밋 타입 | 항상 고정값 `feat` | - |

- 커밋 메시지의 `{원본 제목}`은 slug가 아닌 원본 이슈 제목(공백 등 원형 유지)을 사용한다.
- 커밋 타입은 라벨/키워드 판단 없이 항상 `feat`으로 고정한다 (요구사항 확정 사항).

## 코멘트 템플릿

```markdown
## 🤖 제안

**브랜치**: `feat/123-서울-데이터-보고서-오류`
**커밋 메시지**: `feat: 서울 데이터 보고서 오류 (#123)`
```

이슈가 열릴 때마다 한 번, `github.rest.issues.createComment`로 위 템플릿을 렌더링해 게시한다.

## 엣지 케이스

- 제목이 특수문자로만 구성되어 slug가 빈 문자열이 되는 경우 → `untitled`로 대체 (예: `feat/123-untitled`).
- 이슈 제목이 매우 긴 경우 → slug는 50자로 잘리지만, 커밋 메시지의 원본 제목은 자르지 않고 그대로 표기.
- 워크플로우는 `issues.opened` 이벤트에서만 동작하며, edited/reopened 등에는 반응하지 않는다 (재생성/중복 코멘트 방지).

## 테스트 방법

- da-template 레포에 실제 이슈를 하나 생성해 코멘트가 기대한 형식으로 달리는지 확인한다.
- 한글 제목, 특수문자 포함 제목, 매우 긴 제목 각각으로 검증한다.

## 범위 외 (Out of scope)

- 커밋 타입 자동 분류(라벨/키워드 기반) — 이번 버전에서는 고정값만 지원.
- 실제 브랜치 생성이나 커밋 실행 — 코멘트로 제안만 하며 실행은 하지 않는다.
- 다른 레포로의 재사용 패키징(reusable workflow화) — 필요 시 추후 별도 작업.
