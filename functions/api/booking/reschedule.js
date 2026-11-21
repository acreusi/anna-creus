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
    if (nextAvailableSlot(newStart, busy, ctx.timeZone) !== newStart) return json({ ok:false, message:record.language === "es" ? "Ese horario ya no está disponible. Elige otro." : "Aquesta hora ja no està disponible. Tria'n una altra." }, 409);
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
    const manageUrl = "https://anna-creus.pages.dev/gestionar-cita.html?token=" + encodeURIComponent(String(body.token || ""));
    const html = es
      ? "<p>Hola " + escapeHtml(record.name) + ",</p><p>Tu cita se ha modificado correctamente.</p><p><strong>Nueva cita: " + labels.date + " a las " + labels.time + "</strong></p><p><a href='" + manageUrl + "' style='display:inline-block;padding:13px 22px;background:#c4d8d9;color:#252929;text-decoration:none;border-radius:24px;font-weight:600'>Modificar o cancelar mi cita</a></p><p>También puedes abrir este enlace directamente:<br><a href='" + manageUrl + "'>" + manageUrl + "</a></p><p>Puedes gestionar tu cita hasta 24 horas antes.</p><p>Anna Creus · Psicología</p>"
      : "<p>Hola " + escapeHtml(record.name) + ",</p><p>La teva cita s'ha modificat correctament.</p><p><strong>Nova cita: " + labels.date + " a les " + labels.time + "</strong></p><p><a href='" + manageUrl + "' style='display:inline-block;padding:13px 22px;background:#c4d8d9;color:#252929;text-decoration:none;border-radius:24px;font-weight:600'>Modificar o cancel·lar la meva cita</a></p><p>També pots obrir aquest enllaç directament:<br><a href='" + manageUrl + "'>" + manageUrl + "</a></p><p>Pots gestionar la cita fins a 24 hores abans.</p><p>Anna Creus · Psicologia</p>";
    const textBody = es
      ? "Hola " + record.name + ". Tu cita se ha modificado. Nueva cita: " + labels.date + " a las " + labels.time + ". Para modificarla o cancelarla hasta 24 horas antes, abre: " + manageUrl
      : "Hola " + record.name + ". La teva cita s'ha modificat. Nova cita: " + labels.date + " a les " + labels.time + ". Per modificar-la o cancel·lar-la fins a 24 hores abans, obre: " + manageUrl;
    const emailSent = await sendMail(env, record.email, es ? "Cambio de cita — Anna Creus" : "Canvi de cita — Anna Creus", html, textBody);
    const adminOldLabels = appointmentLabels(oldStart, ctx.timeZone, "ca");
    const adminNewLabels = appointmentLabels(newStart, ctx.timeZone, "ca");
    const adminHtml = "<p>S'ha modificat una cita.</p><p><strong>Pacient:</strong> " + escapeHtml(record.name) + "<br><strong>Correu:</strong> " + escapeHtml(record.email) + "<br><strong>Abans:</strong> " + adminOldLabels.date + " a les " + adminOldLabels.time + "<br><strong>Nova cita:</strong> " + adminNewLabels.date + " a les " + adminNewLabels.time + "</p>";
    const adminText = "S'ha modificat una cita. Pacient: " + record.name + ". Correu: " + record.email + ". Abans: " + adminOldLabels.date + " a les " + adminOldLabels.time + ". Nova cita: " + adminNewLabels.date + " a les " + adminNewLabels.time + ".";
    const adminNotificationSent = await sendMail(env, "ame.creus@gmail.com", "Cita modificada — Anna Creus", adminHtml, adminText);
    return json({ ok:true, date:labels.date, time:labels.time, emailSent, adminNotificationSent });
  } catch (error) {
    console.error("Booking reschedule:", error?.message || "Unknown error");
    return json({ ok:false, message:"S'ha produït un error en modificar la cita." }, 500);
  }
}
