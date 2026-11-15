import { json, getBooking, googleContext, eventUrl, appointmentLabels } from "./_shared.js";
export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const found = await getBooking(env, token);
    if (!found || found.record.status !== "active") return json({ ok:false, message:"Aquest enllaç no és vàlid o la cita ja no està activa." }, 404);
    const { record } = found;
    const { timeZone } = await googleContext(env);
    const locked = Date.now() >= record.startMs - 24 * 60 * 60 * 1000;
    const labels = appointmentLabels(record.startMs, timeZone, record.language);
    return json({ ok:true, date:labels.date, time:labels.time, start:new Date(record.startMs).toISOString(), language:record.language || "ca", canManage:!locked, message:locked ? (record.language === "es" ? "Ya no se puede modificar ni cancelar esta cita porque faltan menos de 24 horas. Contacta directamente con Anna." : "Ja no es pot modificar ni cancel·lar aquesta cita perquè falten menys de 24 hores. Contacta directament amb l'Anna.") : "" });
  } catch (error) {
    console.error("Booking management lookup:", error?.message || "Unknown error");
    return json({ ok:false, message:"No s'ha pogut consultar la cita. Torna-ho a provar." }, 500);
  }
}
