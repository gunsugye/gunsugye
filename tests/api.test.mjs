import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, { verifyGoogleToken, signPayload, handleRequest, readBody } from '../api/worker.mjs';

const now = Date.now();
const clientId = 'test-client.apps.googleusercontent.com';
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const baseClaims = { iss: 'https://accounts.google.com', aud: clientId, sub: '123456789', email: 'owner@gmail.com', email_verified: true, iat: Math.floor(now / 1000) - 10, exp: Math.floor(now / 1000) + 3600 };
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(claims = {}, header = {}) {
  const body = b64({ alg: 'RS256', kid: 'test-key', ...header }) + '.' + b64({ ...baseClaims, ...claims });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(body));
  return body + '.' + Buffer.from(signature).toString('base64url');
}
const certs = async () => Response.json({ keys: [jwk] }, { headers: { 'Cache-Control': 'max-age=600' } });
const env = { ALLOWED_ORIGINS: 'https://example.github.io', GOOGLE_CLIENT_ID: clientId, API_SHARED_SECRET: 'a-long-random-test-secret-at-least-32-characters', APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec' };
function request(body = { method: 'getBootstrap', args: [] }, credential, origin = 'https://example.github.io') {
  return new Request('https://api.example/rpc', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('Google RSA 서명과 정상 클레임을 검증한다', async () => {
  assert.deepEqual(await verifyGoogleToken(await token(), clientId, certs, now), { email: 'owner@gmail.com', sub: '123456789' });
});
test('변조한 서명·알고리즘·audience·issuer·만료·미검증 이메일을 거절한다', async () => {
  const invalid = [
    await token({ aud: 'other-client' }), await token({ iss: 'https://attacker.example' }),
    await token({ exp: Math.floor(now / 1000) - 1 }), await token({ email_verified: false }),
    await token({ iat: Math.floor(now / 1000) + 120 }), await token({ sub: '' }),
    await token({}, { alg: 'none' }), await token({ azp: 'other-client' }),
    await token({ email: 'someone@external.example' })
  ];
  const valid = await token();
  invalid.push(valid.slice(0, -10) + 'AAAAAAAAAA');
  for (const value of invalid) await assert.rejects(verifyGoogleToken(value, clientId, certs, now), error => [401, 403].includes(error.status));
});
test('HMAC 출력이 Apps Script와 같은 SHA256 base64url 규약을 쓴다', async () => {
  const payload = JSON.stringify({ email: 'owner@gmail.com', args: ['한글'] });
  assert.equal(await signPayload(payload, env.API_SHARED_SECRET), createHmac('sha256', env.API_SHARED_SECRET).update(payload).digest('base64url'));
});
test('허용 origin에만 CORS를 열고 Worker 진입점에서 preflight를 처리한다', async () => {
  const result = await worker.fetch(new Request('https://api.example/rpc', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGINS } }), env, {});
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGINS);
  const denied = await handleRequest(request({}, '', 'https://attacker.example'), env);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});
test('브라우저가 보낸 이메일 대신 검증된 사용자만 Apps Script에 전달한다', async () => {
  let forwarded;
  const fetcher = async (url, options) => {
    if (url.includes('/certs')) return certs();
    forwarded = JSON.parse(options.body);
    return Response.json({ ok: true, result: { userEmail: 'owner@gmail.com' } });
  };
  const response = await handleRequest(request({ method: 'getBootstrap', args: [], email: 'admin@attacker.example', sub: 'fake' }, await token()), env, fetcher);
  assert.equal(response.status, 200);
  const payload = JSON.parse(forwarded.payload);
  assert.equal(payload.email, 'owner@gmail.com');
  assert.equal(payload.sub, baseClaims.sub);
  assert.equal(forwarded.signature, await signPayload(forwarded.payload, env.API_SHARED_SECRET));
});
test('누락 토큰과 내부 함수 호출, 비정상 인자를 거절한다', async () => {
  assert.equal((await handleRequest(request({}, ''), env, certs)).status, 401);
  for (const body of [{ method: 'config_', args: [] }, { method: '__proto__', args: [] }, { method: 'getBootstrap', args: {} }, null]) {
    assert.equal((await handleRequest(request(body, await token()), env, certs)).status, 400);
  }
});
test('Apps Script HTML 응답과 연결 오류를 명확하게 보고한다', async () => {
  let calls = 0;
  const broken = async url => {
    if (url.includes('/certs')) return certs();
    calls++; return new Response('<html>로그인 필요</html>');
  };
  assert.equal((await handleRequest(request(undefined, await token()), env, broken)).status, 502);
  assert.equal(calls, 1);
});
test('큰 요청은 Content-Length 사전 검사로 차단한다', async () => {
  await assert.rejects(readBody(new Request('https://api.example', { method: 'POST', body: '{}', headers: { 'Content-Length': String(13 * 1024 * 1024) } })), error => error.status === 413);
});
