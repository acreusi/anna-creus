import { json, requireAdmin } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) {
    return json({ ok:false, message:"Cal iniciar sessió per consultar els pacients." }, 401);
  }
  if (!env.GOOGLE_TOKEN_STORE) {
    return json({ ok:false, message:"L'emmagatzematge privat no està configurat." }, 503);
  }

  try {
    const listing = await env.GOOGLE_TOKEN_STORE.list({ prefix:"patient:" });
    const patients = [];
    for (const item of listing.keys || []) {
      const raw = await env.GOOGLE_TOKEN_STORE.get(item.name);
      if (!raw) continue;
      try {
        const patient = JSON.parse(raw);
        if (patient && typeof patient === "object" && patient.id && patient.name) patients.push(patient);
      } catch {
        console.error("Skipped unreadable patient record.");
      }
    }
    patients.sort((a,b) => String(b.created || "").localeCompare(String(a.created || "")));
    return json({ ok:true, patients });
  } catch (error) {
    console.error("Private patient list failed:", error?.message || "Unknown error");
    return json({ ok:false, message:"No s'han pogut carregar els pacients." }, 500);
  }
}
