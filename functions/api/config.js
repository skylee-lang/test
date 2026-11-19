
import { reply, hasDB, validSecret } from "../_lib/security.js";
export function onRequestGet({ env }) {
  return reply({
    ok: true,
    siteKey: env.TURNSTILE_SITE_KEY || "",
    ready: Boolean(hasDB(env) && validSecret(env.SESSION_SECRET) && env.TURNSTILE_SECRET),
    demoOnly: true
  });
}
