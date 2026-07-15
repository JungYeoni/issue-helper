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

function buildComment(issueNumber, title) {
  const branch = buildBranchName(issueNumber, title);
  const commitMessage = buildCommitMessage(issueNumber, title);
  return `## 🤖 제안\n\n**브랜치**: \`${branch}\`\n**커밋 메시지**: \`${commitMessage}\`\n`;
}

module.exports = {
  slugify,
  buildBranchName,
  buildCommitMessage,
  buildComment,
  MAX_SLUG_LENGTH,
  COMMIT_TYPE,
};
