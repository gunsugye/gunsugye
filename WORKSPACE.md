# 이 노트북에서 이어서 작업하기

기준 저장소: https://github.com/gunsugye/gunsugye (main, v3.95).
공개 사이트: https://gunsugye.github.io/gunsugye/

PowerShell에서 이 폴더를 열고 실행합니다. 시스템 설치 없이 폴더 안의 Node.js, Git, GitHub CLI를 사용합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\workspace.ps1 dev
powershell -ExecutionPolicy Bypass -File .\workspace.ps1 test
powershell -ExecutionPolicy Bypass -File .\workspace.ps1 status
powershell -ExecutionPolicy Bypass -File .\workspace.ps1 login
powershell -ExecutionPolicy Bypass -File .\workspace.ps1 publish-site
```

미리보기: http://127.0.0.1:5173/gunsugye/ . docs 안의 파일을 저장하면 화면이 자동으로 갱신됩니다. 작성/저장 중에는 기존 상태 확인 함수를 이용해 자동 새로고침을 보류합니다.

화면: docs/index.html, docs/assets/app.js, docs/assets/app.css.
로그인 연결: docs/config.js, docs/assets/pages.js.
API: api/worker.mjs. Apps Script 진입점: apps-script/Gateway.gs.
기능별 생성 코드: scripts/. 기존 배포 절차: AUTO-DEPLOY.md.

## 기존 노트북에서 옮겨야 하는 항목

공개 저장소는 비공개 업무 원본을 의도적으로 제외합니다. 전체 재생성과 기존 전체 배포 명령에는 기존 노트북의 Code.gs.txt, Index.html.txt, apps-script/Legacy.gs 및 .deploy/config.json이 필요합니다. 원본에는 업무 자료가 있으므로 공개 GitHub에 올리지 마세요. 계정은 이 PC에서 다시 로그인합니다. Google/Cloudflare 연결은 AUTO-DEPLOY.md를 따릅니다.

이 파일들이 없는 동안 scripts/build.mjs를 실행하지 않고 생성된 docs를 직접 수정합니다. 나중에 원본 빌드를 복원하면 docs 직접 수정이 덮어써질 수 있으므로 같은 변경을 scripts/ 또는 원본에도 반영해야 합니다.

GitHub Pages는 main에 push하면 기존 Actions가 검증·배포합니다. 다른 노트북에서 변경한 후에는 로컬 변경과 충돌을 확인하고 origin/main을 병합한 뒤 배포하세요. 강제 push는 사용하지 않습니다. publish-site는 테스트 후 이미 Git으로 추적 중인 파일의 변경과 이 작업 환경의 실행 파일 목록을 커밋·push합니다. 그 외 새 파일은 검토 후 명시적으로 git add 해야 합니다.

미리보기의 Google 로그인 및 API 사용에는 Google OAuth의 localhost 허용과 Cloudflare ALLOWED_ORIGINS의 로컬 주소 허용이 추가로 필요합니다. 이 계정 설정은 아직 변경하지 않았습니다.

## 다른 사용자의 데이터 변경

다른 사용자의 데이터 자동 반영과 코드 저장 시 미리보기 갱신은 별도 기능입니다. 업무 데이터는 기존 Sheets/Apps Script/API를 그대로 사용합니다. 전체 메뉴의 데이터 자동 반영은 실제 계정 연결 후 각 화면의 편집 보호·권한·동시 저장 처리를 검증해야 합니다. 현재 준비 상태만으로 공개 사이트에 전체 실시간 동기화가 적용된 것은 아닙니다.
