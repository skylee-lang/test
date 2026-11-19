
import { reply, error, gate, limitLength } from "../_lib/security.js";

export async function onRequestGet(context) {
  try {
    const auth = await gate(context, "list");
    if (auth.response) return auth.response;
    const query = new URL(context.request.url).searchParams;
    const page = Number(query.get("page") || 1);
    if (!Number.isInteger(page) || page < 1 || page > 30) return error("INVALID_PAGE");
    const term = limitLength(query.get("q") || "", 40).replace(/[%_\\]/g, "");
    const area = limitLength(query.get("area") || "", 40).replace(/[%_\\]/g, "");
    const type = limitLength(query.get("type") || "", 30).replace(/[%_\\]/g, "");
    const limit = 12;
    const list = await context.env.DB.prepare(
      "SELECT id, area, type, deal, deposit, monthly_rent, area_exclusive, floor, direction, thumbnail, updated_at " +
      "FROM listings WHERE status = '진행중' AND (? = '' OR area LIKE ?) AND (? = '' OR type LIKE ?) " +
      "AND (? = '' OR area LIKE ? OR type LIKE ? OR deal LIKE ?) " +
      "ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?"
    ).bind(area, "%" + area + "%", type, "%" + type + "%", term, "%" + term + "%", "%" + term + "%", "%" + term + "%", limit + 1, (page - 1) * limit).all();
    const items = (list.results || []).slice(0, limit);
    return reply({ ok: true, items, page, nextPage: (list.results || []).length > limit ? page + 1 : null });
  } catch {
    return error("LIST_UNAVAILABLE", 503);
  }
}
