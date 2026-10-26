const encoder = new TextEncoder();
const MAX_BODY = 12 * 1024 * 1024;
let keyCache = { until: 0, keys: [] };

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function fromBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new ApiError(401, '로그인 토큰 형식이 올바르지 않습니다.');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
function decodePart(value) {
  try { return JSON.parse(new TextDecoder().decode(fromBase64Url(value))); }
  catch { throw new ApiError(401, '로그인 토큰 형식이 올바르지 않습니다.'); }
}

export async function verifyGoogleToken(token, clientId, fetcher = fetch, now = Date.now()) {
  if (!clientId || !token || token.length > 16384) throw new ApiError(401, 'Google 로그인이 필요합니다.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError(401, '로그인 토큰 형식이 올바르지 않습니다.');
  const header = decodePart(parts[0]), claims = decodePart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new ApiError(401, '지원하지 않는 로그인 서명입니다.');
  // Google 공개키로 서명을 검증합니다. 브라우저가 보낸 이메일은 신뢰하지 않습니다.
  if (keyCache.until <= now) {
    const response = await fetcher('https://www.googleapis.com/oauth2/v3/certs');
    if (!response.ok) throw new ApiError(503, 'Google 로그인 검증 서버에 연결할 수 없습니다.');
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new ApiError(503, 'Google 공개키 응답을 확인할 수 없습니다.');
    const maxAge = Math.min(21600, Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 300));
    keyCache = { until: now + maxAge * 1000, keys: data.keys };
  }
  const jwk = keyCache.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new ApiError(401, '로그인 서명을 확인할 수 없습니다. 다시 로그인하세요.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]), encoder.encode(parts[0] + '.' + parts[1]));
  const seconds = Math.floor(now / 1000);
  if (!valid || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)
      || claims.aud !== clientId || (claims.azp && claims.azp !== clientId)
      || !Number.isFinite(claims.exp) || claims.exp <= seconds
      || !Number.isFinite(claims.iat) || claims.iat > seconds + 60
      || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 60))
      || claims.email_verified !== true || typeof claims.sub !== 'string' || !claims.sub
      || typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    throw new ApiError(401, 'Google 로그인 정보가 만료되었거나 유효하지 않습니다. 다시 로그인하세요.');
  }
  // 외부 이메일의 소유권은 Google이 보증하지 않을 수 있으므로 Gmail/Workspace만 허용합니다.
  if (!claims.email.toLowerCase().endsWith('@gmail.com') && !claims.hd) throw new ApiError(403, 'Gmail 또는 Google Workspace 계정으로 로그인하세요.');
  return { email: claims.email.trim().toLowerCase(), sub: claims.sub };
}

export async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sessionToken(actor, secret) {
  const payload = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(actor)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'session.' + payload + '.' + await signPayload('logbook-session-v1.' + payload, secret);
}
export async function verifySession(token, secret, now = Date.now()) {
  const parts = String(token).split('.');
  if (parts.length !== 3 || parts[0] !== 'session' || token.length > 8192) throw new ApiError(401, '다시 로그인하세요.');
  const expected = await signPayload('logbook-session-v1.' + parts[1], secret);
  let difference = expected.length ^ parts[2].length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (difference) throw new ApiError(401, '다시 로그인하세요.');
  const actor = decodePart(parts[1]);
  if (!Number.isFinite(actor.expiresAt) || actor.expiresAt <= now || actor.expiresAt > now + 30 * 86400000
      || typeof actor.email !== 'string' || typeof actor.sub !== 'string' || !/^[0-9a-f-]{36}$/.test(actor.sessionId || '')) throw new ApiError(401, '로그인 유지 기간이 만료되었습니다.');
  return { email: actor.email, sub: actor.sub, sessionId: actor.sessionId };
}

export async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) throw new ApiError(413, '요청 크기가 너무 큽니다.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '요청 내용이 없습니다.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new ApiError(413, '요청 크기가 너무 큽니다.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, '요청 JSON이 올바르지 않습니다.'); }
}

export async function handleRequest(request, env, fetcher = fetch) {
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || !allowed.includes(origin)) return reply(403, { ok: false, error: '허용되지 않은 웹사이트입니다.' });
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
  headers['Access-Control-Max-Age'] = '600';
  const path = new URL(request.url).pathname;
  if (!['/rpc', '/session', '/logout'].includes(path)) return reply(404, { ok: false, error: '주소를 확인하세요.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'POST 요청만 가능합니다.' });
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.API_SHARED_SECRET || env.API_SHARED_SECRET.length < 32
        || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.APPS_SCRIPT_URL || '')) throw new ApiError(503, 'API 서버 설정을 완료하세요.');
    const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || '')?.[1];
    const actor = path !== '/session' && token?.startsWith('session.')
      ? await verifySession(token, env.API_SHARED_SECRET)
      : await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, fetcher);
    const body = await readBody(request);
    if (!body || typeof body.method !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(body.method)
        || !Array.isArray(body.args) || body.args.length > 30) throw new ApiError(400, '지원하지 않는 API 요청입니다.');
    const method = path === '/session' ? 'pagesSessionCreate' : path === '/logout' ? 'pagesSessionLogout' : body.method;
    if (path === '/session' && body.loginEmail !== undefined
        && (typeof body.loginEmail !== 'string' || body.loginEmail.trim().toLowerCase() !== actor.email)) {
      throw new ApiError(403, '입력한 이메일과 선택한 Google 계정이 다릅니다. 같은 계정을 선택하세요.');
    }
    if (path === '/rpc' && ['pagesSessionCreate', 'pagesSessionLogout'].includes(method)) throw new ApiError(400, '지원하지 않는 API 요청입니다.');
    const payload = JSON.stringify({ version: 1, timestamp: Date.now(), nonce: crypto.randomUUID(), ...actor, method, args: path === '/rpc' ? body.args : [] });
    const signature = await signPayload(payload, env.API_SHARED_SECRET);
    let response;
    try {
      response = await fetcher(env.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, signature }), redirect: 'follow', signal: AbortSignal.timeout(85000) });
    } catch { throw new ApiError(504, '스프레드시트 서버 응답을 확인할 수 없습니다. 저장 요청은 자동 재시도하지 않습니다. 새로고침 후 결과를 확인하세요.'); }
    if (!response.ok) throw new ApiError(502, '스프레드시트 서버 연결에 실패했습니다.');
    let result;
    try { result = await response.json(); }
    catch { throw new ApiError(502, 'Apps Script 배포 주소와 접근 권한을 확인하세요.'); }
    if (!result || typeof result.ok !== 'boolean') throw new ApiError(502, '스프레드시트 서버 응답이 올바르지 않습니다.');
    if (path === '/session' && result.ok) {
      const { sessionId, expiresAt, bootstrap } = result.result || {};
      if (!sessionId || !Number.isFinite(expiresAt)) throw new ApiError(502, 'Apps Script를 새 버전으로 배포하세요.');
      result.result = { bootstrap, expiresAt, token: await sessionToken({ ...actor, sessionId, expiresAt }, env.API_SHARED_SECRET) };
    }
    return reply(result.ok ? 200 : result.code === 'SESSION_EXPIRED' ? 401 : result.code === 'FORBIDDEN' ? 403 : 400, result);
  } catch (error) {
    return reply(error instanceof ApiError ? error.status : 500, { ok: false, error: error instanceof ApiError ? error.message : 'API 처리 중 오류가 발생했습니다.' });
  }
}

export default { fetch(request, env) { return handleRequest(request, env); } };
