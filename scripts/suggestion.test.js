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

test("국기 이모지(지역 표시 문자)는 제거하지 않는다", () => {
  assert.equal(slugify("🇰🇷 한국 이슈"), "🇰🇷_한국_이슈");
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

test("커밋 메시지에서 제목이 이모지로만 구성되면 untitled로 대체된다", () => {
  assert.equal(buildCommitMessage(70, "🔥🔥"), "feat: untitled (#70)");
});

test("코멘트 템플릿을 생성한다", () => {
  const comment = buildComment(123, "서울 데이터 보고서 오류", "2026-07-15T09:00:00Z");
  assert.equal(
    comment,
    "## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n```\n20260715\n```\n\n### 브랜치\n\n```\nfeat/20260715_#123_서울_데이터_보고서_오류\n```\n\n### 커밋 메시지\n\n```\nfeat: 서울 데이터 보고서 오류 (#123)\n```\n"
  );
});
