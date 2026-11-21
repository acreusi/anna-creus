import { json, sameOrigin, clearSessionCookie } from "./_auth.js";
export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}
