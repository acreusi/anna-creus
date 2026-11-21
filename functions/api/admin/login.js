import { json, sameOrigin, createSession, sessionCookie } from "./_auth.js";

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, message: "Petició no vàlida." }, 403);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET || !env.GOOGLE_TOKEN_STORE) {
    return json({ ok: false, message: "L'accés privat encara no està configurat a Cloudflare." }, 503);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = "admin_login:" + await digest(ip);
  const raw = await env.GOOGLE_TOKEN_STORE.get(rateKey);
  let attempts = raw ? Number(raw) : 0;
  if (attempts >= 8) return json({ ok: false, message: "Massa intents. Torna-ho a provar d'aquí a 15 minuts." }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: "Dades no vàlides." }, 400); }
  const username = String(body.username || "").slice(0, 120);
  const password = String(body.password || "").slice(0, 300);
  const [userDigest, expectedUserDigest, passDigest, expectedPassDigest] = await Promise.all([
    digest(username), digest(env.ADMIN_USERNAME), digest(password), digest(env.ADMIN_PASSWORD)
  ]);
  const constantTimeEqual = (a, b) => {
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i % a.length] || 0) ^ (b[i % b.length] || 0);
    return diff === 0;
  };
  const userOK = constantTimeEqual(userDigest, expectedUserDigest);
  const passOK = password.length > 0 && constantTimeEqual(passDigest, expectedPassDigest);
  if (!userOK || !passOK) {
    attempts++;
    await env.GOOGLE_TOKEN_STORE.put(rateKey, String(attempts), { expirationTtl: 900 });
    return json({ ok: false, message: "L'usuari o la contrasenya no són correctes." }, 401);
  }
  await env.GOOGLE_TOKEN_STORE.delete(rateKey);
  const token = await createSession(username, env);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}
