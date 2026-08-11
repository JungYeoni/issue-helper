# 이슈 제목 이모지 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이슈 제목에 이모지가 포함돼 있으면 브랜치명(slug)과 커밋 메시지 양쪽에서 이모지를 제거한다.

**Architecture:** `scripts/suggestion.js`에 `removeEmoji(text)` 공용 헬퍼를 추가하고, `slugify`와 `buildCommitMessage` 양쪽에서 재사용한다. 이모지 제거로 생기는 연속 공백은 각 함수의 기존/신규 공백 정리 로직으로 축약한다.

**Tech Stack:** Node.js 내장 `node:test`/`node:assert/strict`, ES2018+ 정규식 Unicode 속성 escape(`\p{Extended_Pictographic}`, `u` 플래그). 외부 의존성 없음.

## Global Constraints

- 이모지 판별은 `\p{Extended_Pictographic}` 속성을 쓴다. `\p{Emoji}`는 숫자(`0`-`9`)와 `#`, `*`도 매치해버리는 함정이 있어 쓰지 않는다. (spec: 이모지 판별 방법)
- 이모지 조합에 쓰이는 다음 문자도 함께 제거 대상에 포함한다: ZWJ(`‍`), Variation Selector-16(`️`), 피부색 수식자(`\u{1F3FB}`–`\u{1F3FF}`). (spec: 이모지 판별 방법)
- 적용 범위는 `slugify`(브랜치명 slug)와 `buildCommitMessage`(커밋 메시지) 양쪽. (spec: 변경 범위)
- 이모지 제거 후 남는 연속 공백은 하나로 축약한다. `buildCommitMessage`는 축약 후 다시 `trim()`한다 (이모지가 제목 끝에 있으면 선행 공백이 남을 수 있음). (spec: 구현 방식)
- 제목이 이모지로만 구성돼 slug가 빈 문자열이 되면 기존 로직대로 `untitled`로 대체된다. (spec: 엣지 케이스)
- 국기 이모지(지역 표시 문자)는 이번 범위에서 제거하지 않는다. (spec: 범위 외)

---

### Task 1: `removeEmoji` 헬퍼 추가하고 slugify/buildCommitMessage에 적용

**Files:**
- Modify: `scripts/suggestion.js`
- Modify: `scripts/suggestion.test.js`

**Interfaces:**
- Consumes: 없음 (기존 모듈 내부 함수만 사용)
- Produces:
  - `removeEmoji(text: string): string` — 내부 헬퍼, `module.exports`에는 포함하지 않음 (외부에서 쓸 일 없음)
  - `slugify(title: string): string` — 반환값에서 이모지가 제거됨 (기존 시그니처·다른 동작은 변경 없음)
  - `buildCommitMessage(issueNumber: number, title: string): string` — 반환값에서 이모지가 제거됨 (기존 시그니처는 변경 없음)

- [ ] **Step 1: 실패하는 테스트를 `scripts/suggestion.test.js`에 추가**

파일 전체를 아래 내용으로 교체한다 (기존 테스트 유지 + 이모지 관련 테스트 8개 추가):

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

test("공백을 동반한 이모지는 제거되고 남은 공백은 구분자 하나로 축약된다", () => {
  assert.equal(slugify("🔥 버그 수정"), "버그_수정");
});

test("공백 없이 붙은 이모지는 제거만 되고 단어는 그대로 붙는다", () => {
  assert.equal(slugify("버그🔥긴급"), "버그긴급");
});

test("ZWJ로 결합된 복합 이모지를 전부 제거한다", () => {
  assert.equal(slugify("가족👨‍👩‍👧 사진"), "가족_사진");
});

test("variation selector가 붙은 이모지를 제거한다", () => {
  assert.equal(slugify("사랑❤️해요"), "사랑해요");
});

test("피부색 수식자가 붙은 이모지를 제거한다", () => {
  assert.equal(slugify("좋아요👍🏽"), "좋아요");
});

test("이모지로만 구성된 제목은 untitled가 된다", () => {
  assert.equal(slugify("🔥🔥"), "untitled");
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

test("커밋 메시지에서 이모지를 제거하고 남은 연속 공백을 하나로 축약한다", () => {
  assert.equal(buildCommitMessage(70, "🔥 버그 수정"), "feat: 버그 수정 (#70)");
});

test("커밋 메시지에서 공백 없이 붙은 이모지도 제거한다", () => {
  assert.equal(buildCommitMessage(5, "🔥버그"), "feat: 버그 (#5)");
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
Expected: FAIL — 새로 추가한 이모지 관련 테스트 8개가 실패. `slugify`/`buildCommitMessage`가 아직 이모지를 제거하지 않으므로 결과 문자열에 이모지가 그대로 남아 기대값과 불일치.

- [ ] **Step 3: `scripts/suggestion.js`를 아래 내용으로 교체**

```javascript
const MAX_SLUG_LENGTH = 50;
const COMMIT_TYPE = "feat";
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu;

function removeEmoji(text) {
  return text.replace(EMOJI_REGEX, "");
}

function slugify(title) {
  let s = title.trim();
  s = removeEmoji(s);
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
  const cleaned = removeEmoji(title.trim()).replace(/\s+/g, " ").trim();
  return `${COMMIT_TYPE}: ${cleaned} (#${issueNumber})`;
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
Expected: PASS — 전체 테스트(기존 11개 + 신규 8개 = 19개) 통과.

- [ ] **Step 5: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js
git commit -m "feat: 이슈 제목에서 이모지 제거 (브랜치명, 커밋 메시지)"
```

---

## Self-Review 결과

- **Spec coverage:** 이모지 판별 방법(`\p{Extended_Pictographic}` + ZWJ/VS16/피부색 수식자), 적용 범위(slug + 커밋 메시지), 공백 축약 규칙, `untitled` 폴백 엣지 케이스 모두 Task 1의 테스트·구현에 반영됨.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령 포함.
- **Type/signature consistency:** `removeEmoji(text)`가 `slugify`와 `buildCommitMessage` 양쪽에서 동일한 시그니처로 호출됨. 기존 `slugify`/`buildCommitMessage`/`buildBranchName`/`buildComment`의 외부 시그니처는 변경 없음 — 이전 계획(브랜치명 포맷 변경)과의 호환성 유지.
