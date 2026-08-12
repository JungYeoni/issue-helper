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

function matchesKeyword(normalized, keyword) {
  if (!/^[a-z]+$/.test(keyword)) return normalized.includes(keyword);
  return new RegExp(`\\b${keyword}\\b`).test(normalized);
}

function resolveCommitType(title) {
  const normalized = title.trim().toLowerCase();
  for (const rule of COMMIT_TYPE_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(normalized, keyword.toLowerCase()))) {
      return rule.type;
    }
  }
  return DEFAULT_COMMIT_TYPE;
}

function slugify(title) {
  let s = title.trim();
  s = removeEmoji(s);
  s = removeLeadingBracketTag(s);
  s = s.replace(/[\s/]+/g, "_");
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
