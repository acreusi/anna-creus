export async function onRequestGet({ request, env }) {
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

  const calendarId = await env.GOOGLE_TOKEN_STORE.get("google_calendar_id");
  const refreshToken = await env.GOOGLE_TOKEN_STORE.get("google_calendar_refresh_token");
  const timeZone = await env.GOOGLE_TOKEN_STORE.get("google_calendar_timezone") || "Europe/Madrid";

  if (!calendarId || !refreshToken) {
    return json({ ok: false, message: "Encara no hi ha cap calendari de proves seleccionat." }, 409);
  }

  const url = new URL(request.url);
  const timeMin = url.searchParams.get("start");
  const timeMax = url.searchParams.get("end");
  const startMs = Date.parse(timeMin || "");
  const endMs = Date.parse(timeMax || "");

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return json({ ok: false, message: "Cal indicar una data inicial i final vàlides en format ISO." }, 400);
  }

  const rangeMs = endMs - startMs;
  const now = Date.now();
  const maxRange = 31 * 24 * 60 * 60 * 1000;
  const maxFuture = 370 * 24 * 60 * 60 * 1000;
  if (rangeMs > maxRange || startMs < now - 24 * 60 * 60 * 1000 || endMs > now + maxFuture) {
    return json({ ok: false, message: "El període consultat no és vàlid. Es poden consultar fins a 31 dies dins dels propers 12 mesos." }, 400);
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

    const params = new URLSearchParams({
      timeMin: new Date(startMs).toISOString(),
      timeMax: new Date(endMs).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500"
    });
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const eventsData = await eventsResponse.json();

    if (!eventsResponse.ok) {
      console.error("Google events query failed:", eventsData.error?.status || eventsResponse.status);
      return json({ ok: false, message: "No s'ha pogut consultar la disponibilitat del calendari." }, 502);
    }

    const busy = (eventsData.items || [])
      .filter(event => event.status !== "cancelled" && event.transparency !== "transparent")
      .filter(event => event.start && event.end)
      .map(event => ({
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: Boolean(event.start.date && !event.start.dateTime)
      }));

    return json({
      ok: true,
      timeZone,
      busy
    });
  } catch (error) {
    console.error("Calendar availability failed:", error?.message || "Unknown error");
    return json({ ok: false, message: "S'ha produït un error en consultar la disponibilitat." }, 500);
  }
}
