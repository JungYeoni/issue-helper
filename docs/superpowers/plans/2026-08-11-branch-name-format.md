# 브랜치명 포맷 변경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브랜치명 생성 로직을 `feat/{이슈번호}-{slug}`에서 `feat/{YYYYMMDD}_#{이슈번호}_{slug}`로 바꾼다 (구분자도 `-` → `_`).

**Architecture:** `scripts/suggestion.js`의 순수 함수(`slugify`, `buildBranchName`, `buildComment`)만 수정한다. 워크플로우 YAML, 커밋 메시지 포맷은 변경하지 않는다.

**Tech Stack:** Node.js 내장 `node:test`/`node:assert/strict`. 외부 의존성 없음.

## Global Constraints

- 브랜치명 포맷만 변경한다. 커밋 메시지 포맷(`feat: {원본 제목} (#{이슈번호})`)은 그대로 유지한다. (spec: 변경 범위)
- 날짜는 이슈 생성일(`createdAt`)을 `YYYYMMDD`로 표기하며, 코멘트 날짜 섹션과 동일한 변환 로직을 공유한다. (spec: 출력 규칙)
- slug 내부 단어 구분자는 `-`가 아닌 `_`를 쓴다. 공백 치환·연속 구분자 축약·앞뒤 트림 로직은 문자만 `_`로 바꾸고 동작은 동일하게 유지한다. (spec: 출력 규칙)
- `MAX_SLUG_LENGTH = 50` 제한은 slug 세그먼트에만 적용되고, 날짜·이슈번호 세그먼트는 길이 제한에 포함되지 않는다. (spec: 출력 규칙)
- 허용/제거 대상 특수문자 목록(`~ ^ : ? * [ ] \ " ' < > |`)은 변경하지 않는다. (spec: 구현 방식)

---

### Task 1: 브랜치명 포맷을 날짜+이슈번호+언더스코어 slug로 변경

**Files:**
- Modify: `scripts/suggestion.js`
- Modify: `scripts/suggestion.test.js`

**Interfaces:**
- Consumes: 없음 (기존 모듈 내부 함수만 사용)
- Produces:
  - `slugify(title: string): string` — 반환값의 단어 구분자가 `_`로 변경됨 (기존 시그니처 유지)
  - `buildBranchName(issueNumber: number, title: string, createdAt: string): string` — **시그니처 변경**: `createdAt` 파라미터 추가. 반환값 포맷 `feat/{YYYYMMDD}_#{issueNumber}_{slug}`
  - `buildComment(issueNumber, title, createdAt)`가 내부에서 `buildBranchName`을 새 시그니처로 호출 (외부 시그니처는 변경 없음)

- [ ] **Step 1: 실패하는 테스트로 `scripts/suggestion.test.js` 전체를 교체**

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { slugify, buildBranchName, buildCommitMessage, buildComment } = require("./suggestion.js");

test("한글 제목의 공백을 언더스코어로 치환한다", () => {
  assert.equal(slugify("서울 데이터 보고서 오류"), "서울_데이터_보고서_오류");
});

test("연속 공백은 언더스코어 하나로 축약한다", () => {
  assert.equal(slugify("서울   데이터    오류"), "서울_데이터_오류");
});

test("git 브랜치명에 쓸 수 없는 특수문자를 제거한다", () => {
  assert.equal(slugify("버그: [긴급] 오류?!"), "버그_긴급_오류!");
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

test("이슈 생성일/번호/slug로 브랜치명을 만든다", () => {
  assert.equal(
    buildBranchName(123, "서울 데이터 보고서 오류", "2026-07-15T09:00:00Z"),
    "feat/20260715_#123_서울_데이터_보고서_오류"
  );
});

test("브랜치명의 slug는 50자를 넘으면 잘리지만 날짜/이슈번호 세그먼트는 영향받지 않는다", () => {
  const longTitle = "가".repeat(60);
  const branch = buildBranchName(70, longTitle, "2026-08-04T00:00:00Z");
  assert.equal(branch, `feat/20260804_#70_${"가".repeat(50)}`);
});

test("커밋 메시지는 원본 제목을 유지한다", () => {
  assert.equal(buildCommitMessage(123, "서울 데이터 보고서 오류"), "feat: 서울 데이터 보고서 오류 (#123)");
});

test("커밋 메시지는 제목 앞뒤 공백을 정리한다", () => {
  assert.equal(buildCommitMessage(5, "  오타 수정  "), "feat: 오타 수정 (#5)");
});

test("코멘트 템플릿을 생성한다", () => {
  const comment = buildComment(123, "서울 데이터 보고서 오류", "2026-07-15T09:00:00Z");
  assert.equal(
    comment,
    "## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n```\n20260715\n```\n\n### 브랜치\n\n```\nfeat/20260715_#123_서울_데이터_보고서_오류\n```\n\n### 커밋 메시지\n\n```\nfeat: 서울 데이터 보고서 오류 (#123)\n```\n"
  );
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `slugify`/`buildBranchName`/`buildComment` 관련 다수 케이스가 기존 구현(하이픈 구분자, 날짜 세그먼트 없음)과 어긋나 실패. `buildBranchName` 호출 시 `createdAt` 인자를 받지 않는 기존 구현이라 새 포맷 테스트가 깨짐.

- [ ] **Step 3: `scripts/suggestion.js`를 아래 내용으로 교체**

```javascript
const MAX_SLUG_LENGTH = 50;
const COMMIT_TYPE = "feat";

function slugify(title) {
  let s = title.trim();
  s = s.replace(/\s+/g, "_");
  s = s.replace(/[~^:?*[\]\\"'<>|]/g, "");
  s = s.replace(/\.{2,}/g, "_");
  s = s.replace(/_{2,}/g, "_");
  s = s.replace(/^[_.]+|[_.]+$/g, "");
  if (s.length > MAX_SLUG_LENGTH) {
    s = s.slice(0, MAX_SLUG_LENGTH);
    s = s.replace(/^[_.]+|[_.]+$/g, "");
  }
  return s.length > 0 ? s : "untitled";
}

function formatDate(createdAt) {
  return createdAt.slice(0, 10).replace(/-/g, "");
}

function buildBranchName(issueNumber, title, createdAt) {
  return `${COMMIT_TYPE}/${formatDate(createdAt)}_#${issueNumber}_${slugify(title)}`;
}

function buildCommitMessage(issueNumber, title) {
  return `${COMMIT_TYPE}: ${title.trim()} (#${issueNumber})`;
}

function buildComment(issueNumber, title, createdAt) {
  const branch = buildBranchName(issueNumber, title, createdAt);
  const commitMessage = buildCommitMessage(issueNumber, title);
  const date = formatDate(createdAt);
  return `## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n\`\`\`\n${date}\n\`\`\`\n\n### 브랜치\n\n\`\`\`\n${branch}\n\`\`\`\n\n### 커밋 메시지\n\n\`\`\`\n${commitMessage}\n\`\`\`\n`;
}

module.exports = {
  slugify,
  buildBranchName,
  buildCommitMessage,
  buildComment,
  MAX_SLUG_LENGTH,
  COMMIT_TYPE,
};
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 전체 테스트(10개 기존 + 1개 신규 = 11개) 통과.

- [ ] **Step 5: README의 브랜치명 예시 갱신**

`README.md`에 하이픈 기반 브랜치명 예시가 3곳 있다 (동작 방식 코드블록, 생성 규칙 표, 커스터마이징 섹션 주변은 해당 없음). 아래처럼 새 포맷으로 갱신한다:

- 상단 "동작 방식" 예시 블록의 `feat/123-서울-데이터-보고서-오류` → `feat/20260715_#123_서울_데이터_보고서_오류`
- "생성 규칙" 표의 `브랜치명` 행 설명을 `feat/{이슈번호}-{slug}` → `feat/{날짜:YYYYMMDD}_#{이슈번호}-{slug}` 로, `slug` 행의 "공백은 `-`로 치환" → "공백은 `_`로 치환"으로 갱신

정확한 문자열은 `README.md`를 직접 열어 기존 표현을 확인한 뒤, 위 규칙에 맞춰 치환한다 (이 저장소에는 별도 자동 치환 스크립트가 없으므로 수동 편집).

- [ ] **Step 6: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js README.md
git commit -m "feat: 브랜치명에 이슈 생성일 세그먼트 추가하고 구분자를 언더스코어로 변경"
```

---

## Self-Review 결과

- **Spec coverage:** 출력 규칙(날짜 세그먼트, `_` 구분자, 50자 제한 범위), 구현 방식(formatDate 분리, buildBranchName 시그니처 변경, slugify 문자 교체), 엣지 케이스(untitled, 50자 초과) 모두 Task 1에 반영됨. 커밋 메시지 미변경(범위 외)도 그대로 유지해 spec과 일치.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령 포함.
- **Type/signature consistency:** `buildBranchName(issueNumber, title, createdAt)` 시그니처가 테스트·구현·`buildComment` 내부 호출 전부 동일.
