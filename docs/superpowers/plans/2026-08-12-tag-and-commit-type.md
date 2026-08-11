# 대괄호 태그 제거 및 커밋 타입 자동 분류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이슈 제목 맨 앞의 대괄호 태그(`[도구]` 등)를 브랜치명/커밋 메시지에서 제거하고, 제목에 포함된 키워드로 커밋 타입(`feat`/`fix`/`refactor`/`docs`/`chore`)을 자동 분류한다.

**Architecture:** `scripts/suggestion.js`에 `removeLeadingBracketTag(text)`와 `resolveCommitType(title)` 두 함수를 추가한다. 기존 고정 `COMMIT_TYPE` 상수를 제거하고 `COMMIT_TYPE_RULES`(우선순위 배열) + `DEFAULT_COMMIT_TYPE`으로 대체한다. `slugify`/`buildBranchName`/`buildCommitMessage`가 이 두 함수를 사용하도록 수정한다.

**Tech Stack:** Node.js 내장 `node:test`/`node:assert/strict`. 외부 의존성 없음.

## Global Constraints

- 대괄호 태그 제거는 제목 맨 앞(선행 공백 허용)의 `[...]` 하나만 대상. 내용 상관없이 통째로 제거. 제목 중간의 대괄호는 건드리지 않는다 (기존처럼 `[`/`]` 문자만 특수문자 제거 로직으로 지워짐). (spec: 대괄호 태그 제거 규칙)
- 태그 제거는 `removeEmoji()` 다음 순서로 적용한다 (이모지가 태그보다 앞에 있으면 이모지부터 지워야 태그가 "맨 앞"이 됨). (spec: 대괄호 태그 제거 규칙)
- 커밋 타입은 **원본 제목 전체**(trim만 적용, 이모지/태그 제거 이전)에서 키워드를 대소문자 구분 없이 부분 문자열로 검색해 결정한다. 우선순위: `fix`(버그/오류/에러/bug/fix/error) → `refactor`(리팩토링/refactor) → `docs`(문서/docs) → `chore`(기타/chore) → 매칭 없으면 `feat`. (spec: 커밋 타입 분류 규칙)
- 이 타입이 브랜치명 접두사와 커밋 메시지 접두사 둘 다에 적용된다. (spec: 변경 범위)
- `COMMIT_TYPE` 상수는 제거하고 `COMMIT_TYPE_RULES`/`DEFAULT_COMMIT_TYPE`으로 대체, `module.exports`도 갱신한다. (spec: 구현 방식)

---

### Task 1: 태그 제거 + 커밋 타입 분류 구현, 문서 갱신

**Files:**
- Modify: `scripts/suggestion.js`
- Modify: `scripts/suggestion.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음 (기존 모듈 내부 함수만 사용)
- Produces:
  - `removeLeadingBracketTag(text: string): string` — 내부 헬퍼, 외부에는 노출 안 함
  - `resolveCommitType(title: string): string` — `module.exports`에 추가, `"feat"|"fix"|"refactor"|"docs"|"chore"` 중 하나 반환
  - `slugify(title: string): string` — 맨 앞 대괄호 태그가 제거된 결과 반환 (기존 시그니처 유지)
  - `buildBranchName(issueNumber, title, createdAt): string` — 접두사가 `resolveCommitType(title)` 결과로 바뀜 (기존 시그니처 유지)
  - `buildCommitMessage(issueNumber, title): string` — 접두사가 `resolveCommitType(title)` 결과로 바뀌고, 정리 파이프라인에 태그 제거가 추가됨 (기존 시그니처 유지)
  - `COMMIT_TYPE_RULES`, `DEFAULT_COMMIT_TYPE` — `module.exports`에 추가 (기존 `COMMIT_TYPE`는 제거)

**중요:** 기존 테스트 픽스처 `"서울 데이터 보고서 오류"`에 `"오류"`라는 fix 키워드가 이미 들어있다. 이 제목을 쓰는 기존 `buildBranchName`/`buildCommitMessage`/`buildComment` 테스트 3개는 이번 변경으로 결과가 `feat`에서 `fix`로 바뀐다 — 버그가 아니라 새 분류 로직이 제대로 동작하는 증거다. 아래 Step 1의 테스트 파일에 이미 반영돼 있다.

- [ ] **Step 1: 실패하는 테스트로 `scripts/suggestion.test.js` 전체를 교체**

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  slugify,
  buildBranchName,
  buildCommitMessage,
  buildComment,
  resolveCommitType,
} = require("./suggestion.js");

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

test("국기 이모지(지역 표시 문자)는 제거하지 않는다", () => {
  assert.equal(slugify("🇰🇷 한국 이슈"), "🇰🇷_한국_이슈");
});

test("맨 앞 대괄호 태그는 내용 상관없이 통째로 제거된다", () => {
  assert.equal(slugify("[도구] 텍스트 처리 안됨"), "텍스트_처리_안됨");
});

test("제목 중간의 대괄호는 제거되지 않고 내용만 남는다 (괄호 문자만 특수문자 규칙으로 제거)", () => {
  assert.equal(slugify("결측치 확인 [보류]"), "결측치_확인_보류");
});

test("이모지와 맨 앞 대괄호 태그가 함께 있으면 둘 다 제거된다", () => {
  assert.equal(slugify("🛠️ [도구] 스크립트가 텍스트를 못 읽는 버그"), "스크립트가_텍스트를_못_읽는_버그");
});

test("resolveCommitType: 버그/오류 키워드가 있으면 fix", () => {
  assert.equal(resolveCommitType("버그 수정 요청"), "fix");
});

test("resolveCommitType: 영어 키워드도 대소문자 구분 없이 인식한다", () => {
  assert.equal(resolveCommitType("Bug: 로그인 실패"), "fix");
});

test("resolveCommitType: 리팩토링 키워드가 있으면 refactor", () => {
  assert.equal(resolveCommitType("리팩토링 필요"), "refactor");
});

test("resolveCommitType: 문서 키워드가 있으면 docs", () => {
  assert.equal(resolveCommitType("문서 업데이트"), "docs");
});

test("resolveCommitType: 기타 키워드가 있으면 chore", () => {
  assert.equal(resolveCommitType("기타 작업"), "chore");
});

test("resolveCommitType: 매칭되는 키워드가 없으면 feat", () => {
  assert.equal(resolveCommitType("새 기능 추가"), "feat");
});

test("resolveCommitType: 여러 키워드가 동시에 있으면 우선순위(fix > refactor)를 따른다", () => {
  assert.equal(resolveCommitType("버그 리팩토링"), "fix");
});

test("이슈 생성일/번호/slug로 브랜치명을 만든다 (제목의 '오류' 키워드로 fix 분류됨)", () => {
  assert.equal(
    buildBranchName(123, "서울 데이터 보고서 오류", "2026-07-15T09:00:00Z"),
    "fix/20260715_#123_서울_데이터_보고서_오류"
  );
});

test("브랜치명의 slug는 50자를 넘으면 잘리지만 날짜/이슈번호 세그먼트는 영향받지 않는다", () => {
  const longTitle = "가".repeat(60);
  const branch = buildBranchName(70, longTitle, "2026-08-04T00:00:00Z");
  assert.equal(branch, `feat/20260804_#70_${"가".repeat(50)}`);
});

test("브랜치명 접두사는 resolveCommitType 결과를 그대로 쓴다", () => {
  assert.equal(
    buildBranchName(50, "버그 수정 요청", "2026-08-12T00:00:00Z"),
    "fix/20260812_#50_버그_수정_요청"
  );
});

test("커밋 메시지는 원본 제목을 유지한다 (제목의 '오류' 키워드로 fix 분류됨)", () => {
  assert.equal(buildCommitMessage(123, "서울 데이터 보고서 오류"), "fix: 서울 데이터 보고서 오류 (#123)");
});

test("커밋 메시지는 제목 앞뒤 공백을 정리한다", () => {
  assert.equal(buildCommitMessage(5, "  오타 수정  "), "feat: 오타 수정 (#5)");
});

test("커밋 메시지에서 이모지를 제거하고 남은 연속 공백을 하나로 축약한다 (제목의 '버그' 키워드로 fix 분류됨)", () => {
  assert.equal(buildCommitMessage(70, "🔥 버그 수정"), "fix: 버그 수정 (#70)");
});

test("커밋 메시지에서 공백 없이 붙은 이모지도 제거한다 (제목의 '버그' 키워드로 fix 분류됨)", () => {
  assert.equal(buildCommitMessage(5, "🔥버그"), "fix: 버그 (#5)");
});

test("커밋 메시지에서 제목이 이모지로만 구성되면 untitled로 대체된다", () => {
  assert.equal(buildCommitMessage(70, "🔥🔥"), "feat: untitled (#70)");
});

test("커밋 메시지 접두사는 resolveCommitType 결과를 그대로 쓴다", () => {
  assert.equal(buildCommitMessage(50, "버그 수정 요청"), "fix: 버그 수정 요청 (#50)");
});

test("코멘트 템플릿을 생성한다 (제목의 '오류' 키워드로 fix 분류됨)", () => {
  const comment = buildComment(123, "서울 데이터 보고서 오류", "2026-07-15T09:00:00Z");
  assert.equal(
    comment,
    "## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n```\n20260715\n```\n\n### 브랜치\n\n```\nfix/20260715_#123_서울_데이터_보고서_오류\n```\n\n### 커밋 메시지\n\n```\nfix: 서울 데이터 보고서 오류 (#123)\n```\n"
  );
});

test("코멘트 템플릿: 이모지 제거 + 대괄호 태그 제거 + 커밋 타입 분류가 함께 동작한다", () => {
  const comment = buildComment(7, "🛠️ [도구] 스크립트가 텍스트를 못 읽는 버그", "2026-08-12T00:00:00Z");
  assert.equal(
    comment,
    "## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n```\n20260812\n```\n\n### 브랜치\n\n```\nfix/20260812_#7_스크립트가_텍스트를_못_읽는_버그\n```\n\n### 커밋 메시지\n\n```\nfix: 스크립트가 텍스트를 못 읽는 버그 (#7)\n```\n"
  );
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — 새로 추가한 `resolveCommitType` 테스트들은 함수 자체가 없어서 실패하고, `"오류"`/`"버그"` 키워드가 들어간 기존 제목을 쓰는 `buildBranchName`/`buildCommitMessage`/`buildComment` 테스트들은 여전히 `feat`를 반환해서 실패한다. 대괄호 태그 관련 `slugify` 테스트 3개도 태그가 안 지워져서 실패한다.

- [ ] **Step 3: `scripts/suggestion.js`를 아래 내용으로 교체**

```javascript
const MAX_SLUG_LENGTH = 50;
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]/gu;
const COMMIT_TYPE_RULES = [
  { type: "fix", keywords: ["버그", "오류", "에러", "bug", "fix", "error"] },
  { type: "refactor", keywords: ["리팩토링", "refactor"] },
  { type: "docs", keywords: ["문서", "docs"] },
  { type: "chore", keywords: ["기타", "chore"] },
];
const DEFAULT_COMMIT_TYPE = "feat";

function removeEmoji(text) {
  return text.replace(EMOJI_REGEX, "");
}

function removeLeadingBracketTag(text) {
  return text.replace(/^\s*\[[^\]]*\]\s*/, "");
}

function resolveCommitType(title) {
  const normalized = title.trim().toLowerCase();
  for (const rule of COMMIT_TYPE_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return rule.type;
    }
  }
  return DEFAULT_COMMIT_TYPE;
}

function slugify(title) {
  let s = title.trim();
  s = removeEmoji(s);
  s = removeLeadingBracketTag(s);
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
  const commitType = resolveCommitType(title);
  return `${commitType}/${formatDate(createdAt)}_#${issueNumber}_${slugify(title)}`;
}

function buildCommitMessage(issueNumber, title) {
  const commitType = resolveCommitType(title);
  const cleaned = removeLeadingBracketTag(removeEmoji(title.trim())).replace(/\s+/g, " ").trim();
  return `${commitType}: ${cleaned.length > 0 ? cleaned : "untitled"} (#${issueNumber})`;
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
  resolveCommitType,
  MAX_SLUG_LENGTH,
  COMMIT_TYPE_RULES,
  DEFAULT_COMMIT_TYPE,
};
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 전체 34개 테스트(기존 21개, 그중 6개는 기대값이 `fix`로 갱신됨 + 신규 13개) 통과.

- [ ] **Step 5: `README.md` 3곳 갱신**

**5-1. "동작 방식" 예시 블록** (현재 11번째 줄 근처, `feat/20260715_#123_...`와 `feat: 서울...` 두 줄) — 제목 `"서울 데이터 보고서 오류"`가 이제 `fix`로 분류되므로 두 줄 다 접두사를 바꾼다:

```
feat/20260715_#123_서울_데이터_보고서_오류
```
→
```
fix/20260715_#123_서울_데이터_보고서_오류
```

그리고
```
feat: 서울 데이터 보고서 오류 (#123)
```
→
```
fix: 서울 데이터 보고서 오류 (#123)
```

**5-2. "생성 규칙" 표**를 아래로 전체 교체한다 (기존 표는 "날짜"/"브랜치명"/"커밋 메시지"/"slug" 4행):

```markdown
| 항목        | 규칙                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 날짜        | 이슈 생성일(`issue.created_at`)을 `YYYYMMDD` 형식으로 표기                                                                                              |
| 커밋 타입   | 제목에 포함된 키워드로 자동 분류(`fix`/`refactor`/`docs`/`chore`, 매칭 없으면 `feat`) — 아래 "커밋 타입 분류" 참고                                       |
| 브랜치명    | `feat/{날짜:YYYYMMDD}_#{이슈번호}_{slug}` (`feat` 자리는 위에서 분류한 커밋 타입)                                                                       |
| 커밋 메시지 | `feat: {원본 제목} (#{이슈번호})` — 이모지·맨 앞 대괄호 태그 제거·연속 공백 정리 후 사용 (slug화하지 않음) · 결과가 빈 문자열이면 `untitled`            |
| slug        | 한글 원문 유지(번역/로마자 변환 없음) · 이모지 제거 · 맨 앞 대괄호 태그 제거 · 브랜치명에 못 쓰는 문자 제거 · 공백은 `_`로 치환 · 최대 50자 · 결과가 빈 문자열이면 `untitled` |
```

바로 뒤에 새 하위 섹션을 추가한다:

```markdown
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
```

**5-3. "커스터마이징" 섹션**의 코드 블록을 아래로 교체한다:

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

이 코드 블록 바로 다음 줄에 설명 문장을 하나 추가한다: `COMMIT_TYPE_RULES` 배열에 항목을 추가/삭제/순서 변경하면 분류 규칙을 바꿀 수 있다 (배열 앞쪽일수록 우선순위가 높다).

- [ ] **Step 6: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js README.md
git commit -m "feat: 대괄호 태그 제거하고 제목 키워드로 커밋 타입 자동 분류"
```

---

## Self-Review 결과

- **Spec coverage:** 대괄호 태그 제거 규칙(맨 앞만, 이모지 다음 순서), 커밋 타입 분류 규칙(원본 제목 전체 스캔, 우선순위, 기본값), 브랜치명/커밋 메시지 양쪽 적용, `COMMIT_TYPE` 상수 교체 모두 Task 1에 반영됨. 스펙의 "엣지 케이스" 섹션(태그 없음/중간 대괄호/이모지+태그 조합/복수 키워드 우선순위/빈 slug)도 각각 대응하는 테스트가 있음.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령/정확한 문자열 포함.
- **Type/signature consistency:** `resolveCommitType(title)`가 `buildBranchName`/`buildCommitMessage` 양쪽에서 동일하게 호출됨. `removeLeadingBracketTag(text)`가 `slugify`와 `buildCommitMessage` 양쪽에서 동일한 시그니처로 쓰임. 기존 `slugify`/`buildBranchName`/`buildCommitMessage`/`buildComment`의 외부 시그니처(파라미터 개수·타입)는 변경 없음 — 이전 계획들과의 호환성 유지. `module.exports`에서 `COMMIT_TYPE` 제거, `resolveCommitType`/`COMMIT_TYPE_RULES`/`DEFAULT_COMMIT_TYPE` 추가가 테스트 파일의 require 구문과 일치.
- **기존 테스트 영향 확인:** `"서울 데이터 보고서 오류"`, `"🔥 버그 수정"`, `"🔥버그"` 세 픽스처가 `"오류"`/`"버그"` 키워드를 포함해 `fix`로 재분류됨을 확인하고 해당 테스트 3개의 기대값을 갱신함 (Step 1에 반영). `"  오타 수정  "`, `"가".repeat(60)`, `"🔥🔥"`는 매칭 키워드가 없어 `feat` 그대로 유지됨을 확인함.
