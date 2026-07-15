# issue-helper (YEONI-ISSUE-HELPER)

이슈가 생성되면 규칙 기반으로 브랜치명과 커밋 메시지를 제안해 이슈 코멘트로 남기는 GitHub Actions 워크플로우.

외부 LLM API 호출이나 Secret 등록 없이, GitHub Actions 기본 `GITHUB_TOKEN`만으로 동작한다.

## 동작

이슈가 열리면(`issues: opened`) 아래 형식으로 코멘트가 자동으로 달린다.

```
## YEONI-ISSUE-HELPER 제안

**브랜치**: `feat/123-서울-데이터-보고서-오류`
**커밋 메시지**: `feat: 서울 데이터 보고서 오류 (#123)`
```

- **브랜치명**: `feat/{이슈번호}-{slug}` — 커밋 타입은 항상 고정값 `feat`
- **커밋 메시지**: `feat: {원본 제목} (#{이슈번호})` — 원본 제목은 trim만 하고 slug화하지 않음
- **slug 규칙**: 한글 원문 유지(번역/로마자 변환 없음), git 브랜치명에 쓸 수 없는 문자 제거, 공백은 `-`로 치환, 최대 50자, 결과가 빈 문자열이면 `untitled`

edited/reopened 등 다른 이슈 이벤트에는 반응하지 않고, `opened`에만 한 번 코멘트를 단다.

## 다른 레포에 설치하는 법

이 레포를 통째로 쓰는 게 아니라, 아래 2개 파일만 대상 레포에 복사하면 된다.

1. `scripts/suggestion.js` → 대상 레포의 같은 경로에 복사
2. `.github/workflows/issue-helper.yml` → 대상 레포의 같은 경로에 복사

테스트까지 같이 가져가고 싶다면 아래도 함께 복사한다 (선택):

3. `scripts/suggestion.test.js`
4. `.github/workflows/test.yml`
5. `package.json`의 `scripts.test` 항목 (`"test": "node --test"`)

별도 npm 패키지 설치나 Secret 등록은 필요 없다. 코드를 커밋/푸시하면 다음 이슈 생성부터 바로 동작한다.

### 권한 (permissions) — 중요

`issue-helper.yml`에는 아래 권한이 반드시 있어야 한다.

```yaml
permissions:
  contents: read   # actions/checkout이 레포를 클론하기 위해 필요
  issues: write     # 이슈에 코멘트를 작성하기 위해 필요
```

`permissions` 블록을 워크플로우에 명시하면, 여기에 적지 않은 나머지 스코프는 전부 `none`으로 취급된다. `contents: read`를 빼면 **private 레포에서는** `actions/checkout` 단계가 `Repository not found`로 실패한다 (public 레포는 공개 접근이라 우연히 성공하는 경우가 있어 놓치기 쉬운 함정 — 실제로 이 레포를 만들면서 private 레포 테스트에서 이 문제를 직접 확인했다).

레포/조직 설정(Settings → Actions → General → Workflow permissions)에서 기본 `GITHUB_TOKEN` 권한을 "Read repository contents permission"(읽기 전용)으로 제한해둔 경우, 워크플로우 파일에 `issues: write`를 선언해도 막힐 수 있다. 이건 워크플로우 코드가 아니라 레포/조직 설정 문제이므로, 코멘트가 안 달리면 이 설정부터 확인한다.

Public/private 레포 모두 코드 동작 자체는 동일하다 (위 권한 설정만 지키면 된다). 다만 private 레포는 GitHub 무료 플랜 기준 월 Actions 사용 시간(분) 한도가 있고, public 레포는 GitHub 호스팅 러너 사용이 무제한이라는 차이는 있다.

## 커스터마이징

`scripts/suggestion.js` 상단의 상수만 바꾸면 동작을 조정할 수 있다.

```js
const MAX_SLUG_LENGTH = 50;   // slug 최대 길이
const COMMIT_TYPE = "feat";   // 브랜치/커밋 접두사 (항상 고정값)
```

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
console.log(buildComment(123, '서울 데이터 보고서 오류'));
"
```

## 설계/구현 문서

- 설계: [docs/superpowers/specs/2026-07-15-issue-helper-design.md](docs/superpowers/specs/2026-07-15-issue-helper-design.md)
- 구현 계획: [docs/superpowers/plans/2026-07-15-issue-helper.md](docs/superpowers/plans/2026-07-15-issue-helper.md)
