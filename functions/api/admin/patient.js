import { json, requireAdmin, sameOrigin } from "./_auth.js";

const statuses = ["Primera visita pendent", "En seguiment", "Pendent de reprendre", "Alta"];
const appointmentStatuses = ["Programada", "Realitzada", "No presentada", "Cancel·lada"];

export async function onRequestPatch({ request, env }) {
  if (!sameOrigin(request)) return json({ ok:false, message:"Sol·licitud no vàlida." }, 403);
  if (!await requireAdmin(request, env)) return json({ ok:false, message:"Cal iniciar sessió." }, 401);
  if (!env.GOOGLE_TOKEN_STORE) return json({ ok:false, message:"L'emmagatzematge privat no està configurat." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ ok:false, message:"Dades no vàlides." }, 400); }
  const patientId = String(body.patientId || "");
  if (!/^patient:[a-f0-9]{64}$/.test(patientId)) return json({ ok:false, message:"Fitxa no vàlida." }, 400);

  try {
    const raw = await env.GOOGLE_TOKEN_STORE.get(patientId);
    if (!raw) return json({ ok:false, message:"No s'ha trobat la fitxa." }, 404);
    const patient = JSON.parse(raw);
    patient.notes = Array.isArray(patient.notes) ? patient.notes : [];
    patient.appointments = Array.isArray(patient.appointments) ? patient.appointments : [];
    const now = new Date().toISOString();
    const action = String(body.action || "");

    if (action === "add-note") {
      const title = String(body.title || "").trim();
      const noteBody = String(body.body || "").trim();
      const noteDate = String(body.date || now.slice(0,10));
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(noteDate) || !title || title.length > 120 || !noteBody || noteBody.length > 10000) return json({ ok:false, message:"Revisa la data, el títol i el contingut de la nota." }, 400);
      patient.notes.push({ id:crypto.randomUUID(), date:noteDate, appointmentEventId:String(body.eventId || ""), createdAt:now, updatedAt:now, title, body:noteBody });
    } else if (action === "edit-note") {
      const note = patient.notes.find(item => item.id === body.noteId);
      const title = String(body.title || "").trim();
      const noteBody = String(body.body || "").trim();
      if (!note) return json({ ok:false, message:"No s'ha trobat la nota." }, 404);
      if (!title || title.length > 120 || !noteBody || noteBody.length > 10000) return json({ ok:false, message:"Revisa el títol i el contingut de la nota." }, 400);
      note.title = title; note.body = noteBody; note.updatedAt = now;
    } else if (action === "delete-note") {
      const before = patient.notes.length;
      patient.notes = patient.notes.filter(item => item.id !== body.noteId);
      if (patient.notes.length === before) return json({ ok:false, message:"No s'ha trobat la nota." }, 404);
    } else if (action === "appointment-status") {
      if (!appointmentStatuses.includes(body.status)) return json({ ok:false, message:"Estat de visita no vàlid." }, 400);
      const appointment = patient.appointments.find(item => item.eventId && item.eventId === body.eventId);
      if (!appointment) return json({ ok:false, message:"No s'ha trobat la visita." }, 404);
      appointment.status = body.status;
      const hasCompletedFirstVisit = patient.appointments.some(item => item.type === "Primera visita" && item.status === "Realitzada");
      if (hasCompletedFirstVisit && patient.status === "Primera visita pendent") patient.status = "En seguiment";
    } else if (action === "patient-status") {
      if (!statuses.includes(body.status)) return json({ ok:false, message:"Estat de pacient no vàlid." }, 400);
      patient.status = body.status;
    } else {
      return json({ ok:false, message:"Acció no reconeguda." }, 400);
    }

    await env.GOOGLE_TOKEN_STORE.put(patientId, JSON.stringify(patient));
    return json({ ok:true, patient });
  } catch (error) {
    console.error("Private patient update failed:", error?.message || "Unknown error");
    return json({ ok:false, message:"No s'han pogut desar els canvis." }, 500);
  }
}