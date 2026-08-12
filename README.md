# issue-helper (YEONI-ISSUE-HELPER)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

이슈가 생성되면 규칙 기반으로 브랜치명과 커밋 메시지를 제안해 이슈 코멘트로 남기는 GitHub Actions 워크플로우.

- 외부 LLM API 호출 없음
- Secret 등록 없음
- GitHub Actions 기본 `GITHUB_TOKEN`만으로 동작

## 동작 방식

이슈가 열리면(`issues: opened`) 아래 형식의 코멘트가 자동으로 달린다. edited/reopened 등 다른 이벤트에는 반응하지 않는다.

```
## Guide by YEONI-ISSUE-HELPER

### 날짜

20260715

### 브랜치

fix/20260715_#123_서울_데이터_보고서_오류

### 커밋 메시지

fix: 서울 데이터 보고서 오류 (#123)
```

### 생성 규칙

| 항목        | 규칙                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 날짜        | 이슈 생성일(`issue.created_at`)을 `YYYYMMDD` 형식으로 표기                                                                                              |
| 커밋 타입   | 제목에 포함된 키워드로 자동 분류(`fix`/`refactor`/`docs`/`chore`, 매칭 없으면 `feat`) — 아래 "커밋 타입 분류" 참고                                       |
| 브랜치명    | `{커밋타입}/{날짜:YYYYMMDD}_#{이슈번호}_{slug}`                                                                                                         |
| 커밋 메시지 | `{커밋타입}: {원본 제목} (#{이슈번호})` — 이모지·맨 앞 대괄호 태그 제거·연속 공백 정리 후 사용 (slug화하지 않음) · 결과가 빈 문자열이면 `untitled`            |
| slug        | 한글 원문 유지(번역/로마자 변환 없음) · 이모지 제거 · 맨 앞 대괄호 태그 제거 · 브랜치명에 못 쓰는 문자 제거 · 공백과 `/`는 `_`로 치환(`/`는 git 브랜치 경로 구분자라 slug에 남으면 ref 충돌) · 최대 50자 · 결과가 빈 문자열이면 `untitled` |

### 커밋 타입 분류

제목 전체(대괄호 태그 안 텍스트 포함)에서 아래 키워드를 순서대로 검색해 첫 번째로 매칭되는 타입을 쓴다. 대소문자는 구분하지 않는다.

| 우선순위 | 타입 | 매칭 키워드 |
| --- | --- | --- |
| 1 | `fix` | 버그, 오류, 에러, bug, fix, error |
| 2 | `refactor` | 리팩토링, refactor |
| 3 | `docs` | 문서, docs |
| 4 | `chore` | 기타, chore |
| 5 (기본값) | `feat` | (매칭 없음) |

예: `"🛠️ [도구] extract_hwpx.py가 텍스트를 못 읽는 버그"` → 태그 `[도구]`는 지워지고, 본문에 "버그"가 있어 `fix`로 분류된다 → `fix: extract_hwpx.py가 텍스트를 못 읽는 버그 (#7)`

## 설치 방법

### 방법 A. 재사용 가능한 워크플로우로 참조 (추천)

대상 레포에 파일을 복사하지 않고, 이 레포의 워크플로우를 그대로 호출한다. 이 레포가 업데이트되면 별도 작업 없이 바로 반영된다.

대상 레포에 아래 파일 하나만 추가하면 된다 (`.github/workflows/issue-helper.yml`):

```yaml
name: Issue Helper

on:
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write

jobs:
  suggest:
    uses: JungYeoni/issue-helper/.github/workflows/issue-helper.yml@main
```

- `@main` 대신 특정 태그(`@v1` 등)로 고정하면, 이 레포가 바뀌어도 그 버전 동작이 유지된다. 최신 반영을 원하면 `@main`을 쓴다.
- 대상 레포에도 `permissions`(`contents: read`, `issues: write`)를 선언해야 한다 — 호출하는 쪽과 호출받는 쪽 권한의 교집합만 적용되기 때문이다.

### 방법 B. 파일 복사

레포 간 의존성 없이 완전히 독립적으로 쓰고 싶다면, 아래 2개 파일만 대상 레포에 복사한다.

1. `scripts/suggestion.js`
2. `.github/workflows/issue-helper.yml` (이때 `workflow_call:` 트리거와 `repository`/`ref`가 지정된 checkout 스텝은 지워도 된다 — 같은 레포 안의 스크립트를 그대로 쓰면 되기 때문)

테스트까지 같이 가져가고 싶다면 (선택):

3. `scripts/suggestion.test.js`
4. `.github/workflows/test.yml`
5. `package.json`의 `"test": "node --test"` 항목

두 방법 모두 별도 npm 패키지 설치나 Secret 등록은 필요 없다. 적용 후 다음 이슈 생성부터 바로 동작한다.

## 권한 설정 (필수)

`issue-helper.yml`에는 아래 권한이 반드시 있어야 한다.

```yaml
permissions:
  contents: read # actions/checkout이 레포를 클론하기 위해 필요
  issues: write # 이슈에 코멘트를 작성하기 위해 필요
```

> **주의**
>
> - `permissions` 블록을 명시하면, 여기에 적지 않은 나머지 스코프는 전부 `none`으로 취급된다.
> - `contents: read`가 없으면 **private 레포에서** `actions/checkout` 단계가 `Repository not found`로 실패한다. (public 레포는 공개 접근이라 우연히 성공하는 경우가 있어 놓치기 쉬운 함정 — 실제로 private 레포 테스트에서 확인했다.)
> - 레포/조직 설정(Settings → Actions → General → Workflow permissions)에서 기본 `GITHUB_TOKEN` 권한을 읽기 전용으로 제한해둔 경우, 워크플로우 파일에 `issues: write`를 선언해도 막힐 수 있다. 이건 워크플로우 코드가 아니라 레포/조직 설정 문제이므로, 코멘트가 안 달리면 이 설정부터 확인한다.

Public/private 레포 모두 코드 동작 자체는 동일하다. 다만 private 레포는 GitHub 무료 플랜 기준 월 Actions 사용 시간(분) 한도가 있고, public 레포는 GitHub 호스팅 러너 사용이 무제한이라는 차이가 있다.

## 커스터마이징

`scripts/suggestion.js` 상단의 상수만 바꾸면 동작을 조정할 수 있다.

```js
const MAX_SLUG_LENGTH = 50; // slug 최대 길이
const COMMIT_TYPE_RULES = [
  { type: 'fix', keywords: ['버그', '오류', '에러', 'bug', 'fix', 'error'] },
  { type: 'refactor', keywords: ['리팩토링', 'refactor'] },
  { type: 'docs', keywords: ['문서', 'docs'] },
  { type: 'chore', keywords: ['기타', 'chore'] },
]; // 커밋 타입 분류 규칙, 배열 순서가 우선순위
const DEFAULT_COMMIT_TYPE = 'feat'; // 매칭되는 키워드가 없을 때 기본값
```

`COMMIT_TYPE_RULES` 배열에 항목을 추가/삭제/순서 변경하면 분류 규칙을 바꿀 수 있다 (배열 앞쪽일수록 우선순위가 높다).

코멘트 문구 자체를 바꾸고 싶다면 `buildComment` 함수의 템플릿 문자열을 수정하면 된다.

## 로컬에서 테스트하기

외부 의존성 없이 Node 내장 테스트 러너(`node:test`)만 사용한다.

```bash
npm test
```

`buildComment`가 실제로 어떤 문자열을 만드는지 직접 확인하려면:

```bash
node -e "
const { buildComment } = require('./scripts/suggestion.js');
console.log(buildComment(123, '서울 데이터 보고서 오류', '2026-07-15T09:00:00Z'));
"
```

## 설계/구현 문서

- 설계: [docs/superpowers/specs/2026-07-15-issue-helper-design.md](docs/superpowers/specs/2026-07-15-issue-helper-design.md)
- 구현 계획: [docs/superpowers/plans/2026-07-15-issue-helper.md](docs/superpowers/plans/2026-07-15-issue-helper.md)

## 라이선스

[MIT](LICENSE)
