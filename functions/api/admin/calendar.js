import { json, requireAdmin } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) {
    return json({ ok: false, message: "Cal iniciar sessió per consultar el calendari." }, 401);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_TOKEN_STORE) {
    return json({ ok: false, message: "La connexió amb Google no està configurada." }, 503);
  }

  const calendarId = await env.GOOGLE_TOKEN_STORE.get("google_calendar_id");
  const refreshToken = await env.GOOGLE_TOKEN_STORE.get("google_calendar_refresh_token");
  const timeZone = await env.GOOGLE_TOKEN_STORE.get("google_calendar_timezone") || "Europe/Madrid";
  const calendarName = await env.GOOGLE_TOKEN_STORE.get("google_calendar_name") || "Google Calendar";

  if (!calendarId || !refreshToken) {
    return json({ ok: false, message: "No hi ha cap calendari de Google seleccionat encara." }, 409);
  }

  const url = new URL(request.url);
  const startMs = Date.parse(url.searchParams.get("start") || "");
  const endMs = Date.parse(url.searchParams.get("end") || "");
  const now = Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs ||
      endMs - startMs > 32 * 24 * 60 * 60 * 1000 ||
      startMs < now - 370 * 24 * 60 * 60 * 1000 ||
      endMs > now + 370 * 24 * 60 * 60 * 1000) {
    return json({ ok: false, message: "El període del calendari no és vàlid." }, 400);
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
      console.error("Admin calendar token refresh failed:", tokenData.error || tokenResponse.status);
      return json({ ok: false, message: "No s'ha pogut renovar l'autorització de Google." }, 502);
    }

    const params = new URLSearchParams({
      timeMin: new Date(startMs).toISOString(),
      timeMax: new Date(endMs).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500"
    });
    const eventsResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events?" + params,
      { headers: { authorization: "Bearer " + tokenData.access_token } }
    );
    const eventsData = await eventsResponse.json();
    if (!eventsResponse.ok) {
      console.error("Admin calendar events query failed:", eventsData.error?.status || eventsResponse.status);
      return json({ ok: false, message: "No s'han pogut carregar les cites de Google Calendar." }, 502);
    }

    const events = (eventsData.items || [])
      .filter(event => event.status !== "cancelled" && event.start && event.end)
      .map(event => ({
        id: event.id,
        summary: event.summary || "Cita",
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: Boolean(event.start.date && !event.start.dateTime)
      }));

    return json({ ok: true, calendarName, timeZone, events });
  } catch (error) {
    console.error("Admin calendar request failed:", error?.message || "Unknown error");
    return json({ ok: false, message: "S'ha produït un error en consultar Google Calendar." }, 500);
  }
}
