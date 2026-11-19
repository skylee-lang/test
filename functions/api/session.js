
import { reply, error, checkOrigin, hasDB, validSecret, createSession, readSession, sessionCookie, limiter, hashValue } from "../_lib/security.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  return reply({ ok: true, authenticated: Boolean(session) });
}
export async function onRequestPost({ request, env }) {
  if (!checkOrigin(request)) return error("INVALID_ORIGIN", 403);
  if (!hasDB(env) || !validSecret(env.SESSION_SECRET) || !env.TURNSTILE_SECRET) return error("SECURITY_NOT_CONFIGURED", 503);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return error("JSON_REQUIRED", 415);
  if (Number(request.headers.get("Content-Length") || 0) > 2048) return error("REQUEST_TOO_LARGE", 413);
  let body;
  try { body = await request.json(); } catch { return error("INVALID_JSON"); }
  if (typeof body.token !== "string" || body.token.length > 2048 || !body.token) return error("TURNSTILE_REQUIRED");
  const ip = request.headers.get("CF-Connecting-IP");
  try {
    if (ip) {
      const ipKey = await hashValue(env.SESSION_SECRET, ip);
      if (!(await limiter(env, "entry:" + ipKey, 12, 600))) return error("RATE_LIMITED", 429);
    }
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", body.token);
    if (ip) form.append("remoteip", ip);
    const cf = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(6000) });
    if (!cf.ok) return error("TURNSTILE_UNAVAILABLE", 503);
    const result = await cf.json();
    if (result.success !== true) return error("TURNSTILE_FAILED", 403);
    const session = await createSession(env.SESSION_SECRET);
    return reply({ ok: true, expiresIn: session.expiresIn }, 200, { "Set-Cookie": sessionCookie(session.token) });
  } catch {
    return error("SESSION_UNAVAILABLE", 503);
  }
}
