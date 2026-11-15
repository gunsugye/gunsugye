var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.mjs
var encoder = new TextEncoder();
var MAX_BODY = 12 * 1024 * 1024;
var keyCache = { until: 0, keys: [] };
var ApiError = class extends Error {
  static {
    __name(this, "ApiError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new ApiError(401, "\uB85C\uADF8\uC778 \uD1A0\uD070 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}
__name(fromBase64Url, "fromBase64Url");
function decodePart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
  } catch {
    throw new ApiError(401, "\uB85C\uADF8\uC778 \uD1A0\uD070 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
}
__name(decodePart, "decodePart");
async function verifyGoogleToken(token, clientId, fetcher = fetch, now = Date.now()) {
  if (!clientId || !token || token.length > 16384) throw new ApiError(401, "Google \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "\uB85C\uADF8\uC778 \uD1A0\uD070 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const header = decodePart(parts[0]), claims = decodePart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new ApiError(401, "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB85C\uADF8\uC778 \uC11C\uBA85\uC785\uB2C8\uB2E4.");
  if (keyCache.until <= now) {
    const response = await fetcher("https://www.googleapis.com/oauth2/v3/certs");
    if (!response.ok) throw new ApiError(503, "Google \uB85C\uADF8\uC778 \uAC80\uC99D \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new ApiError(503, "Google \uACF5\uAC1C\uD0A4 \uC751\uB2F5\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const maxAge = Math.min(21600, Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") || "")?.[1] || 300));
    keyCache = { until: now + maxAge * 1e3, keys: data.keys };
  }
  const jwk = keyCache.keys.find((key2) => key2.kid === header.kid && key2.kty === "RSA");
  if (!jwk) throw new ApiError(401, "\uB85C\uADF8\uC778 \uC11C\uBA85\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD558\uC138\uC694.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromBase64Url(parts[2]), encoder.encode(parts[0] + "." + parts[1]));
  const seconds = Math.floor(now / 1e3);
  if (!valid || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) || claims.aud !== clientId || claims.azp && claims.azp !== clientId || !Number.isFinite(claims.exp) || claims.exp <= seconds || !Number.isFinite(claims.iat) || claims.iat > seconds + 60 || claims.nbf !== void 0 && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 60) || claims.email_verified !== true || typeof claims.sub !== "string" || !claims.sub || typeof claims.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    throw new ApiError(401, "Google \uB85C\uADF8\uC778 \uC815\uBCF4\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uAC70\uB098 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD558\uC138\uC694.");
  }
  if (!claims.email.toLowerCase().endsWith("@gmail.com") && !claims.hd) throw new ApiError(403, "Gmail \uB610\uB294 Google Workspace \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uC138\uC694.");
  return { email: claims.email.trim().toLowerCase(), sub: claims.sub };
}
__name(verifyGoogleToken, "verifyGoogleToken");
async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(signPayload, "signPayload");
async function sessionToken(actor, secret) {
  const payload = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(actor)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "session." + payload + "." + await signPayload("logbook-session-v1." + payload, secret);
}
__name(sessionToken, "sessionToken");
async function verifySession(token, secret, now = Date.now()) {
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== "session" || token.length > 8192) throw new ApiError(401, "\uB2E4\uC2DC \uB85C\uADF8\uC778\uD558\uC138\uC694.");
  const expected = await signPayload("logbook-session-v1." + parts[1], secret);
  let difference = expected.length ^ parts[2].length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (difference) throw new ApiError(401, "\uB2E4\uC2DC \uB85C\uADF8\uC778\uD558\uC138\uC694.");
  const actor = decodePart(parts[1]);
  if (!Number.isFinite(actor.expiresAt) || actor.expiresAt <= now || actor.expiresAt > now + 30 * 864e5 || typeof actor.email !== "string" || typeof actor.sub !== "string" || !/^[0-9a-f-]{36}$/.test(actor.sessionId || "")) throw new ApiError(401, "\uB85C\uADF8\uC778 \uC720\uC9C0 \uAE30\uAC04\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  return { email: actor.email, sub: actor.sub, sessionId: actor.sessionId };
}
__name(verifySession, "verifySession");
async function readBody(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) throw new ApiError(413, "\uC694\uCCAD \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "\uC694\uCCAD \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new ApiError(413, "\uC694\uCCAD \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "\uC694\uCCAD JSON\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
}
__name(readBody, "readBody");
async function handleRequest(request, env, fetcher = fetch) {
  const origin = request.headers.get("origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff" };
  const reply = /* @__PURE__ */ __name((status, body) => new Response(JSON.stringify(body), { status, headers }), "reply");
  if (!origin || !allowed.includes(origin)) return reply(403, { ok: false, error: "\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uC6F9\uC0AC\uC774\uD2B8\uC785\uB2C8\uB2E4." });
  headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
  headers["Access-Control-Max-Age"] = "600";
  const path = new URL(request.url).pathname;
  if (!["/rpc", "/session", "/logout", "/personal/login", "/personal/me", "/personal/logout", "/personal/assets", "/personal/details", "/personal/supplies", "/personal/uniform", "/personal/uniform-request", "/personal/duty-request", "/personal/firearm-request"].includes(path)) return reply(404, { ok: false, error: "\uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { ok: false, error: "POST \uC694\uCCAD\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4." });
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.API_SHARED_SECRET || env.API_SHARED_SECRET.length < 32 || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.APPS_SCRIPT_URL || "")) throw new ApiError(503, "API \uC11C\uBC84 \uC124\uC815\uC744 \uC644\uB8CC\uD558\uC138\uC694.");
    if (path.startsWith("/personal/")) return await handlePersonalRequest(request, env, fetcher, reply, path);
    const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") || "")?.[1];
    const actor = path !== "/session" && token?.startsWith("session.") ? await verifySession(token, env.API_SHARED_SECRET) : await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, fetcher);
    const body = await readBody(request);
    if (!body || typeof body.method !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(body.method) || !Array.isArray(body.args) || body.args.length > 30) throw new ApiError(400, "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 API \uC694\uCCAD\uC785\uB2C8\uB2E4.");
    const method = path === "/session" ? "pagesSessionCreate" : path === "/logout" ? "pagesSessionLogout" : body.method;
    if (path === "/session" && body.loginEmail !== void 0 && (typeof body.loginEmail !== "string" || body.loginEmail.trim().toLowerCase() !== actor.email)) {
      throw new ApiError(403, "\uC785\uB825\uD55C \uC774\uBA54\uC77C\uACFC \uC120\uD0DD\uD55C Google \uACC4\uC815\uC774 \uB2E4\uB985\uB2C8\uB2E4. \uAC19\uC740 \uACC4\uC815\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
    }
    if (path === "/rpc" && ["pagesSessionCreate", "pagesSessionLogout"].includes(method)) throw new ApiError(400, "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 API \uC694\uCCAD\uC785\uB2C8\uB2E4.");
    const payload = JSON.stringify({ version: 1, timestamp: Date.now(), nonce: crypto.randomUUID(), ...actor, method, args: path === "/rpc" ? body.args : [] });
    const signature = await signPayload(payload, env.API_SHARED_SECRET);
    let response;
    try {
      response = await fetcher(env.APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }), redirect: "follow", signal: AbortSignal.timeout(85e3) });
    } catch {
      throw new ApiError(504, "\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8 \uC11C\uBC84 \uC751\uB2F5\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uC694\uCCAD\uC740 \uC790\uB3D9 \uC7AC\uC2DC\uB3C4\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uACB0\uACFC\uB97C \uD655\uC778\uD558\uC138\uC694.");
    }
    if (!response.ok) throw new ApiError(502, "\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8 \uC11C\uBC84 \uC5F0\uACB0\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    let result;
    try {
      result = await response.json();
    } catch {
      throw new ApiError(502, "Apps Script \uBC30\uD3EC \uC8FC\uC18C\uC640 \uC811\uADFC \uAD8C\uD55C\uC744 \uD655\uC778\uD558\uC138\uC694.");
    }
    if (!result || typeof result.ok !== "boolean") throw new ApiError(502, "\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8 \uC11C\uBC84 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    if (path === "/session" && result.ok) {
      const { sessionId, expiresAt, bootstrap } = result.result || {};
      if (!sessionId || !Number.isFinite(expiresAt)) throw new ApiError(502, "Apps Script\uB97C \uC0C8 \uBC84\uC804\uC73C\uB85C \uBC30\uD3EC\uD558\uC138\uC694.");
      result.result = { bootstrap, expiresAt, token: await sessionToken({ ...actor, sessionId, expiresAt }, env.API_SHARED_SECRET) };
    }
    return reply(result.ok ? 200 : result.code === "SESSION_EXPIRED" ? 401 : result.code === "FORBIDDEN" ? 403 : 400, result);
  } catch (error) {
    return reply(error instanceof ApiError ? error.status : 500, { ok: false, error: error instanceof ApiError ? error.message : "API \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." });
  }
}
__name(handleRequest, "handleRequest");
async function handlePersonalRequest(request, env, fetcher, reply, path) {
  const body = await readBody(request), login = path === "/personal/login";
  let actor, args = [], method;
  if (login) {
    const authType = body?.authType === void 0 ? "firearm" : body.authType, field = authType === "cadet" ? "cadetNumber" : "firearmNumber";
    if (!["firearm", "cadet"].includes(authType) || typeof body?.name !== "string" || typeof body?.[field] !== "string" || body.name.length > 60 || body[field].length > 60) throw new ApiError(400, "\uC774\uB984\uACFC \uCD1D\uAE30\uBC88\uD638 \uB610\uB294 \uAD50\uBC88\uC744 \uD655\uC778\uD558\uC138\uC694.");
    actor = { email: "personal@portal.invalid", sub: "personal-login", rateKey: await signPayload("personal-rate:" + request.headers.get("CF-Connecting-IP"), env.API_SHARED_SECRET) };
    args = [{ name: body.name, ...authType === "cadet" ? { authType: "cadet", cadetNumber: body.cadetNumber } : { firearmNumber: body.firearmNumber } }];
    method = "pagesPersonalLogin";
  } else {
    const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") || "")?.[1];
    actor = await verifySession(token, env.API_SHARED_SECRET);
    if (actor.email !== "personal@portal.invalid" || !actor.sub.startsWith("personal:")) throw new ApiError(403, "\uAC1C\uC778 \uC870\uD68C \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    method = { "/personal/me": "pagesPersonalGet", "/personal/assets": "pagesPersonalAssets", "/personal/details": "pagesPersonalDetails", "/personal/supplies": "pagesPersonalSupplies", "/personal/uniform": "pagesPersonalUniform", "/personal/logout": "pagesPersonalLogout", "/personal/uniform-request": "pagesPersonalUniformRequest", "/personal/duty-request": "pagesPersonalDutyRequest", "/personal/firearm-request": "pagesPersonalFirearmRequest" }[path];
    if (path === "/personal/assets") args = [{ changes: body.changes, campaignId: body.campaignId }];
    if (path === "/personal/uniform-request") args = [{ changes: body.changes, expectedUpdatedAt: body.expectedUpdatedAt, campaignId: body.campaignId }];
    if (path === "/personal/duty-request") args = [{ changes: body.changes, snapshot: body.snapshot, campaignId: body.campaignId }];
    if (path === "/personal/firearm-request") args = [{ snapshot: body.snapshot, status: body.status, detail: body.detail, campaignId: body.campaignId }];
  }
  const payload = JSON.stringify({ version: 1, timestamp: Date.now(), nonce: crypto.randomUUID(), ...actor, method, args }), signature = await signPayload(payload, env.API_SHARED_SECRET);
  let response;
  try {
    response = await fetcher(env.APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }), redirect: "follow", signal: AbortSignal.timeout(85e3) });
  } catch (_) {
    throw new ApiError(504, "\uC870\uD68C \uC11C\uBC84 \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC138\uC694.");
  }
  if (!response.ok) throw new ApiError(502, "\uC870\uD68C \uC11C\uBC84 \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC138\uC694.");
  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new ApiError(502, "\uC870\uD68C \uC11C\uBC84 \uC751\uB2F5\uC744 \uD655\uC778\uD558\uC138\uC694.");
  }
  if (!result || typeof result.ok !== "boolean") throw new ApiError(502, "\uC870\uD68C \uC11C\uBC84 \uC751\uB2F5\uC744 \uD655\uC778\uD558\uC138\uC694.");
  if (login && result.ok) {
    const { sessionId, expiresAt, sub, preview } = result.result || {};
    if (!/^[0-9a-f-]{36}$/.test(sessionId || "") || !Number.isFinite(expiresAt) || expiresAt > Date.now() + 16 * 6e4 || expiresAt <= Date.now() || !String(sub).startsWith("personal:")) throw new ApiError(502, "\uC778\uC99D \uC11C\uBC84\uB97C \uD655\uC778\uD558\uC138\uC694.");
    result.result = { expiresAt, preview, token: await sessionToken({ email: "personal@portal.invalid", sub, sessionId, expiresAt }, env.API_SHARED_SECRET) };
  }
  return reply(result.ok ? 200 : result.code === "SESSION_EXPIRED" ? 401 : result.code === "RATE_LIMITED" ? 429 : 400, result);
}
__name(handlePersonalRequest, "handlePersonalRequest");
var worker_default = { fetch(request, env) {
  return handleRequest(request, env);
} };
export {
  ApiError,
  worker_default as default,
  handleRequest,
  readBody,
  sessionToken,
  signPayload,
  verifyGoogleToken,
  verifySession
};
//# sourceMappingURL=worker.js.map
