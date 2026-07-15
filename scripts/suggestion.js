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

module.exports = { slugify, MAX_SLUG_LENGTH, COMMIT_TYPE };
