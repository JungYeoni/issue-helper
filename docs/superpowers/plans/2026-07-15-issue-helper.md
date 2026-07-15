# issue-helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이슈가 생성되면 규칙 기반으로 브랜치명과 커밋 메시지를 계산해 이슈 코멘트로 남기는 GitHub Actions 워크플로우를 구현한다.

**Architecture:** 순수 함수(slugify/buildBranchName/buildCommitMessage/buildComment)를 `scripts/suggestion.js`에 구현하고 Node 내장 테스트 러너(`node:test`)로 TDD한다. `.github/workflows/issue-helper.yml`은 `actions/checkout` 후 `actions/github-script`에서 이 모듈을 `require`해 호출하고 `github.rest.issues.createComment`로 코멘트를 단다. 별도 CI 워크플로우(`test.yml`)가 push/PR마다 `node --test`를 돌려 회귀를 막는다.

**Tech Stack:** Node.js(내장 `node:test`, 외부 패키지 없음), GitHub Actions(`actions/checkout@v4`, `actions/github-script@v7`, `actions/setup-node@v4`)

## Global Constraints

- 커밋 타입은 항상 고정값 `feat` (라벨/키워드 판단 없음)
- 브랜치명 형식: `feat/{이슈번호}-{slug}`
- 커밋 메시지 형식: `feat: {원본 제목} (#{이슈번호})` — 원본 제목은 trim만 하고 slug화하지 않음
- slug는 한글 원문 유지, 번역/로마자 변환 없음, 최대 50자
- slug가 빈 문자열이 되면 `untitled`로 대체
- 외부 LLM API·Secret 사용 금지 — `actions/github-script`와 기본 `GITHUB_TOKEN`만 사용
- 워크플로우 트리거는 `issues: [opened]`만 (edited/reopened 등 무시)
- 권한은 `issues: write`만 부여

---

### Task 1: slugify 함수 구현 (TDD)

**Files:**
- Create: `package.json`
- Create: `scripts/suggestion.js`
- Test: `scripts/suggestion.test.js`

**Interfaces:**
- Produces: `slugify(title: string): string`, `MAX_SLUG_LENGTH = 50`, `COMMIT_TYPE = "feat"` (모두 `scripts/suggestion.js`의 `module.exports`)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "issue-helper",
  "private": true,
  "version": "1.0.0",
  "description": "이슈 생성 시 브랜치명/커밋 메시지를 규칙 기반으로 제안하는 GitHub Actions 워크플로우",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`scripts/suggestion.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { slugify } = require("./suggestion.js");

test("한글 제목의 공백을 하이픈으로 치환한다", () => {
  assert.equal(slugify("서울 데이터 보고서 오류"), "서울-데이터-보고서-오류");
});

test("연속 공백은 하이픈 하나로 축약한다", () => {
  assert.equal(slugify("서울   데이터    오류"), "서울-데이터-오류");
});

test("git 브랜치명에 쓸 수 없는 특수문자를 제거한다", () => {
  assert.equal(slugify("버그: [긴급] 오류?!"), "버그-긴급-오류!");
});

test("특수문자만 있어 결과가 빈 문자열이면 untitled를 반환한다", () => {
  assert.equal(slugify(":?*[]"), "untitled");
});

test("50자를 넘으면 50자로 자른다", () => {
  const longTitle = "가".repeat(60);
  const result = slugify(longTitle);
  assert.equal(result.length, 50);
  assert.equal(result, "가".repeat(50));
});

test("앞뒤 공백은 제거된다", () => {
  assert.equal(slugify("  제목  "), "제목");
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `node --test`
Expected: FAIL — `Cannot find module './suggestion.js'`

- [ ] **Step 4: slugify 최소 구현**

`scripts/suggestion.js`:

```js
const MAX_SLUG_LENGTH = 50;
const COMMIT_TYPE = "feat";

function slugify(title) {
  let s = title.trim();
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[~^:?*[\]\\"'<>|]/g, "");
  s = s.replace(/\.{2,}/g, "-");
  s = s.replace(/-{2,}/g, "-");
  s = s.replace(/^[-.]+|[-.]+$/g, "");
  if (s.length > MAX_SLUG_LENGTH) {
    s = s.slice(0, MAX_SLUG_LENGTH);
    s = s.replace(/^[-.]+|[-.]+$/g, "");
  }
  return s.length > 0 ? s : "untitled";
}

module.exports = { slugify, MAX_SLUG_LENGTH, COMMIT_TYPE };
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (6 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json scripts/suggestion.js scripts/suggestion.test.js
git commit -m "feat: slugify 함수 구현"
```

---

### Task 2: buildBranchName, buildCommitMessage 함수 구현 (TDD)

**Files:**
- Modify: `scripts/suggestion.js`
- Modify: `scripts/suggestion.test.js`

**Interfaces:**
- Consumes: `slugify(title)`, `COMMIT_TYPE` (Task 1)
- Produces: `buildBranchName(issueNumber: number, title: string): string`, `buildCommitMessage(issueNumber: number, title: string): string`

- [ ] **Step 1: 실패하는 테스트 추가**

`scripts/suggestion.test.js` 상단 import를 아래로 교체:

```js
const { slugify, buildBranchName, buildCommitMessage } = require("./suggestion.js");
```

파일 하단에 추가:

```js
test("이슈 번호와 slug로 브랜치명을 만든다", () => {
  assert.equal(buildBranchName(123, "서울 데이터 보고서 오류"), "feat/123-서울-데이터-보고서-오류");
});

test("커밋 메시지는 원본 제목을 유지한다", () => {
  assert.equal(buildCommitMessage(123, "서울 데이터 보고서 오류"), "feat: 서울 데이터 보고서 오류 (#123)");
});

test("커밋 메시지는 제목 앞뒤 공백을 정리한다", () => {
  assert.equal(buildCommitMessage(5, "  오타 수정  "), "feat: 오타 수정 (#5)");
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test`
Expected: FAIL — `buildBranchName is not a function`

- [ ] **Step 3: 최소 구현**

`scripts/suggestion.js`의 `module.exports` 직전에 추가:

```js
function buildBranchName(issueNumber, title) {
  return `${COMMIT_TYPE}/${issueNumber}-${slugify(title)}`;
}

function buildCommitMessage(issueNumber, title) {
  return `${COMMIT_TYPE}: ${title.trim()} (#${issueNumber})`;
}
```

`module.exports`를 아래로 교체:

```js
module.exports = { slugify, buildBranchName, buildCommitMessage, MAX_SLUG_LENGTH, COMMIT_TYPE };
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js
git commit -m "feat: 브랜치명/커밋 메시지 생성 함수 구현"
```

---

### Task 3: buildComment 함수 구현 (TDD)

**Files:**
- Modify: `scripts/suggestion.js`
- Modify: `scripts/suggestion.test.js`

**Interfaces:**
- Consumes: `buildBranchName(issueNumber, title)`, `buildCommitMessage(issueNumber, title)` (Task 2)
- Produces: `buildComment(issueNumber: number, title: string): string`

- [ ] **Step 1: 실패하는 테스트 추가**

`scripts/suggestion.test.js` 상단 import를 아래로 교체:

```js
const { slugify, buildBranchName, buildCommitMessage, buildComment } = require("./suggestion.js");
```

파일 하단에 추가:

```js
test("코멘트 템플릿을 생성한다", () => {
  const comment = buildComment(123, "서울 데이터 보고서 오류");
  assert.equal(
    comment,
    "## 🤖 제안\n\n**브랜치**: `feat/123-서울-데이터-보고서-오류`\n**커밋 메시지**: `feat: 서울 데이터 보고서 오류 (#123)`\n"
  );
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node --test`
Expected: FAIL — `buildComment is not a function`

- [ ] **Step 3: 최소 구현**

`scripts/suggestion.js`의 `module.exports` 직전에 추가:

```js
function buildComment(issueNumber, title) {
  const branch = buildBranchName(issueNumber, title);
  const commitMessage = buildCommitMessage(issueNumber, title);
  return `## 🤖 제안\n\n**브랜치**: \`${branch}\`\n**커밋 메시지**: \`${commitMessage}\`\n`;
}
```

`module.exports`를 아래로 교체:

```js
module.exports = {
  slugify,
  buildBranchName,
  buildCommitMessage,
  buildComment,
  MAX_SLUG_LENGTH,
  COMMIT_TYPE,
};
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js
git commit -m "feat: 이슈 코멘트 템플릿 생성 함수 구현"
```

---

### Task 4: issue-helper 워크플로우 작성

**Files:**
- Create: `.github/workflows/issue-helper.yml`

**Interfaces:**
- Consumes: `scripts/suggestion.js`의 `buildComment(issueNumber, title)` (Task 3)

- [ ] **Step 1: 워크플로우 파일 작성**

`.github/workflows/issue-helper.yml`:

```yaml
name: Issue Helper

on:
  issues:
    types: [opened]

permissions:
  issues: write

jobs:
  suggest:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4

      - name: 브랜치명/커밋 메시지 제안 코멘트 작성
        uses: actions/github-script@v7
        with:
          script: |
            const { buildComment } = require(`${process.env.GITHUB_WORKSPACE}/scripts/suggestion.js`);

            const issue = context.payload.issue;
            const comment = buildComment(issue.number, issue.title);

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: issue.number,
              body: comment,
            });
```

- [ ] **Step 2: YAML 문법 검증**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/issue-helper.yml'); puts 'valid'"`
Expected: `valid`

- [ ] **Step 3: suggestion.js require 경로 로컬 검증**

`require`가 참조하는 경로가 실제로 `buildComment`를 내보내는지 Node로 직접 확인한다 (GitHub Actions 러너 없이 로직만 검증):

Run:
```bash
node -e "
const { buildComment } = require('./scripts/suggestion.js');
console.log(buildComment(123, '서울 데이터 보고서 오류'));
"
```
Expected:
```
## 🤖 제안

**브랜치**: `feat/123-서울-데이터-보고서-오류`
**커밋 메시지**: `feat: 서울 데이터 보고서 오류 (#123)`
```

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/issue-helper.yml
git commit -m "feat: issue-helper 워크플로우 추가"
```

---

### Task 5: 테스트 CI 워크플로우 추가

**Files:**
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: `package.json`의 `npm test` 스크립트 (Task 1)

- [ ] **Step 1: CI 워크플로우 작성**

`.github/workflows/test.yml`:

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: 테스트 실행
        run: npm test
```

- [ ] **Step 2: YAML 문법 검증**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/test.yml'); puts 'valid'"`
Expected: `valid`

- [ ] **Step 3: 로컬에서 npm test 재확인**

Run: `npm test`
Expected: PASS (10 tests, 모든 assertion 통과)

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/test.yml
git commit -m "ci: 테스트 워크플로우 추가"
```

---

## 이 계획 밖의 작업 (수동 확인 필요)

- GitHub 원격 저장소 생성 및 push는 이 계획에 포함하지 않는다 (사용자가 로컬 우선 진행을 선택함). push 전 원격 저장소 생성 여부를 사용자에게 다시 확인한다.
- 실제 GitHub 이슈를 열어 코멘트가 정상적으로 달리는지 확인하는 End-to-End 테스트는 레포가 GitHub에 올라간 뒤에만 가능하므로, push 이후 별도로 진행한다.
