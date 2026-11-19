
const enc = new TextEncoder();
const SESSION_COOKIE = "wb_test_session";
export const SESSION_SECONDS = 1800;

export function reply(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}
export const error = (message, status = 400) => reply({ ok: false, error: message }, status);
export function checkOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
export function hasDB(env) {
  return Boolean(env.DB && typeof env.DB.prepare === "function");
}
function encode64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode64(s) {
  const str = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(str, c => c.charCodeAt(0));
}
async function mac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}
function secureEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export async function hashValue(secret, value) {
  return encode64(await mac(secret, String(value)));
}
export function validSecret(secret) {
  return typeof secret === "string" && secret.length >= 32;
}
export async function createSession(secret, now = Date.now()) {
  if (!validSecret(secret)) throw new Error("SESSION_SECRET missing or too short");
  const payload = { id: crypto.randomUUID(), issued: Math.floor(now / 1000), until: Math.floor(now / 1000) + SESSION_SECONDS };
  const raw = encode64(enc.encode(JSON.stringify(payload)));
  const signature = encode64(await mac(secret, raw));
  return { id: payload.id, token: raw + "." + signature, expiresIn: SESSION_SECONDS };
}
export async function readSession(request, secret, now = Date.now()) {
  if (!validSecret(secret)) return null;
  const cookie = request.headers.get("Cookie") || "";
  const field = cookie.split(";").map(s => s.trim()).find(s => s.startsWith(SESSION_COOKIE + "="));
  if (!field) return null;
  const token = field.slice(SESSION_COOKIE.length + 1);
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0]) || !/^[\w-]+$/.test(parts[1])) return null;
  try {
    const expected = await mac(secret, parts[0]);
    if (!secureEquals(expected, decode64(parts[1]))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode64(parts[0])));
    const time = Math.floor(now / 1000);
    if (!/^[0-9a-f-]{36}$/.test(payload.id) || !Number.isInteger(payload.issued) || !Number.isInteger(payload.until)) return null;
    if (payload.issued > time + 60 || payload.until <= time || payload.until - payload.issued !== SESSION_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}
export function sessionCookie(token) {
  return SESSION_COOKIE + "=" + token + "; Path=/api; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Lax";
}
export async function limiter(env, key, max, windowSecs) {
  if (!hasDB(env)) throw new Error("DB binding missing");
  const bucket = Math.floor(Date.now() / (windowSecs * 1000));
  const k = key + ":" + bucket;
  const result = await env.DB.prepare(
    "INSERT INTO rate_counts (key, hits, expires_at) VALUES (?, 1, ?) " +
    "ON CONFLICT(key) DO UPDATE SET hits = hits + 1 WHERE hits < ? RETURNING hits"
  ).bind(k, (bucket + 2) * windowSecs, max).first();
  return Boolean(result && result.hits <= max);
}
export async function gate(context, action) {
  if (!hasDB(context.env)) return { response: error("DB_NOT_CONFIGURED", 503) };
  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (!session) return { response: error("SESSION_REQUIRED", 401) };
  const limits = { list: [30, 60], detail: [60, 1800], inquiry: [3, 600] };
  const rule = limits[action];
  if (rule && !(await limiter(context.env, action + ":" + session.id, rule[0], rule[1]))) {
    return { response: error("RATE_LIMITED", 429) };
  }
  return { session };
}
export function isAuthorized(request, secret) {
  if (!validSecret(secret)) return false;
  const received = request.headers.get("Authorization") || "";
  const expected = "Bearer " + secret;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
export function limitLength(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function idValid(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}
