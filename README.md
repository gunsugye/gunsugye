# 군수계 업무일지

저장소: https://github.com/gunsugye/gunsugye

배포 후 접속할 주소: **https://gunsugye.github.io/gunsugye/**

기존 Google Sheets와 Apps Script 업무 기능을 유지하면서 화면을 GitHub Pages로 옮기는 이전 버전입니다. Google 계정으로 로그인하면 API 서버가 서명을 확인하고, 기존 관리자·편집자·중대별 권한으로 업무를 처리합니다.

```text
GitHub Pages 화면 → Cloudflare Workers API → Apps Script → 기존 Google Sheets
       Google 로그인         서명 검증             업무·권한 처리
```

처음 설정은 [DEPLOY.md](DEPLOY.md) 순서대로 진행하세요. Google OAuth 클라이언트 ID, Apps Script 배포 주소, Worker 주소를 연결하기 전에는 로그인 설정 안내 화면이 표시됩니다.

| 경로 | 용도 |
| --- | --- |
| `docs/` | GitHub Pages에 배포하는 화면 |
| `docs/config.js` | 공개 Google 클라이언트 ID·API 주소 |
| `api/worker.mjs` | Google 로그인 검증·CORS·서명된 서버 요청 |
| `api/wrangler.toml` | Cloudflare 배포 설정 |
| `apps-script/Gateway.gs` | Apps Script HTTP 진입점 |
| `apps-script/Legacy.gs` | 로컬에서 생성하는 비공개 업무 서버 코드 |
| `scripts/build.mjs` | 기존 두 원본으로 화면·비공개 업무 코드 생성 |

로컬 원본 `Code.gs.txt`에는 실제 명단을 복원하는 압축 초기 자료가 포함되어 있어 `.gitignore`로 제외했습니다. `apps-script/Legacy.gs`도 같은 자료를 포함하므로 GitHub에 올리지 않습니다. 화면과 게이트웨이만 담은 `release/github-upload`를 업로드에 사용할 수 있습니다. 이 폴더는 `node scripts/package.mjs`로 만듭니다.

원본 파일은 수정하지 않았습니다. 다시 생성하려면 로컬에 두 원본을 둔 상태에서 실행하세요.

```powershell
node scripts/build.mjs
node tests/run.mjs
node scripts/package.mjs
```

Node.js가 설치되어 있지 않은 현재 작업 PC에서는 `node` 대신 `.\tools\node.exe`를 사용할 수 있습니다. 원본은 GitHub에 없으므로 GitHub Actions는 재생성하지 않고, 이미 생성된 `docs/`를 검사하고 배포합니다. 원본을 재생성하면 `docs/assets/app.js`, `docs/assets/app.css`, `docs/index.html`, `apps-script/Legacy.gs`를 덮어씁니다. 연결 설정과 로그인 어댑터는 유지됩니다.

로그인 토큰은 메모리에만 보관합니다. 새로고침하면 다시 로그인합니다. 로그인 만료 후에는 새로고침하고 로그인하세요. 이전 사용자 데이터가 새 계정으로 이어지지 않도록 화면을 다시 시작합니다. 기존 사용자별 알림 확인 상태는 새 저장 공간에서 시작하며 업무 데이터는 유지됩니다.

실제 Google Sheets 조회·저장, Google 로그인 팝업, Cloudflare 배포는 계정 설정을 마친 뒤 확인해야 합니다. 최초에는 복제한 테스트 시트로 조회·저장·삭제·권한별 접근을 점검하고 운영 시트로 연결하세요.
