import { json, getBooking, googleContext, eventUrl, getDayBusy, nextAvailableSlot, sendMail, escapeHtml, appointmentLabels } from "./_shared.js";
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const found = await getBooking(env, String(body.token || ""));
    if (!found || found.record.status !== "active") return json({ ok:false, message:"Aquest enllaç no és vàlid o la cita ja no està activa." }, 404);
    const { key, record } = found;
    if (Date.now() >= record.startMs - 24 * 60 * 60 * 1000) return json({ ok:false, message:record.language === "es" ? "Ya no se puede modificar con menos de 24 horas de antelación. Contacta directamente con Anna." : "Ja no es pot modificar amb menys de 24 hores d'antelació. Contacta directament amb l'Anna." }, 403);
    const newStart = Date.parse(body.start || "");
    if (!Number.isFinite(newStart) || newStart <= Date.now() || newStart > Date.now() + 370 * 86400000) return json({ ok:false, message:"La nova data no és vàlida." }, 400);
    const ctx = await googleContext(env);
    const busy = await getDayBusy(ctx.accessToken, ctx.calendarId, ctx.timeZone, newStart);
    const otherBusy = busy.filter(e => e.id !== record.eventId);
    if (nextAvailableSlot(newStart, otherBusy, ctx.timeZone) !== newStart) return json({ ok:false, message:record.language === "es" ? "Ese horario ya no está disponible. Elige otro." : "Aquesta hora ja no està disponible. Tria'n una altra." }, 409);
    const event = { start:{ dateTime:new Date(newStart).toISOString(), timeZone:ctx.timeZone }, end:{ dateTime:new Date(newStart + 3600000).toISOString(), timeZone:ctx.timeZone } };
    const response = await fetch(eventUrl(ctx.calendarId, record.eventId), { method:"PATCH", headers:{ authorization:"Bearer " + ctx.accessToken, "content-type":"application/json" }, body:JSON.stringify(event) });
    if (!response.ok) {
      const err = await response.text(); console.error("Calendar reschedule failed:", response.status, err);
      return json({ ok:false, message:"No s'ha pogut modificar la cita. Torna-ho a provar." }, 502);
    }
    const oldStart = record.startMs;
    record.startMs = newStart;
    record.updatedAt = Date.now();
    await env.GOOGLE_TOKEN_STORE.put(key, JSON.stringify(record), { expirationTtl: 400 * 24 * 60 * 60 });
    const oldLabels = appointmentLabels(oldStart, ctx.timeZone, record.language);
    const labels = appointmentLabels(newStart, ctx.timeZone, record.language);
    const es = record.language === "es";
    const html = es
      ? "<p>Hola " + escapeHtml(record.name) + ",</p><p>Tu cita se ha modificado correctamente.</p><p>Antes: <strong>" + oldLabels.date + " a las " + oldLabels.time + "</strong></p><p>Ahora: <strong>" + labels.date + " a las " + labels.time + "</strong></p><p>Anna Creus · Psicología</p>"
      : "<p>Hola " + escapeHtml(record.name) + ",</p><p>La teva cita s'ha modificat correctament.</p><p>Abans: <strong>" + oldLabels.date + " a les " + oldLabels.time + "</strong></p><p>Ara: <strong>" + labels.date + " a les " + labels.time + "</strong></p><p>Anna Creus · Psicologia</p>";
    const emailSent = await sendMail(env, record.email, es ? "Cambio de cita — Anna Creus" : "Canvi de cita — Anna Creus", html);
    return json({ ok:true, date:labels.date, time:labels.time, emailSent });
  } catch (error) {
    console.error("Booking reschedule:", error?.message || "Unknown error");
    return json({ ok:false, message:"S'ha produït un error en modificar la cita." }, 500);
  }
}
