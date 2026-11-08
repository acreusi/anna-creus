export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const page = (title, message, status = 200) => new Response(
    `<!doctype html><html lang="ca"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font:16px system-ui;max-width:620px;margin:12vh auto;padding:24px;color:#252929;background:#f8f7f3"><h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

  if (error) return page("Autorització no completada", "Google no ha concedit l'accés. Pots tancar aquesta finestra.");
  if (!state || !code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_TOKEN_STORE) {
    return page("No s'ha pogut completar la connexió", "Falten dades de l'autorització o la configuració del servidor.", 400);
  }

  const stateKey = `google_oauth_state:${state}`;
  const savedState = await env.GOOGLE_TOKEN_STORE.get(stateKey);
  if (savedState !== "pending") return page("Sol·licitud no vàlida", "La sessió d'autorització ha caducat o no és vàlida. Torna a començar.", 400);
  await env.GOOGLE_TOKEN_STORE.delete(stateKey);

  const redirectUri = new URL("/api/google/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) {
    return page("No s'ha pogut desar l'autorització", "Google no ha retornat un token de renovació. Revisa el compte de proves i torna a autoritzar l'aplicació.", 502);
  }

  await env.GOOGLE_TOKEN_STORE.put("google_calendar_refresh_token", tokens.refresh_token);
  await env.GOOGLE_TOKEN_STORE.put("google_calendar_scopes", tokens.scope || "");
  return page("Google Calendar connectat", "L'autorització s'ha desat correctament. Ja pots tancar aquesta finestra.");
}
