# issue-helper

이슈가 생성되면 규칙 기반으로 브랜치명과 커밋 메시지를 제안해 이슈 코멘트로 남기는 GitHub Actions 워크플로우.

## 동작

- `issues: opened` 이벤트에서 실행
- 이슈 제목/번호로 브랜치명(`feat/{번호}-{slug}`)과 커밋 메시지(`feat: {제목} (#{번호})`)를 생성
- 별도 API 키나 외부 서비스 없이 `actions/github-script`만으로 동작

## 설계 문서

[docs/superpowers/specs/2026-07-15-issue-helper-design.md](docs/superpowers/specs/2026-07-15-issue-helper-design.md)

## 사용법

`.github/workflows/issue-helper.yml`을 원하는 레포의 `.github/workflows/`에 복사하면 바로 동작한다.
