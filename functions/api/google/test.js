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
    return json({ ok: false, message: "No s'ha trobat l'autorització desada. Cal tornar a connectar Google Calendar." }, 401);
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
      return json({ ok: false, message: "Google no ha pogut renovar l'autorització. Pot ser necessari tornar a connectar el compte." }, 502);
    }

    const calendarsResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
      { headers: { authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (!calendarsResponse.ok) {
      const errorData = await calendarsResponse.json().catch(() => ({}));
      console.error("Google Calendar list failed:", errorData.error?.status || calendarsResponse.status);
      return json({ ok: false, message: "La connexió s'ha renovat, però Google no ha permès consultar els calendaris." }, 502);
    }

    const calendarData = await calendarsResponse.json();
    return json({
      ok: true,
      message: "La connexió amb Google Calendar funciona.",
      calendarsAccessible: true,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Google Calendar test failed:", error?.message || "Unknown error");
    return json({ ok: false, message: "S'ha produït un error en comprovar la connexió." }, 500);
  }
}
