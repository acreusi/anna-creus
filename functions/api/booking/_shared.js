export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
export const enc = new TextEncoder();
export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export async function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export async function getBooking(env, token) {
  if (!token || token.length < 40 || token.length > 100) return null;
  const key = "booking_token:" + await hashToken(token);
  const raw = await env.GOOGLE_TOKEN_STORE.get(key);
  if (!raw) return null;
  try { return { key, record: JSON.parse(raw) }; } catch { return null; }
}
export async function googleContext(env) {
  const calendarId = await env.GOOGLE_TOKEN_STORE.get("google_calendar_id");
  const refreshToken = await env.GOOGLE_TOKEN_STORE.get("google_calendar_refresh_token");
  const timeZone = await env.GOOGLE_TOKEN_STORE.get("google_calendar_timezone") || "Europe/Madrid";
  if (!calendarId || !refreshToken) throw new Error("El calendari no està configurat.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("No s'ha pogut connectar amb Google Calendar.");
  return { calendarId, timeZone, accessToken: data.access_token };
}
export function eventUrl(calendarId, eventId) {
  return "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId);
}
export function localParts(ms, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", weekday:"short" }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
}
export function dayStart(parts, hour, minute, timeZone) {
  const target = Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, minute);
  let guess = target;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
    guess += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return guess;
}
export async function getDayBusy(accessToken, calendarId, timeZone, dayMs) {
  const parts = localParts(dayMs, timeZone);
  const min = dayStart(parts, 0, 0, timeZone), max = dayStart(parts, 23, 59, timeZone);
  const params = new URLSearchParams({ timeMin:new Date(min).toISOString(), timeMax:new Date(max).toISOString(), singleEvents:"true", orderBy:"startTime", maxResults:"2500" });
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events?" + params, { headers:{ authorization:"Bearer " + accessToken } });
  const data = await response.json();
  if (!response.ok) throw new Error("No s'ha pogut consultar el calendari.");
  return (data.items || []).filter(e => e.status !== "cancelled" && e.transparency !== "transparent" && e.start && e.end).map(e => ({
    id:e.id, start:e.start.dateTime ? Date.parse(e.start.dateTime) : min, end:e.end.dateTime ? Date.parse(e.end.dateTime) : max
  }));
}
export function nextAvailableSlot(startMs, busy, timeZone) {
  const parts = localParts(startMs, timeZone);
  if (["Sat", "Sun"].includes(parts.weekday)) return null;
  const duration = 3600000, close = dayStart(parts, 19, 20, timeZone);
  let candidate = dayStart(parts, 16, 0, timeZone), guard = 0;
  while (candidate + duration <= close && guard++ < 20) {
    const conflict = busy.filter(e => candidate < e.end && candidate + duration > e.start).sort((a,b) => a.end - b.end)[0];
    if (conflict) { candidate = conflict.end + 600000; continue; }
    if (candidate === startMs) return candidate;
    if (candidate > startMs) return null;
    candidate += duration;
  }
  return null;
}
export async function sendMail(env, to, subject, html, textBody) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method:"POST", headers:{ authorization:"Bearer " + env.RESEND_API_KEY, "content-type":"application/json" },
      body:JSON.stringify({ from:"Anna Creus <onboarding@resend.dev>", to:[to], subject, html, ...(textBody ? { text:textBody } : {}) })
    });
    const data = await response.json();
    return response.ok && Boolean(data.id);
  } catch (error) { console.error("Email error:", error?.message || "Unknown error"); return false; }
}
export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
export function appointmentLabels(startMs, timeZone, language) {
  const locale = language === "es" ? "es-ES" : "ca-ES";
  return {
    date: new Intl.DateTimeFormat(locale, { timeZone, weekday:"long", day:"numeric", month:"long", year:"numeric" }).format(new Date(startMs)),
    time: new Intl.DateTimeFormat(locale, { timeZone, hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).format(new Date(startMs))
  };
}
