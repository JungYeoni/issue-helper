# [Design] 이슈 제목 이모지 제거 — 2026-08-11

## 목적

이슈 제목에 이모지가 포함된 경우, 브랜치명(slug)과 커밋 메시지 양쪽에서 이모지를 제거한다. 이모지가 그대로 들어가면 브랜치명 가독성이 떨어지고, 파일시스템/터미널/일부 git 도구에서 렌더링이 깨지는 경우가 있기 때문이다.

## 변경 범위

- `slugify(title)` — slug(브랜치명에 쓰이는 부분)에서 이모지 제거
- `buildCommitMessage(issueNumber, title)` — 커밋 메시지에 쓰이는 원본 제목에서도 이모지 제거

이모지 제거 후 그 자리에 남는 연속 공백은 하나로 축약한다.

## 이모지 판별 방법

`\p{Emoji}` 유니코드 속성은 숫자(`0`-`9`)와 `#`, `*` 문자도 포함한다 (키캡 이모지 시퀀스용으로 지정돼 있어서). 이 속성을 그대로 쓰면 제목에 있는 일반 숫자까지 지워지는 문제가 생긴다.

대신 `\p{Extended_Pictographic}` 속성을 쓴다 — 실제 그림문자(이모지)만 매치하고 숫자/기호는 매치하지 않는다. 여기에 이모지 조합에 쓰이는 다음 문자들을 추가로 제거 대상에 포함한다:

- `‍` (Zero Width Joiner) — 복합 이모지(예: 👨‍👩‍👧) 결합자
- `️` (Variation Selector-16) — 이모지 표시 지정자 (예: ❤️의 뒤에 붙는 문자)
- `\u{1F3FB}`–`\u{1F3FF}` (피부색 수식자, Fitzpatrick modifiers)

```javascript
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu;

function removeEmoji(text) {
  return text.replace(EMOJI_REGEX, "");
}
```

## 구현 방식

- `removeEmoji(text)` 헬퍼를 `scripts/suggestion.js`에 추가하고 `slugify`, `buildCommitMessage` 양쪽에서 재사용한다.
- `slugify(title)`: `trim()` 직후 `removeEmoji()`를 적용한다. 이모지 제거로 생기는 빈 공백은 기존 "연속 공백 → 구분자 하나로 축약" 로직이 그대로 처리하므로 별도 공백 정리가 필요 없다.
- `buildCommitMessage(issueNumber, title)`: `removeEmoji(title.trim())` 실행 후 연속 공백(`\s+`)을 단일 공백으로 축약하고 다시 `trim()`한다 (선행 공백이 이모지 자리에 남을 수 있어서 마지막 trim이 필요).

## 예시

제목 `"🔥 버그 수정"`, 이슈 #70, 생성일 2026-08-04

| 항목 | 결과 |
|---|---|
| 브랜치명 | `feat/20260804_#70_버그_수정` |
| 커밋 메시지 | `feat: 버그 수정 (#70)` |

## 엣지 케이스

- 제목이 이모지로만 구성된 경우 → slug는 기존 로직대로 빈 문자열이 되어 `untitled`로 대체된다 (예: `feat/20260804_#70_untitled`). 커밋 메시지도 slug와 동일하게 `untitled`로 대체된다 (예: `feat: untitled (#70)`).
- 이모지 사이에 공백이 없던 경우(예: `"버그🔥긴급"`) → 이모지만 제거되고 단어는 그대로 붙는다 (`버그긴급`). 인위적으로 구분자를 끼워 넣지 않는다.

## 범위 외 (Out of scope)

- 국기 이모지(지역 표시 문자, 예: 🇰🇷)는 `Extended_Pictographic` 속성에 포함되지 않아 이번 정규식으로는 제거되지 않는다. 필요 시 별도 요청으로 추가한다.
