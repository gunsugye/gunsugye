# Supabase 기반 새 군수계 앱

`node scripts/build-rebuild.mjs --production`으로 기존 관리자 주소용 `docs/index.html`, 개인 주소용 `docs/me/index.html`과 독립 모듈 `docs/app2/`를 빌드한다. 관리자·개인 앱은 Supabase Auth 및 Data API를 이용하며 Apps Script 호출이 없다. 실제 로그인 검증이 끝나기 전까지 운영 준비 완료로 간주하지 않는다.

구현 메뉴: 업무일지·업무 통계·캘린더, 명단·학적, 생활실 방·입주자 배정·비품, 총기·무기고, 품목별 군수품·전체 현황·특이사항 명단, 공용비품, 근무생도·예도·근무물품·피복, 사역·식수, 전수조사·일괄 요청 검토, 개인 인터페이스, 권한 관리, 훈련 직책·지도생도·예비생도 배정과 일반학기 이관.

개인 앱은 품목별 팝업에서 값을 임시 편집하고 위·아래 일괄 버튼으로 변경 내역 확인 후 제출한다. 전수조사 기간은 즉시 기록하고 나머지는 검토 요청으로 저장한다. 접힌 항목은 사용자가 펼칠 때 조회한다. 세부사항은 선택 입력이며 부분작성은 보라색이다. 관리자 팝업은 삭제/취소/저장, 중대 열람 팝업은 확인만 표시한다.

적용한 스키마 순서: `database.sql`, `domain.sql`, `workflows.sql`, `catalog-seed.sql`, `validation-fix.sql`, `workflow-boundary.sql`, `auto-membership.sql`, `meals.sql`. 기존 프로젝트에서 다시 실행하지 않는다. 실인원·과거 기록은 넣지 않았으며 운영자 접근 설정과 품목 정의만 등록했다. 중대 계정은 일반학기 자기 중대 인원과 그 인원이 배정된 방의 비품을 열람한다. 지도생도는 본인과 담당 예비생도를 조회·요청할 수 있다. 업무 직책과 이메일 저장 시 군수계 관련 역할이 자동 부여된다.

Google 로그인은 Supabase Auth PKCE를 사용한다. Supabase 대시보드에서 Google 제공자 및 실제 새 앱 주소의 Redirect URL을 설정해야 한다. 기존 Google API용 OAuth와 별도다. 로컬에서 Auth API 연결 시간이 초과되어 실제 로그인 완료는 아직 검증하지 못했다. 클라이언트에는 publishable 키만 포함한다. 관리자 메일: gunsugye@gmail.com. 새로운 계정 권한은 app2_members에 서버 관리자 권한으로 등록한다.

검증: `node --test tests/rebuild.test.mjs tests/rebuild-domain.test.mjs tests/rebuild-release.test.mjs`, `node tests/rebuild-browser.mjs --domain`. `tests/rebuild-workflows.sql`과 `tests/rebuild-scope.sql`은 실제 DB에서 실행 후 롤백했다. UI 시험은 가상 API를 사용하므로 실사용자 Google 로그인 검증과 구분한다. Google Forms/Sheets 자동 연동과 과거 자료 이관은 요청에 따라 추후 작업으로 남긴다. 800명 동시 로그인과 3초 이내 응답은 아직 실측하지 않았다.
