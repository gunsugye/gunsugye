# gunsugye/gunsugye 배포 안내

목표 주소는 **https://gunsugye.github.io/gunsugye/** 입니다. 도메인을 구입할 필요는 없습니다. 화면은 GitHub Pages에서 운영하고, 기존 Apps Script는 스프레드시트 업무 서버로 사용합니다. Cloudflare Workers는 로그인 검증과 두 서버 사이의 연결을 담당합니다.

## 1. Google 로그인 클라이언트 만들기

Google Cloud Console에서 프로젝트를 선택하고 Google Auth Platform의 Branding, Audience, Clients를 설정합니다.

1. 앱 이름을 `군수계 업무일지`로 지정합니다.
2. 사용자 유형을 조직 정책에 맞게 지정합니다. 외부 앱을 테스트 모드로 사용한다면 실제 로그인할 계정을 테스트 사용자로 등록합니다.
3. OAuth 클라이언트 유형은 **웹 애플리케이션**을 선택합니다.
4. **승인된 JavaScript 원본**에 `https://gunsugye.github.io`를 등록합니다. `/gunsugye/` 경로는 넣지 않습니다.
5. 생성된 **클라이언트 ID**를 복사합니다. 클라이언트 시크릿은 이 구현에서 사용하지 않습니다.

`docs/config.js`의 `googleClientId`와 `api/wrangler.toml`의 `GOOGLE_CLIENT_ID`에 동일한 클라이언트 ID를 입력합니다. 팝업 콜백 방식이므로 리디렉션 URI는 사용하지 않습니다.

공식 문서: [Google 로그인 설정](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## 2. Apps Script 서버 준비

먼저 기존 Apps Script 코드·스크립트 속성·트리거 설정과 시트를 백업합니다. 운영 화면을 유지하면서 이전하려면 별도 Apps Script 프로젝트를 만들고 기존 스크립트 속성을 복사해 API 서버로 사용하세요. 테스트 단계에서는 복제한 시트 ID를 사용합니다. Apps Script 실행 계정은 연결된 시트·Forms·Drive 파일에 접근할 수 있어야 합니다.

1. 프로젝트에 **`Gateway.gs`와 `Legacy.gs` 두 코드 파일**을 넣습니다. 내용은 로컬 `apps-script/` 폴더에 있습니다.
2. 기존 `Code.gs`를 함께 두지 않습니다. 기존 공개 함수가 남으면 인증 경로를 우회하거나 함수 선언이 충돌할 수 있습니다. 별도 프로젝트에는 두 파일만 넣으세요. 기존 프로젝트를 전환한다면 백업 후 기존 코드 파일을 두 파일로 교체합니다.
3. 프로젝트 설정 → 스크립트 속성에서 기존 `LOGBOOK_*` 속성을 유지하거나 복사합니다. 특히 다음 두 항목은 필요합니다.

   | 속성 | 값 |
   | --- | --- |
   | `LOGBOOK_SHEET_ID` | 기존 또는 테스트용 기본 스프레드시트 ID |
   | `LOGBOOK_OWNER_EMAIL` | 최고 관리자 Google 이메일, 소문자 |
   | `PAGES_API_SHARED_SECRET` | 새로 만든 충분히 긴 임의 문자열, 최소 32자 |
   | `PAGES_VIEWER_EMAILS` | 선택 사항. 조회 전용 계정 이메일 JSON 배열, 예: `["viewer@gmail.com"]` |

   기존 편집자와 중대별 권한은 `LOGBOOK_FULL_EDITOR_EMAILS_V281`, `LOGBOOK_LIMITED_EDITOR_EMAILS_V226`, `LOGBOOK_ACCESS_PROFILES_V284` 등의 기존 속성을 복사하면 유지됩니다. 기존 파일 공유만으로는 새 앱의 조회 권한이 생기지 않습니다.
4. 공유 비밀값은 암호 관리 도구 등으로 임의 생성하고 Cloudflare에도 같은 값을 등록합니다. 채팅이나 GitHub 파일에 기록하지 않습니다.
5. `setupLogbook()`은 다시 실행하지 않습니다. 새 업무일지나 초기 자료를 만드는 작업은 필요하지 않습니다.
6. 새 배포 → 웹 앱 → **실행 사용자: 나(관리자)**, **액세스: 모든 사용자(익명 요청 포함)** 로 배포하고 소유자 계정으로 권한을 승인합니다. 여기서는 API 서명이 인증을 담당하며 실제 사용자는 Google ID 토큰으로 확인합니다. 조직에서 익명 웹 앱 배포를 막는 경우 이 연결 방식을 그대로 사용할 수 없습니다.
7. `/exec`로 끝나는 배포 주소를 `api/wrangler.toml`의 `APPS_SCRIPT_URL`에 넣습니다.

Apps Script 실행 사용자 설정은 기존 앱과 달라집니다. 이번 `Legacy.gs`는 서버에서 검증한 접속 계정을 사용하므로 기존 원본 `Code.gs`를 그대로 ‘나로 실행’으로 배포하면 안 됩니다.

### 자동 작업과 Forms 트리거

기존 프로젝트를 전환할 때는 Apps Script 편집기에서 `pagesMigrateTriggers_`를 소유자 계정으로 한 번 실행합니다. 기존 훈련 자동 인계와 설문 제출 트리거를 새 비공개 핸들러로 옮깁니다. 훈련 자동 인계는 서울 시간 오전 7시대의 기존 일일 주기로 다시 만듭니다.

별도 프로젝트를 만들었다면 트리거는 복사되지 않습니다. 운영 전환 시 기존 자동 작업을 중지하고 새 프로젝트에서 필요한 트리거를 등록하세요. 시간 트리거 핸들러는 `pagesTrainingScheduled_`, 기존 Google Forms 제출 핸들러는 `pagesSurveySubmit_`입니다. 새 앱에서 설문을 만들거나 자동 인계를 활성화하면 새 핸들러를 사용합니다. 같은 대상에 두 프로젝트의 자동 작업이 동시에 실행되지 않도록 전환합니다.

API 서버를 수정한 뒤에는 Apps Script를 **새 버전으로 재배포**해야 합니다.

## 3. Cloudflare Workers API 배포

Cloudflare 계정에서 Workers 서비스를 사용합니다. 계정이 없다면 먼저 생성합니다. `api/wrangler.toml`에 다음 값을 입력합니다.

```toml
ALLOWED_ORIGINS = "https://gunsugye.github.io"
GOOGLE_CLIENT_ID = "실제-클라이언트-ID.apps.googleusercontent.com"
APPS_SCRIPT_URL = "https://script.google.com/macros/s/실제-배포-ID/exec"
```

일반 Node.js/npm이 설치된 터미널에서 프로젝트 폴더를 열고 실행합니다.

```powershell
npx wrangler login
npx wrangler deploy --config api/wrangler.toml
npx wrangler secret put API_SHARED_SECRET --config api/wrangler.toml
```

마지막 명령의 입력창에 Apps Script의 `PAGES_API_SHARED_SECRET`과 동일한 값을 입력합니다. 비밀값을 명령문에 직접 붙여 넣지 않습니다. Worker 주소가 발급되면 `docs/config.js`의 `apiUrl`에 입력합니다. `/rpc`는 코드가 붙이므로 주소에는 넣지 않습니다.

CLI를 쓰지 않으려면 Cloudflare 대시보드에서 Worker를 만들고 `api/worker.mjs`를 ES 모듈 코드로 넣은 뒤, 위 세 환경 변수와 `API_SHARED_SECRET` Secret을 설정할 수도 있습니다.

공식 문서: [Wrangler 명령](https://developers.cloudflare.com/workers/wrangler/commands/), [Secret 설정](https://developers.cloudflare.com/workers/configuration/secrets/).

## 4. GitHub에 업로드하고 Pages 활성화

GitHub 저장소: https://github.com/gunsugye/gunsugye

현재 PC에서 업로드용 파일을 만듭니다.

```powershell
.\tools\node.exe scripts/package.mjs
```

**`release/github-upload` 안의 내용만** GitHub 저장소에 올립니다. `.github`와 `.gitignore`도 포함합니다. 원본 `Code.gs.txt`와 생성된 `Legacy.gs`에는 명단 초기 자료가 있어 이 패키지에서 제외했습니다. 폴더를 통째로 드래그할 때 `github-upload`라는 상위 폴더가 저장소에 생기지 않도록 내부 내용을 올립니다. GitHub Desktop이나 Git을 사용하면 숨김 폴더도 함께 반영하기 쉽습니다.

1. 업로드 대상 브랜치는 `main`으로 합니다.
2. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.
3. Actions → **Deploy GitHub Pages** → Run workflow를 실행합니다. 이후 `main`에 변경을 올리면 자동 배포됩니다.
4. 배포가 성공하면 **https://gunsugye.github.io/gunsugye/** 로 접속합니다.

GitHub Actions는 테스트 후 `docs/`만 배포합니다. Apps Script와 Worker는 해당 서비스에서 별도로 배포합니다. Pages의 로그인 화면 자체는 방문할 수 있지만 업무 데이터는 등록된 계정의 API 인증을 통과해야 조회됩니다.

공식 문서: [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 5. 연결 확인과 운영 전환

테스트 시트에서 최고 관리자로 로그인해 업무 조회 → 새 업무 저장 → 수정 → 삭제를 확인합니다. 전체 편집자·중대별 담당자·미등록 계정도 각각 로그인해 권한을 확인합니다. 알림 확인 기록이 사용자별로 분리되는지, 사용하는 사진 인식·Forms·자동 작업도 동작하는지 점검합니다.

실제 계정과 외부 서비스가 필요해 이 프로젝트의 로컬 자동 테스트는 Google 서비스 자체를 호출하지 않습니다. 화면 문법, RSA 서명·클레임, CORS, HMAC, 등록 계정 차단, 관리자 구분, 사용자별 기록 분리를 검사합니다.

모두 확인한 뒤 Apps Script의 시트 ID를 운영용으로 바꾸고 자동 작업을 한쪽 프로젝트로 통일합니다. 이전 프로젝트를 유지했다면 운영 전환이 끝날 때까지 기존 웹 앱 주소로 복귀할 수 있습니다.

로그인 실패 시 Google의 승인된 JavaScript 원본과 클라이언트 ID를, 연결 실패 시 Worker 주소·Apps Script `/exec` 주소·익명 접근·양쪽 공유 비밀값을 확인하세요. 저장 응답이 끊겼을 때는 자동으로 다시 쓰지 않습니다. 새로고침하여 실제 저장 결과를 먼저 확인합니다.
