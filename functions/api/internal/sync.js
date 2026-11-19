
import { reply, error, isAuthorized, hasDB, idValid, limitLength } from "../../_lib/security.js";
const statuses = new Set(["진행중", "거래완료", "삭제"]);
function cleanURL(raw) {
  if (!raw) return "";
  try { const u = new URL(raw); return u.protocol === "https:" ? u.toString().slice(0, 600) : ""; }
  catch { return ""; }
}
export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env.SYNC_SECRET)) return error("UNAUTHORIZED", 401);
  if (!hasDB(env)) return error("DB_NOT_CONFIGURED", 503);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return error("JSON_REQUIRED", 415);
  if (Number(request.headers.get("Content-Length") || 0) > 250000) return error("REQUEST_TOO_LARGE", 413);
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length > 100) return error("INVALID_BATCH");
    const rows = [];
    const ids = new Set();
    for (const item of body.items) {
      if (!item || !idValid(item.id) || ids.has(item.id) || !statuses.has(item.status)) return error("INVALID_ITEM");
      ids.add(item.id);
      const photos = Array.isArray(item.photos) ? item.photos.slice(0, 15).map(cleanURL).filter(Boolean) : [];
      rows.push({
        id: item.id, status: item.status, area: limitLength(item.area, 120),
        type: limitLength(item.type, 80), deal: limitLength(item.deal, 30),
        deposit: Number.isFinite(Number(item.deposit)) ? Number(item.deposit) : 0,
        monthly_rent: Number.isFinite(Number(item.monthly_rent)) ? Number(item.monthly_rent) : 0,
        area_exclusive: limitLength(item.area_exclusive, 80),
        floor: limitLength(item.floor, 40), direction: limitLength(item.direction, 40),
        memo: limitLength(item.memo, 500), thumbnail: cleanURL(item.thumbnail || photos[0]),
        photos_json: JSON.stringify(photos)
      });
    }
    // Full snapshots are handled by the external sync job. Omitted IDs are NOT deleted automatically.
    const now = Math.floor(Date.now() / 1000);
    const statements = rows.map(it => env.DB.prepare(
      "INSERT INTO listings (id,status,area,type,deal,deposit,monthly_rent,area_exclusive,floor,direction,memo,thumbnail,photos_json,updated_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET " +
      "status=excluded.status,area=excluded.area,type=excluded.type,deal=excluded.deal,deposit=excluded.deposit," +
      "monthly_rent=excluded.monthly_rent,area_exclusive=excluded.area_exclusive,floor=excluded.floor," +
      "direction=excluded.direction,memo=excluded.memo,thumbnail=excluded.thumbnail,photos_json=excluded.photos_json,updated_at=excluded.updated_at"
    ).bind(it.id,it.status,it.area,it.type,it.deal,it.deposit,it.monthly_rent,it.area_exclusive,it.floor,it.direction,it.memo,it.thumbnail,it.photos_json,now));
    if (statements.length) await env.DB.batch(statements);
    return reply({ ok: true, upserted: rows.length });
  } catch {
    return error("SYNC_FAILED", 503);
  }
}
