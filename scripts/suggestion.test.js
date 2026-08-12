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

test("resolveCommitType: 영어 키워드는 단어 경계로만 매칭한다 (prefix에 fix가 포함돼도 오탐 없음)", () => {
  assert.equal(resolveCommitType("커밋 prefix 규칙 변경"), "feat");
});

test("resolveCommitType: 영어 키워드는 단어 경계로만 매칭한다 (debug에 bug가 포함돼도 오탐 없음)", () => {
  assert.equal(resolveCommitType("Add debug logging to parser"), "feat");
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
