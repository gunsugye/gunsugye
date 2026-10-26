# 자동 배포

이 PC에서 한 번 계정을 연결하면 아래 한 명령으로 빌드 → 테스트 → Apps Script 기존 배포 갱신 → Cloudflare Worker 갱신 → GitHub 공개 파일 커밋 → Pages 완료 확인까지 진행합니다.

```powershell
.\tools\node.exe scripts/deploy.mjs --publish
```

실제 서버를 바꾸지 않고 검증만 하려면 `--dry-run`, 계정 연결과 대상 확인만 하려면 `--check`를 사용합니다. 실행 중 실패하면 그 단계에서 중단합니다. 앞 단계가 성공한 경우 이미 적용된 변경이 있을 수 있으므로 오류를 확인한 뒤 다시 실행합니다. 저장소가 다른 곳에서 변경되면 강제 덮어쓰기를 하지 않습니다.

화면이나 안내 문서만 수정한 경우 `--publish-site`로 GitHub Pages만 갱신할 수 있습니다. 서버 기능도 바뀐 업데이트에는 `--publish`를 사용합니다.

## 최초 연결

```powershell
.\tools\node.exe scripts/deploy.mjs --login-github
.\tools\node.exe scripts/deploy.mjs --login-google
.\tools\node.exe scripts/deploy.mjs --login-cloudflare
```

GitHub는 `gunsugye` 저장소 쓰기 권한과 Actions 파일 갱신 권한이 필요합니다. Google은 새 API 프로젝트 소유자 계정으로 승인하고 [Apps Script 사용자 설정](https://script.google.com/home/usersettings)에서 Google Apps Script API를 켜야 합니다. Cloudflare는 기존 `logbook-api`가 있는 계정으로 승인합니다. 비밀번호·API 비밀값을 채팅에 입력하지 않습니다.

계정 인증 파일·배포 설정·원격 Apps Script 사전 백업은 `.deploy/`에만 보관하며 공개 업로드에서 제외합니다. `.deploy/config.json`에는 `repository`, `scriptId`, `deploymentId`를 지정합니다. Google 스크립트 속성의 데이터 연결·공유 비밀값은 변경하지 않습니다. 원격 매니페스트를 먼저 내려받아 보존하고, 실제 API Gateway와 Legacy 파일만 교체합니다.

Cloudflare 환경 변수는 `keep_vars`로 보존합니다. GitHub에는 `scripts/package.mjs`가 묶은 공개 파일만 업로드하며, 업무 원본과 Legacy는 Apps Script에만 업로드합니다. GitHub에 푸시한다고 Apps Script까지 자동 갱신되는 구성은 아니며, 이 PC의 위 명령이 세 서비스를 순서대로 갱신합니다.

참고: [clasp 공식 안내](https://github.com/google/clasp), [Wrangler 공식 명령](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [GitHub CLI 인증](https://cli.github.com/manual/gh_auth_login).
