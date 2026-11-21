import { json, verifySession } from "./_auth.js";
export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_SESSION_SECRET) return json({ ok: false, configured: false }, 503);
  const authenticated = await verifySession(request, env);
  return json({ ok: authenticated, configured: true }, authenticated ? 200 : 401);
}
