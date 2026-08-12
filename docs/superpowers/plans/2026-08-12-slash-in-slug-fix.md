# 슬러그 내 슬래시로 인한 브랜치명 충돌 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이슈 제목의 `/`가 브랜치명 slug에 그대로 남아 git 브랜치 경로 충돌(`refs/heads/A`와 `refs/heads/A/B` 동시 존재 불가)을 일으키는 버그를 고친다.

**Architecture:** `scripts/suggestion.js`의 `slugify` 함수에서 공백을 구분자로 치환하는 정규식에 `/`를 포함시킨다. `buildCommitMessage`는 건드리지 않는다 (커밋 메시지는 git ref가 아니므로 `/`가 있어도 문제없음).

**Tech Stack:** Node.js 내장 `node:test`/`node:assert/strict`. 외부 의존성 없음.

## Global Constraints

- `/`는 공백과 동일하게 구분자(`_`)로 치환한다. 단순 삭제(단어가 붙어버림)는 하지 않는다. (spec: 수정 규칙)
- 변경 범위는 `slugify`(브랜치명 slug)에만 한정한다. `buildCommitMessage`의 원본 제목 텍스트는 그대로 둔다. (spec: 변경 범위)
- 처리 순서상 `/` 치환은 이모지·대괄호 태그 제거보다 뒤에 있어서, 그 두 단계 이후에 남은 `/`도 동일하게 처리된다. (spec: 엣지 케이스)

---

### Task 1: `/`를 슬러그 구분자로 치환

**Files:**
- Modify: `scripts/suggestion.js:38`
- Modify: `scripts/suggestion.test.js`

**Interfaces:**
- Consumes: 없음 (기존 모듈 내부 함수만 사용)
- Produces: `slugify(title: string): string` — `/`가 포함된 제목에서 `/`가 `_`로 치환된 결과 반환 (기존 시그니처 유지). `buildBranchName`/`buildCommitMessage`/`buildComment`는 변경 없이 이 동작을 그대로 물려받는다.

- [ ] **Step 1: 실패하는 테스트를 `scripts/suggestion.test.js`에 추가**

`resolveCommitType: 여러 키워드가 동시에 있으면 우선순위(fix > refactor)를 따른다` 테스트 바로 다음(대괄호 태그 관련 테스트들과 나란히 두는 게 자연스러우니 `이모지와 맨 앞 대괄호 태그가 함께 있으면 둘 다 제거된다` 테스트 다음)에 아래 5개 테스트를 추가한다:

```javascript
test("슬래시는 언더스코어로 치환된다 (브랜치명 경로 충돌 방지)", () => {
  assert.equal(slugify("README/이슈템플릿"), "README_이슈템플릿");
});

test("연속된 슬래시와 공백이 섞여도 구분자 하나로 축약된다", () => {
  assert.equal(slugify("A/B/C 정리"), "A_B_C_정리");
});

test("슬래시 앞뒤에 공백이 있어도 구분자 하나로 축약된다", () => {
  assert.equal(slugify("README / 이슈템플릿"), "README_이슈템플릿");
});

test("슬래시로만 구성된 제목은 untitled가 된다", () => {
  assert.equal(slugify("///"), "untitled");
});

test("브랜치명에는 더 이상 슬래시가 남지 않는다 (git ref 경로 충돌 방지)", () => {
  assert.equal(
    buildBranchName(8, "README/이슈템플릿", "2026-08-12T00:00:00Z"),
    "feat/20260812_#8_README_이슈템플릿"
  );
});

test("커밋 메시지의 원본 제목에는 슬래시가 그대로 남는다 (git ref가 아니므로 범위 외)", () => {
  assert.equal(buildCommitMessage(8, "README/이슈템플릿"), "feat: README/이슈템플릿 (#8)");
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `slugify`/`buildBranchName` 관련 새 테스트 4개(슬래시 치환, 연속 슬래시+공백, 앞뒤 공백 포함 슬래시, 브랜치명 경로)가 실패한다. `/`가 아직 구분자로 치환되지 않아 결과에 `/`가 그대로 남기 때문이다. `"///"` → `untitled` 테스트와 커밋 메시지 테스트는 이미 통과할 수 있다 (현재 로직으로도 우연히 같은 결과가 나올 수 있음 — 실패 목록에 없어도 정상).

- [ ] **Step 3: `scripts/suggestion.js:38`의 정규식을 수정**

기존:
```javascript
  s = s.replace(/\s+/g, "_");
```

변경 후:
```javascript
  s = s.replace(/[\s/]+/g, "_");
```

(`slugify` 함수의 다른 줄은 전혀 손대지 않는다. 이 한 줄만 바뀐다.)

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 전체 42개 테스트(기존 36개 + 신규 6개) 통과.

- [ ] **Step 5: 커밋**

```bash
git add scripts/suggestion.js scripts/suggestion.test.js
git commit -m "fix: 슬러그의 슬래시를 언더스코어로 치환해 브랜치명 경로 충돌 방지"
```

---

## Self-Review 결과

- **Spec coverage:** 수정 규칙(`/`를 구분자로 치환, 삭제 아님), 변경 범위(`slugify`만, `buildCommitMessage` 제외), 예시 표의 3개 케이스, 엣지 케이스(`/`만 있는 제목 → `untitled`) 모두 Task 1의 테스트로 커버됨.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령/정확한 문자열 포함.
- **Type/signature consistency:** `slugify`/`buildBranchName`/`buildCommitMessage`/`buildComment` 시그니처 변경 없음. 정규식 한 줄만 수정되므로 다른 함수와의 인터페이스 영향 없음.
- **회귀 확인:** 기존 36개 테스트 픽스처 중 `/`가 포함된 제목은 없어서, 이번 변경으로 기존 테스트 기대값이 바뀌는 항목은 없음 (신규 테스트만 추가됨).
