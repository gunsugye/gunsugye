import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac, createHash, randomUUID } from 'node:crypto';

const gateway = readFileSync(new URL('../apps-script/Gateway.gs', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../apps-script/Legacy.gs', import.meta.url), 'utf8');
const secret = 'test-secret-with-more-than-thirty-two-characters';
test('개인 조회 인증 주체는 관리자 API와 일반 세션 생성에 접근할 수 없다',()=>{
 const f=fixture();for(const method of ['getBootstrap','listFullEditorsV281','pagesSessionCreate','readCompressedV282','getDormInventoryRequestsV336','resolveDormInventoryRequestV336'])assert.equal(f.rpc(f.signed('personal@portal.invalid',method,[],{sub:'personal:a',sessionId:randomUUID()})).code,'FORBIDDEN');
 assert.equal(f.rpc(f.signed('owner@gmail.com','pagesPersonalGet',[],{sub:'google123',sessionId:randomUUID()})).code,'FORBIDDEN');
});
test('실제 Gateway와 Legacy의 개인 인증·본인 조회·종료가 정상 동작한다',()=>{
 const f=fixture(),header=['명단ID','기수','중대','편대','이름','직책','비고','수정시각','교번','총기번호','총기상태'];
 const people=[['person-a','77','3','','검증가','','','v1','001','000123','정상'],['person-b','77','3','','타인','','','v1','002','999999','정상']];
 const sh={getLastRow:()=>3,getMaxColumns:()=>11,getRange:(row)=>({getDisplayValues:()=>row===1?[header]:people})};
 f.context.SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='생도명단'?sh:null,getId:()=> 'existing-spreadsheet'})};
 const login=f.rpc(f.signed('personal@portal.invalid','pagesPersonalLogin',[{name:'검증가',firearmNumber:'000123'}],{sub:'personal-login',rateKey:'a'.repeat(43)}));assert.equal(login.ok,true,login.error);
 const actor={sub:login.result.sub,sessionId:login.result.sessionId};
 const read=()=>f.rpc(f.signed('personal@portal.invalid','pagesPersonalGet',['person-b'],actor));
 const data=read();assert.equal(data.ok,true,data.error);assert.equal(data.result.person.name,'검증가');assert.equal(JSON.stringify(data).includes('타인'),false);
 assert.equal(f.rpc(f.signed('personal@portal.invalid','pagesPersonalLogout',[],actor)).ok,true);assert.equal(read().code,'SESSION_EXPIRED');
});
function fixture() {
  const values = new Map([
    ['LOGBOOK_OWNER_EMAIL', 'owner@gmail.com'], ['LOGBOOK_SHEET_ID', 'existing-spreadsheet'],
    ['PAGES_API_SHARED_SECRET', secret],
    ['LOGBOOK_FULL_EDITOR_EMAILS_V281', '["editor@gmail.com"]'],
    ['LOGBOOK_LIMITED_EDITOR_EMAILS_V226', '["limited@gmail.com"]']
  ]);
  const reads=[];
  const props = { getProperty: key => {reads.push(key);return values.get(key) ?? null;}, setProperty: (key, value) => values.set(key, value), deleteProperty: key => values.delete(key), getProperties: () => Object.fromEntries(values) };
  const cache = new Map();
  const context = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => props },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock:()=>true, releaseLock() {} }) },
    Utilities: {
      Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      getUuid: randomUUID,
      computeHmacSha256Signature: (payload, key) => createHmac('sha256', key).update(payload).digest(),
      computeDigest: (_algorithm, value) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    // 소유자로 실행되어도 접속 계정에 소유자 권한이 전파되면 안 됩니다.
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@gmail.com' }) }
  });
  new vm.Script(gateway + '\n' + legacy).runInContext(context);
  const signed = (email = 'owner@gmail.com', method = 'listFullEditorsV281', args = [], overrides = {}) => {
    const payload = JSON.stringify({ version: 1, timestamp: Date.now(), nonce: randomUUID(), email, sub: 'google-sub-' + email, method, args, ...overrides });
    return { postData: { contents: JSON.stringify({ payload, signature: createHmac('sha256', secret).update(payload).digest('base64url') }) } };
  };
  return { context, values, reads, signed, rpc: (...args) => JSON.parse(context.doPost(...args).text) };
}

test('실제 부트스트랩은 시트 열기와 계정 설정을 요청당 1회 수행하고 다음 요청은 권한 변경을 확인한다',()=>{
 const {context,values,reads,signed,rpc}=fixture();let opens=0;
 const sheet={getLastRow:()=>1};const book={getSheetByName:name=>name==='사용자메뉴_목록'?null:sheet};
 context.SpreadsheetApp={openById:()=>{opens++;return book;}};
 assert.equal(rpc(signed('owner@gmail.com','getBootstrap')).ok,true);
 assert.equal(opens,1);assert.equal(reads.filter(k=>k==='LOGBOOK_SHEET_ID').length,1);
 assert.equal(rpc(signed('owner@gmail.com','getBootstrap')).ok,true);
 assert.equal(opens,2);assert.equal(reads.filter(k=>k==='LOGBOOK_SHEET_ID').length,2);
 values.set('LOGBOOK_OWNER_EMAIL','new-owner@gmail.com');
 const denied=rpc(signed('owner@gmail.com','getBootstrap'));
 assert.equal(denied.ok,false);assert.equal(opens,2);
});

test('원본 업무 함수가 공개 전역에 노출되지 않는다', () => {
  const { context } = fixture();
  for (const method of ['getBootstrap', 'saveEntry', 'requireOwner_', 'config_', 'setupLogbook', 'grantFullEditorV281']) assert.equal(context[method], undefined);
  assert.equal(typeof context.doPost, 'function');
});

test('서버 세션은 만료·계정 불일치·로그아웃 이후 요청을 차단한다', () => {
  const { context, values, signed, rpc } = fixture();
  const sessionId = randomUUID();
  values.set('PAGES_SESSION_' + sessionId, JSON.stringify({ email: 'owner@gmail.com', sub: 'google-sub-owner@gmail.com', expiresAt: Date.now() + 86400000 }));
  assert.equal(rpc(signed(undefined, undefined, [], { sessionId })).ok, true);
  assert.equal(rpc(signed('editor@gmail.com', undefined, [], { sessionId })).code, 'SESSION_EXPIRED');
  assert.equal(rpc(signed(undefined, 'pagesSessionLogout', [], { sessionId })).ok, true);
  assert.equal(rpc(signed(undefined, undefined, [], { sessionId })).code, 'SESSION_EXPIRED');
  values.set('PAGES_SESSION_' + sessionId, JSON.stringify({ email: 'owner@gmail.com', sub: 'google-sub-owner@gmail.com', expiresAt: Date.now() - 1 }));
  assert.throws(() => context.pagesCheckSession_({ sessionId, email: 'owner@gmail.com', sub: 'google-sub-owner@gmail.com' }));
});
test('서명된 소유자는 기존 계정 관리 조회를 할 수 있다', () => {
  const { rpc, signed } = fixture();
  const result = rpc(signed());
  assert.equal(result.ok, true);
  assert.equal(result.result.owner, 'owner@gmail.com');
  assert.deepEqual(result.result.editors, ['editor@gmail.com']);
});
test('서명 누락·위조·만료·미래 요청과 잘못된 JSON을 차단한다', () => {
  const { rpc, signed } = fixture();
  const altered = signed();
  const envelope = JSON.parse(altered.postData.contents);
  envelope.payload = envelope.payload.replace('owner@gmail.com', 'someone@gmail.com');
  altered.postData.contents = JSON.stringify(envelope);
  for (const request of [undefined, { postData: { contents: '{}' } }, { postData: { contents: 'bad' } }, altered,
    signed(undefined, undefined, undefined, { timestamp: Date.now() - 91000 }),
    signed(undefined, undefined, undefined, { timestamp: Date.now() + 91000 })]) {
    assert.equal(rpc(request).code, 'FORBIDDEN');
  }
});
test('동일 서명 요청을 다시 전송하면 차단한다', () => {
  const { rpc, signed } = fixture();
  const request = signed();
  assert.equal(rpc(request).ok, true);
  assert.equal(rpc(request).code, 'FORBIDDEN');
});
test('미등록 계정은 차단하고 편집자를 최고 관리자로 취급하지 않는다', () => {
  const { rpc, signed } = fixture();
  assert.equal(rpc(signed('stranger@gmail.com')).code, 'FORBIDDEN');
  const editor = rpc(signed('editor@gmail.com'));
  assert.equal(editor.ok, false);
  assert.match(editor.error, /최고 관리자/);
});
test('내부 함수와 프로토타입 이름을 API로 호출할 수 없다', () => {
  const { rpc, signed } = fixture();
  for (const method of ['config_', 'pagesEmail_', 'constructor', 'toString', '__proto__', 'setupLogbook']) assert.equal(rpc(signed('owner@gmail.com', method)).ok, false);
});
test('사용자별 알림 기록은 소유자 저장 공간 안에서도 분리된다', () => {
  const { rpc, signed, values } = fixture();
  const id = randomUUID();
  assert.equal(rpc(signed('owner@gmail.com', 'dismissChangeV283', [id])).ok, true);
  assert.equal(rpc(signed('editor@gmail.com', 'dismissChangeV283', [id])).ok, true);
  const keys = [...values.keys()].filter(key => key.startsWith('PAGES_USER_'));
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test('범위 계정도 자신의 수정사항을 확인 처리하며 허용되지 않은 메뉴의 이력은 닫지 않는다',()=>{
 const {context,values,rpc,signed}=fixture(),own=randomUUID(),other=randomUUID();
 values.set('LOGBOOK_ACCESS_PROFILES_V284',JSON.stringify({'scoped@gmail.com':{job:'군수참모생도',views:['today']}}));
 const rows=[['기록ID','수정시각','수행계정','상위항목','하위항목','작업','수정 대상','상세','대상ID'],[own,'2026-10-27','','일지','all','수정','업무','',''],[other,'2026-10-27','','보급','supply','수정','물품','','']];
 const sh={getMaxColumns:()=>9,getLastRow:()=>rows.length,getRange:(r,c,h,w)=>({getDisplayValues:()=>rows.slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w))})};
 context.SpreadsheetApp={openById:()=>({getSheetByName:()=>sh})};
 const hidden=rpc(signed('scoped@gmail.com','dismissChangePageV286',['supply',[other]]));assert.equal(hidden.ok,true,hidden.error);assert.equal(hidden.result.hidden,0);
 const seen=rpc(signed('scoped@gmail.com','dismissChangePageV286',['all',[own]]));assert.equal(seen.ok,true);assert.equal(seen.result.hidden,1);
 const stored=[...values.entries()].find(([key])=>key.startsWith('PAGES_USER_'));assert.deepEqual(JSON.parse(stored[1]),[own]);
});
test('비공개 업무 원본과 브라우저 JavaScript 문법을 검사한다', () => {
  new vm.Script(legacy);
  new vm.Script(readFileSync(new URL('../docs/assets/pages.js', import.meta.url), 'utf8'));
  new vm.Script(readFileSync(new URL('../docs/assets/app.js', import.meta.url), 'utf8'));
});
