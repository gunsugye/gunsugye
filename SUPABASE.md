# Supabase 운영

프로젝트: `ylwzhooidqgvecocnzai`

현재 화면과 업무 API를 보존하면서 공용·훈련·전수조사 접수 자료의 저장소를 PostgreSQL로 연결합니다. Google 로그인, 기존 30일 세션, Google Forms, 스마트당직 원본 조회, PDF·스프레드시트 내보내기는 기존 Google 연결을 사용합니다.

## 저장 경로

### v5.72: 직접 SQL 조회의 첫 적용

`logbook_person_supplies`는 개인 군수품의 헤더와 본인 기록만 한 번에 반환합니다. 서버 전용이며 개인 인증은 기존 `personalPersonV331_`에서 먼저 검사합니다. 11개 품목 샘플에서 11개 개인 행, 약 3.8KB를 반환했습니다(선택지 제외). 전체 명단을 읽는 가상 Sheet 방식의 개인 군수품 조회를 대체합니다. UI·스냅샷·검토 요청 형식은 유지합니다.

`supabase-concurrent-commits.sql`은 일반 데이터 저장의 시작 시점 전체 dataset 잠금을 공유 구조 잠금 및 요청별 잠금으로 바꿉니다. 시트별 CAS와 마지막 revision 갱신은 유지합니다. 구조/설정/첨부 변경은 배타 구조 잠금으로 처리합니다. DB 저장 일부의 병렬성이 개선되며 동일 시트와 마지막 revision 갱신의 대기는 남습니다.

추가 설치 순서: 기존 runtime → conflict-status → person-supplies → concurrent-commits SQL. Edge action 배포 후 앱 서버를 배포합니다. 새 RPC는 PUBLIC/anon/authenticated 권한을 부여하지 않습니다.

인증 및 다른 업무 API는 아직 Apps Script를 경유합니다. 다음 전환은 기존 세션의 폐기·명단 변경 검증을 보존하는 직접 인증 API, 개인/중대 범위 조회 API, 독립 접수 테이블과 후속 처리입니다. Forms·원본 시트 편집 연결은 Google 브리지로 유지해야 합니다. 이 단계만으로 전체 로딩 3초를 보장하지 않습니다.

브라우저 → 기존 인증 Worker → Apps Script 업무·권한 검사 → `logbook-store` Edge Function → Supabase.

`logbook_rows`는 기존 값·표시값·날짜·서식을 보존합니다. 기존 인원 ID, 호실 ID, 품목 ID, 파일/탭 ID를 유지하므로 화면과 연결 관계를 다시 만들 필요가 없습니다. 설정·배치도·새 항목 추가·삭제도 같은 트랜잭션에서 저장합니다. Sheets 파일은 전환 전 원본 보관 및 Google Forms 원시 응답 수집용입니다. 전환 후 업무 수정은 앱에서 합니다.

요청별 UUID 중복 방지와 변경 전 값 비교를 적용합니다. 저장 성공 응답은 데이터베이스 커밋 뒤에만 반환합니다. 실패하면 Sheets로 우회 저장하지 않습니다. 전환 후 원본 재복사 기능은 데이터베이스에서 차단합니다.

## 접근과 배포

- 데이터 테이블과 RPC는 `service_role`만 접근할 수 있습니다. 공개 `anon` / `authenticated` 역할에는 직접 권한을 부여하지 않습니다.
- `logbook-store`는 서버 전용 256비트 인증값의 SHA-256 해시를 검사합니다. 서비스 키나 서버 인증값을 공개 파일·브라우저에 넣지 않습니다.
- Apps Script 속성 `SUPABASE_STORE_MODE=supabase`가 실제 전환 스위치입니다. `SUPABASE_STORE_URL`과 `SUPABASE_STORE_SECRET`은 비공개 서버 속성입니다.
- 전환 작업은 진행 상황을 서버에 기록하며, 복사·대조가 진행될 때만 중지 유효기간을 갱신합니다. 35분 안에 대조를 마치지 못하면 전환을 중단합니다. 서버 작업 자체가 멈춘 경우 마지막 진행 기록으로부터 20분 뒤 요청이 데이터베이스 활성화 여부를 확인하고 운영을 재개합니다. 활성화 전에는 Sheets, 활성화 후에는 Supabase를 사용하며, 새 Supabase 기록을 과거 Sheets 자료로 되돌리지 않습니다.
- `scripts/build.mjs`는 검증한 저장소 어댑터를 비공개 Legacy 코드에 포함합니다. 생성한 Legacy 파일을 직접 수정하지 않습니다.
- 기존 인증과 Google 연동 실행 경로가 남으므로 Apps Script 배포와 트리거를 삭제하면 안 됩니다.
- 묶음 조회, 압축 전송, 버전별 캐시를 사용합니다. Apps Script와 Google 연동 지연은 남아 있으며 모든 요청의 3초 이내 응답을 보장하지 않습니다.

## 복구 원칙

기존 Sheets로 스위치만 되돌리면 전환 후 기록을 잃을 수 있습니다. 자동으로 되돌리지 않습니다.

1. 새 쓰기를 중지하고 진행 중인 요청을 종료시킵니다.
2. Supabase의 현재 테이블·설정·첨부자료와 변경 이력을 별도 백업합니다.
3. 코드 문제는 데이터베이스를 유지한 채 검증한 서버 코드를 재배포합니다.
4. Sheets로 완전히 되돌릴 때는 **Supabase의 최신 자료**를 복구 대상 파일에 반영하고 탭 ID 참조까지 검증한 뒤 저장 경로를 바꿉니다. 전환 전 파일을 그대로 운영 원본으로 쓰지 않습니다.

비공개 `.deploy/supabase/`에 원본 스냅샷, 검증값, 배포 전 코드와 최종 전환 결과를 보관합니다. 이 디렉터리는 GitHub 업로드 대상이 아닙니다.

## 검증

`node tests/run.mjs`로 로컬 검증을 실행합니다. `scripts/supabase-store-smoke.sql`과 `scripts/supabase-runtime-smoke.sql`은 실제 데이터베이스에 검증용 자료를 만들고 트랜잭션 전체를 롤백합니다. 실사용 자료를 테스트 값으로 바꾸지 않습니다.
