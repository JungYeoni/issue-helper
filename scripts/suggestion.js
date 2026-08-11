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
