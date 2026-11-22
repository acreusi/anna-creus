import { json, requireAdmin } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) {
    return json({ ok:false, message:"Cal iniciar sessió per consultar els pacients." }, 401);
  }
  if (!env.GOOGLE_TOKEN_STORE) {
    return json({ ok:false, message:"L'emmagatzematge privat no està configurat." }, 503);
  }

  try {
    // One-time fictional record for checking the patient-file layout and history UI.
    // It is stored like an ordinary patient and is not labelled in the interface.
    const seedMarker = "system:patient_sample_v1_created";
    if (!(await env.GOOGLE_TOKEN_STORE.get(seedMarker))) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("anna-creus-sample-patient-claudia-ferrer-v1"));
      const patientKey = "patient:" + Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
      const sessionDates = ["2026-08-10","2026-08-17","2026-08-24","2026-08-31","2026-09-07","2026-09-14","2026-09-21","2026-09-28","2026-10-05","2026-10-12","2026-10-19","2026-10-26","2026-11-02","2026-11-09","2026-11-16"];
      const noteContent = [
        ["Primera sessió · Motiu de consulta i objectius","Explorem les dificultats que han motivat la consulta i les situacions en què apareix el malestar. Acordem començar identificant els desencadenants i establint objectius de treball concrets."],
        ["Sessió 2 · Registre de situacions","Revisem el registre de la setmana. Identifica algunes situacions recurrents i comença a diferenciar el que passa, què pensa i com se sent. Proposem continuar observant-ho sense jutjar-se."],
        ["Sessió 4 · Pensaments automàtics","Treballem la identificació de pensaments automàtics i les interpretacions més freqüents. Practiquem preguntes per valorar evidències i generar alternatives més ajustades."],
        ["Sessió 6 · Estratègies d'afrontament","Revisem les estratègies que ha provat entre sessions. Identifica quines li resulten útils i quines tendeix a evitar. Introduïm una pauta breu de respiració i ancoratge."],
        ["Sessió 8 · Límits i necessitats","Explorem dificultats per expressar necessitats i posar límits en algunes relacions. Fem un assaig de comunicació assertiva amb una situació quotidiana."],
        ["Sessió 11 · Revisió d'objectius","Valorem els objectius inicials i els canvis percebuts. Explica que detecta abans alguns senyals de malestar i que ha pogut aplicar estratègies treballades. Mantenim el treball sobre l'autoexigència."],
        ["Sessió 15 · Seguiment i consolidació","Revisem els recursos incorporats i les situacions que encara generen dificultat. Acordem consolidar les estratègies, mantenir els registres quan siguin útils i continuar revisant els objectius en properes sessions."]
      ];
      const noteIndexes = [0,1,3,5,7,10,14];
      const patient = {
        id: patientKey,
        name: "Clàudia Ferrer",
        email: "",
        age: 31,
        modality: "Presencial",
        status: "En seguiment",
        created: "2026-08-10",
        reason: "Dificultats per gestionar l'ansietat i l'autoexigència en diferents àmbits de la vida quotidiana.",
        appointments: sessionDates.map((date, index) => ({ date, time: "17:00", type: index === 0 ? "Primera visita" : "Sessió de seguiment", status: "Realitzada", eventId: "sample-session-" + String(index + 1).padStart(2, "0") })),
        notes: noteIndexes.map((sessionIndex, index) => ({ id: "sample-note-" + (index + 1), date: sessionDates[sessionIndex], createdAt: sessionDates[sessionIndex] + "T17:00:00.000Z", updatedAt: sessionDates[sessionIndex] + "T17:00:00.000Z", title: noteContent[index][0], body: noteContent[index][1] }))
      };
      await env.GOOGLE_TOKEN_STORE.put(patientKey, JSON.stringify(patient));
      await env.GOOGLE_TOKEN_STORE.put(seedMarker, "1");
    }

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
