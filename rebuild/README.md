# Supabase 기반 새 군수계 앱

`node scripts/build-rebuild.mjs`로 `docs/next/`를 빌드한다. 관리자 화면의 업무일지, 명단(총기번호), 생활실 방 관리에서 Supabase 직접 조회·추가·수정·삭제를 구현했다. 50건 페이지 조회, 중대/상태 필터, 버전 비교 저장, 오류 시 입력값 보존을 지원한다. 개인 화면과 나머지 업무 메뉴는 아직 전환 중이다. 전체 운영 전환 완료 상태는 아니다.

`database.sql`은 기존 logbook 테이블과 독립된 app2 테이블의 적용된 기준 스키마다. 다시 실행하지 않는다. 실인원·과거 기록은 넣지 않았으며 운영자의 접근 설정만 등록했다. 일반학기·훈련 데이터를 구분하고, 중대 계정은 일반학기 자기 중대만 열람한다. 관리자와 전체 편집자는 수정 가능하다. 혼합 생활실의 실제 입주자 배정은 후속 구현 대상이다.

Google 로그인은 Supabase Auth PKCE를 사용한다. Supabase 대시보드에서 Google 제공자 및 실제 새 앱 주소의 Redirect URL을 설정해야 한다. 기존 Google API용 OAuth와 별도다. 로컬에서 Auth API 연결 시간이 초과되어 실제 로그인 완료는 아직 검증하지 못했다. 클라이언트에는 publishable 키만 포함한다. 관리자 메일: gunsugye@gmail.com. 새로운 계정 권한은 app2_members에 서버 관리자 권한으로 등록한다.

검증: `node --test tests/rebuild.test.mjs`. 실제 DB에서는 트랜잭션 내 테스트 자료로 중대 조회 범위, 훈련 제외, 수정 차단, 관리자 접근, 버전 증가를 확인한 후 롤백했다. Google Forms/Sheets 자동 연동과 과거 자료 이관은 포함하지 않는다.
