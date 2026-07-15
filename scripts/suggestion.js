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

function buildBranchName(issueNumber, title) {
  return `${COMMIT_TYPE}/${issueNumber}-${slugify(title)}`;
}

function buildCommitMessage(issueNumber, title) {
  return `${COMMIT_TYPE}: ${title.trim()} (#${issueNumber})`;
}

function buildComment(issueNumber, title, createdAt) {
  const branch = buildBranchName(issueNumber, title);
  const commitMessage = buildCommitMessage(issueNumber, title);
  const date = createdAt.slice(0, 10).replace(/-/g, "");
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
