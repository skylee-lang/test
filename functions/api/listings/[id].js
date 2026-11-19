
import { reply, error, gate, idValid } from "../../_lib/security.js";
export async function onRequestGet(context) {
  try {
    const auth = await gate(context, "detail");
    if (auth.response) return auth.response;
    const id = context.params.id;
    if (!idValid(id)) return error("INVALID_ID");
    const item = await context.env.DB.prepare(
      "SELECT id, area, type, deal, deposit, monthly_rent, area_exclusive, floor, direction, memo, thumbnail, photos_json, updated_at " +
      "FROM listings WHERE id = ? AND status = '진행중'"
    ).bind(id).first();
    if (!item) return error("NOT_FOUND", 404);
    let photos = [];
    try { photos = JSON.parse(item.photos_json || "[]"); } catch {}
    delete item.photos_json;
    return reply({ ok: true, item: { ...item, photos } });
  } catch {
    return error("DETAIL_UNAVAILABLE", 503);
  }
}
