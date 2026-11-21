import { json, getBooking, googleContext, eventUrl, sendMail, escapeHtml, appointmentLabels } from "./_shared.js";
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const found = await getBooking(env, String(body.token || ""));
    if (!found || found.record.status !== "active") return json({ ok:false, message:"Aquest enllaç no és vàlid o la cita ja no està activa." }, 404);
    const { key, record } = found;
    if (Date.now() >= record.startMs - 24 * 60 * 60 * 1000) return json({ ok:false, message:record.language === "es" ? "Ya no se puede cancelar con menos de 24 horas de antelación. Contacta directamente con Anna." : "Ja no es pot cancel·lar amb menys de 24 hores d'antelació. Contacta directament amb l'Anna." }, 403);
    const ctx = await googleContext(env);
    const response = await fetch(eventUrl(ctx.calendarId, record.eventId), { method:"DELETE", headers:{ authorization:"Bearer " + ctx.accessToken } });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const err = await response.text(); console.error("Calendar cancel failed:", response.status, err);
      return json({ ok:false, message:"No s'ha pogut cancel·lar la cita. Torna-ho a provar." }, 502);
    }
    record.status = "cancelled";
    record.cancelledAt = Date.now();
    await env.GOOGLE_TOKEN_STORE.put(key, JSON.stringify(record), { expirationTtl: 400 * 24 * 60 * 60 });
    const labels = appointmentLabels(record.startMs, ctx.timeZone, record.language);
    const es = record.language === "es";
    const html = es
      ? "<p>Hola " + escapeHtml(record.name) + ",</p><p>Tu cita del <strong>" + labels.date + " a las " + labels.time + "</strong> ha sido cancelada correctamente.</p><p>Anna Creus · Psicología</p>"
      : "<p>Hola " + escapeHtml(record.name) + ",</p><p>La teva cita del <strong>" + labels.date + " a les " + labels.time + "</strong> s'ha cancel·lat correctament.</p><p>Anna Creus · Psicologia</p>";
    const emailSent = await sendMail(env, record.email, es ? "Cancelación de tu cita — Anna Creus" : "Cancel·lació de la teva cita — Anna Creus", html);
    const adminLabels = appointmentLabels(record.startMs, ctx.timeZone, "ca");
    const adminHtml = "<p>S'ha cancel·lat una cita.</p><p><strong>Pacient:</strong> " + escapeHtml(record.name) + "<br><strong>Correu:</strong> " + escapeHtml(record.email) + "<br><strong>Cita cancel·lada:</strong> " + adminLabels.date + " a les " + adminLabels.time + "</p>";
    const adminText = "S'ha cancel·lat una cita. Pacient: " + record.name + ". Correu: " + record.email + ". Cita cancel·lada: " + adminLabels.date + " a les " + adminLabels.time + ".";
    const adminNotificationSent = await sendMail(env, "ame.creus@gmail.com", "Cita cancel·lada — Anna Creus", adminHtml, adminText);
    return json({ ok:true, emailSent, adminNotificationSent });
  } catch (error) {
    console.error("Booking cancellation:", error?.message || "Unknown error");
    return json({ ok:false, message:"S'ha produït un error en cancel·lar la cita." }, 500);
  }
}
