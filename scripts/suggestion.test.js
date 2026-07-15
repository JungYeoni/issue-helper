const { test } = require("node:test");
const assert = require("node:assert/strict");
const { slugify, buildBranchName, buildCommitMessage, buildComment } = require("./suggestion.js");

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

test("이슈 번호와 slug로 브랜치명을 만든다", () => {
  assert.equal(buildBranchName(123, "서울 데이터 보고서 오류"), "feat/123-서울-데이터-보고서-오류");
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
    "## Guide by YEONI-ISSUE-HELPER\n\n### 날짜\n\n```\n20260715\n```\n\n### 브랜치\n\n```\nfeat/123-서울-데이터-보고서-오류\n```\n\n### 커밋 메시지\n\n```\nfeat: 서울 데이터 보고서 오류 (#123)\n```\n"
  );
});
