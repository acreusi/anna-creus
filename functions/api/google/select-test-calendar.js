export async function onRequestGet({ env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_TOKEN_STORE) {
    return json({ ok: false, message: "La configuració de Google a Cloudflare és incompleta." }, 500);
  }

  const refreshToken = await env.GOOGLE_TOKEN_STORE.get("google_calendar_refresh_token");
  if (!refreshToken) {
    return json({ ok: false, message: "No s'ha trobat l'autorització de Google Calendar." }, 401);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token refresh failed:", tokenData.error || tokenResponse.status);
      return json({ ok: false, message: "No s'ha pogut renovar l'autorització de Google." }, 502);
    }

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
      { headers: { authorization: `Bearer ${tokenData.access_token}` } }
    );
    const data = await response.json();

    if (!response.ok) {
      console.error("Google calendar list failed:", data.error?.status || response.status);
      return json({ ok: false, message: "No s'ha pogut consultar la llista de calendaris." }, 502);
    }

    const targetName = "Proves – Anna Creus";
    const matches = (data.items || []).filter(calendar => calendar.summary === targetName);

    if (matches.length === 0) {
      return json({
        ok: false,
        message: "No he trobat cap calendari amb el nom exacte «Proves – Anna Creus». Comprova'n el nom a Google Calendar."
      }, 404);
    }

    if (matches.length > 1) {
      return json({
        ok: false,
        message: "Hi ha més d'un calendari amb aquest nom. Caldrà distingir-los abans de continuar."
      }, 409);
    }

    const selected = matches[0];
    if (!["owner", "writer"].includes(selected.accessRole)) {
      return json({
        ok: false,
        message: "El compte autoritzat no té permisos d'edició en aquest calendari."
      }, 403);
    }

    await env.GOOGLE_TOKEN_STORE.put("google_calendar_id", selected.id);
    await env.GOOGLE_TOKEN_STORE.put("google_calendar_name", selected.summary);
    await env.GOOGLE_TOKEN_STORE.put("google_calendar_timezone", selected.timeZone || "");

    return json({
      ok: true,
      message: "Calendari de proves seleccionat correctament.",
      calendarName: selected.summary,
      timeZone: selected.timeZone || null
    });
  } catch (error) {
    console.error("Google calendar selection failed:", error?.message || "Unknown error");
    return json({ ok: false, message: "S'ha produït un error en seleccionar el calendari." }, 500);
  }
}
