
import { reply, error, gate, checkOrigin, idValid, limitLength } from "../_lib/security.js";
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkOrigin(request)) return error("INVALID_ORIGIN", 403);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return error("JSON_REQUIRED", 415);
  if (Number(request.headers.get("Content-Length") || 0) > 8192) return error("REQUEST_TOO_LARGE", 413);
  try {
    const auth = await gate(context, "inquiry");
    if (auth.response) return auth.response;
    const body = await request.json();
    const idempotencyKey = body.idempotencyKey;
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{20,80}$/.test(idempotencyKey)) return error("INVALID_IDEMPOTENCY_KEY");
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10 || !body.items.every(idValid)) return error("INVALID_ITEMS");
    const note = limitLength(body.note || "", 1200);
    const items = [...new Set(body.items)];
    // Only accept active listing IDs. Never trust client-submitted prices or property details.
    const exists = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM listings WHERE status = '진행중' AND id IN (" + items.map(() => "?").join(",") + ")"
    ).bind(...items).first();
    if (Number(exists.n) !== items.length) return error("LISTING_NOT_AVAILABLE", 409);
    const code = "WB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO inquiries (idempotency_key, code, session_id, listing_ids_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(idempotencyKey, code, auth.session.id, JSON.stringify(items), note, Math.floor(Date.now() / 1000)).run();
    const saved = await env.DB.prepare(
      "SELECT code, session_id FROM inquiries WHERE idempotency_key = ?"
    ).bind(idempotencyKey).first();
    if (!saved || saved.session_id !== auth.session.id) return error("IDEMPOTENCY_CONFLICT", 409);
    return reply({ ok: true, code: saved.code });
  } catch {
    return error("INQUIRY_NOT_SAVED", 503);
  }
}
