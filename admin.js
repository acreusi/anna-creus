const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");

const calendarState = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: dateKey(new Date()),
  events: [],
  loadedMonth: null,
  loading: false
};

function dateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function zonedMidnightUtc(year, month, day) {
  const target = Date.UTC(year, month, day, 0, 0, 0);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    guess += target - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  }
  return guess;
}

function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
}
function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}
async function checkSession() {
  try {
    const response = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) showApp();
    else showLogin();
  } catch { showLogin(); }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Comprovant…";
  const form = new FormData(loginForm);
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "No s'ha pogut iniciar la sessió.");
    loginForm.reset();
    showApp();
  } catch (error) {
    loginError.textContent = error.message || "S'ha produït un error.";
  } finally {
    loginButton.disabled = false;
    loginButton.innerHTML = 'Entrar al meu espai <span>→</span>';
  }
});

document.querySelectorAll(".side-link").forEach(button => {
  button.addEventListener("click", () => {
    const section = button.dataset.section;
    document.querySelectorAll(".side-link").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".view-section").forEach(item => item.classList.toggle("active", item.id === "section-" + section));
    const titles = { overview: "Inici", calendar: "Calendari", patients: "Pacients", documents: "Documents", settings: "Configuració" };
    document.getElementById("pageTitle").textContent = titles[section] || "Inici";
    if (section === "calendar") loadCalendar();
    if (section === "patients") loadPatients();
  });
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
  showLogin();
});

const calendarGrid = document.getElementById("calendarGrid");
const calendarStatus = document.getElementById("calendarStatus");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarSelectedDate = document.getElementById("calendarSelectedDate");
const calendarEvents = document.getElementById("calendarEvents");

function renderSelectedDay() {
  const selected = new Date(calendarState.selectedDate + "T12:00:00+01:00");
  calendarSelectedDate.textContent = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(selected);
  calendarEvents.replaceChildren();
  const dayEvents = calendarState.events
    .filter(event => dateKey(new Date(event.start)) === calendarState.selectedDate)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  if (!dayEvents.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No hi ha cap cita programada aquest dia.";
    calendarEvents.append(empty);
    return;
  }

  for (const event of dayEvents) {
    const item = document.createElement("article");
    item.className = "calendar-event";
    const time = document.createElement("strong");
    if (event.allDay) time.textContent = "Tot el dia";
    else time.textContent = new Intl.DateTimeFormat("ca-ES", {
      timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(new Date(event.start));
    const name = document.createElement("button");
    name.type = "button";
    name.className = "calendar-event-patient";
    name.textContent = event.summary || "Cita";
    const linkedPatient = patientRecords.find(patient => (patient.appointments || []).some(appointment => appointment.eventId === event.id));
    if (linkedPatient) {
      name.addEventListener("click", async () => {
        document.querySelector('[data-section="patients"]').click();
        await loadPatients();
        openPatient(linkedPatient.id);
      });
    } else {
      name.disabled = true;
      name.title = "Aquesta cita encara no està vinculada a cap fitxa.";
    }
    item.append(time, name);
    const appointment = linkedPatient?.appointments?.find(entry => entry.eventId === event.id);
    if (appointment) {
      const status = document.createElement("select"); status.className = "appointment-status-select calendar-appointment-status";
      ["Programada","Realitzada","No presentada","Cancel·lada"].forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; status.append(option); });
      status.value = appointment.status || "Programada";
      status.addEventListener("change", async () => {
        status.disabled = true;
        try {
          const updatedPatient = await savePatientChange({patientId:linkedPatient.id,action:"appointment-status",eventId:event.id,status:status.value});
          linkedPatient.status = updatedPatient.status;
          patientState.value = updatedPatient.status || linkedPatient.status;
          calendarStatus.textContent = "Canvis desats";
        } catch(error) { alert(error.message); status.value=appointment.status || "Programada"; }
        finally { status.disabled = false; }
      });
      item.append(createText("small","calendar-control-label","Estat de la visita"),status);
      const patientState = document.createElement("select"); patientState.className = "patient-status-select calendar-patient-status";
      ["Primera visita pendent","En seguiment","Pendent de reprendre","Alta"].forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; patientState.append(option); });
      patientState.value = linkedPatient.status || "Primera visita pendent";
      patientState.addEventListener("change", async () => {
        patientState.disabled = true;
        try { await savePatientChange({patientId:linkedPatient.id,action:"patient-status",status:patientState.value}); }
        catch(error) { alert(error.message); patientState.value=linkedPatient.status || "Primera visita pendent"; }
        finally { patientState.disabled = false; }
      });
      item.append(createText("small","calendar-control-label","Estat del pacient"),patientState);
    }
    calendarEvents.append(item);
  }
}

function renderCalendar() {
  const year = calendarState.month.getFullYear();
  const month = calendarState.month.getMonth();
  calendarMonthLabel.textContent = new Intl.DateTimeFormat("ca-ES", {
    month: "long", year: "numeric"
  }).format(calendarState.month);

  const firstDay = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - mondayOffset));
  calendarGrid.replaceChildren();

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const dayEvents = calendarState.events.filter(event => dateKey(new Date(event.start)) === key);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    if (date.getUTCMonth() !== month) dayButton.classList.add("outside-month");
    if (key === calendarState.selectedDate) dayButton.classList.add("selected");
    if (key === dateKey(new Date())) dayButton.classList.add("today");
    dayButton.setAttribute("aria-label", key + (dayEvents.length ? ", " + dayEvents.length + " cites" : ""));
    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(date.getUTCDate());
    dayButton.append(number);
    if (dayEvents.length) {
      const marker = document.createElement("span");
      marker.className = "calendar-day-count";
      marker.textContent = String(dayEvents.length);
      dayButton.append(marker);
    }
    dayButton.addEventListener("click", () => {
      calendarState.selectedDate = key;
      renderCalendar();
      renderSelectedDay();
    });
    calendarGrid.append(dayButton);
  }
  renderSelectedDay();
}

async function loadCalendar(force = false) {
  if (calendarState.loading) return;
  const year = calendarState.month.getFullYear();
  const month = calendarState.month.getMonth();
  const monthKey = year + "-" + String(month + 1).padStart(2, "0");
  if (!force && calendarState.loadedMonth === monthKey) {
    renderCalendar();
    return;
  }

  calendarState.loading = true;
  calendarStatus.textContent = "Carregant…";
  calendarEvents.replaceChildren();
  // Render the month grid independently of Google Calendar availability.
  renderCalendar();
  const start = zonedMidnightUtc(year, month, 1);
  const end = zonedMidnightUtc(year, month + 1, 1);
  const params = new URLSearchParams({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString()
  });

  try {
    const response = await fetch("/api/admin/calendar?" + params.toString(), {
      credentials: "same-origin", cache: "no-store"
    });
    const data = await response.json();
    if (response.status === 401) {
      showLogin();
      throw new Error("La sessió ha caducat. Torna a iniciar sessió.");
    }
    if (!response.ok || !data.ok) throw new Error(data.message || "No s'ha pogut carregar el calendari.");
    calendarState.events = data.events || [];
    calendarState.loadedMonth = monthKey;
    calendarStatus.textContent = data.calendarName ? "Connectat · " + data.calendarName : "Google Calendar connectat";
    renderCalendar();
  } catch (error) {
    calendarStatus.textContent = "No s'ha pogut carregar";
    calendarEvents.replaceChildren();
    const message = document.createElement("p");
    message.className = "calendar-error";
    message.textContent = error.message || "S'ha produït un error.";
    calendarEvents.append(message);
  } finally {
    calendarState.loading = false;
  }
}

document.getElementById("calendarPrev").addEventListener("click", () => {
  calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() - 1, 1);
  calendarState.selectedDate = dateKey(calendarState.month);
  calendarState.loadedMonth = null;
  loadCalendar();
});
document.getElementById("calendarNext").addEventListener("click", () => {
  calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() + 1, 1);
  calendarState.selectedDate = dateKey(calendarState.month);
  calendarState.loadedMonth = null;
  loadCalendar();
});
document.getElementById("calendarToday").addEventListener("click", () => {
  const today = new Date();
  calendarState.month = new Date(today.getFullYear(), today.getMonth(), 1);
  calendarState.selectedDate = dateKey(today);
  calendarState.loadedMonth = null;
  loadCalendar();
});

checkSession();


// Patient records are loaded and updated through authenticated private API endpoints.
let patientRecords = [];
let activePatientId = null;

const patientList = document.getElementById("patientList");
const patientSearch = document.getElementById("patientSearch");
const patientCount = document.getElementById("patientCount");
const addPatientForm = document.getElementById("addPatientForm");
const patientsListView = document.getElementById("patientsListView");
const patientDetailView = document.getElementById("patientDetailView");
const patientDetail = document.getElementById("patientDetail");

function safeDateLabel(value) {
  if (!value) return "Data no indicada";
  const date = new Date(value + "T12:00:00");
  return new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "";
  return element;
}
async function loadPatients() {
  try {
    const response = await fetch("/api/admin/patients", { credentials:"same-origin", cache:"no-store" });
    if (response.status === 401) { showLogin(); return; }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "No s'han pogut carregar els pacients.");
    patientRecords = Array.isArray(data.patients) ? data.patients : [];
    renderPatientList();
  } catch (error) {
    patientList.replaceChildren(createText("p", "patient-empty-search", error.message || "No s'han pogut carregar els pacients."));
  }
}
function renderPatientList() {
  const query = (patientSearch.value || "").trim().toLocaleLowerCase("ca");
  const matches = patientRecords.filter(patient => (patient.name + " " + patient.email).toLocaleLowerCase("ca").includes(query));
  patientList.replaceChildren();
  patientCount.textContent = patientRecords.length + (patientRecords.length === 1 ? " pacient" : " pacients");
  if (!matches.length) {
    patientList.append(createText("p", "patient-empty-search", "No s'han trobat pacients amb aquesta cerca."));
    return;
  }
  matches.forEach(patient => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "patient-row";
    button.addEventListener("click", () => openPatient(patient.id));
    const initials = patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const avatar = createText("span", "patient-avatar", initials);
    const main = document.createElement("span"); main.className = "patient-row-main";
    main.append(createText("strong", "", patient.name), createText("small", "", patient.email || "Sense correu electrònic"));
    const meta = document.createElement("span"); meta.className = "patient-row-meta";
    meta.append(createText("span", "patient-status", patient.status), createText("small", "", "Última activitat: " + safeDateLabel(patient.notes.at(-1)?.date || patient.appointments.at(-1)?.date || patient.created)));
    const arrow = createText("span", "patient-row-arrow", "→");
    button.append(avatar, main, meta, arrow);
    patientList.append(button);
  });
}
function openPatient(id) {
  const patient = patientRecords.find(item => item.id === id);
  if (!patient) return;
  activePatientId = id;
  patientsListView.hidden = true;
  patientDetailView.hidden = false;
  renderPatientDetail();
}
async function savePatientChange(change) {
  const response = await fetch("/api/admin/patient", {method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...change,patientId:change.patientId || activePatientId})});
  const data = await response.json();
  if (response.status === 401) { showLogin(); throw new Error("La sessió ha caducat."); }
  if (!response.ok || !data.ok || !data.patient) throw new Error(data.message || "No s'han pogut desar els canvis.");
  const index = patientRecords.findIndex(item => item.id === data.patient.id);
  if (index >= 0) patientRecords[index] = data.patient;
  renderPatientList();
  return data.patient;
}
function renderPatientDetail() {
  const patient = patientRecords.find(item => item.id === activePatientId);
  if (!patient) return;
  patientDetail.replaceChildren();
  const heading = document.createElement("div"); heading.className = "patient-profile-heading";
  const avatar = createText("span", "patient-avatar patient-avatar-large", patient.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase());
  const titleWrap = document.createElement("div");
  titleWrap.append(createText("p", "eyebrow", "FITXA DE PACIENT"), createText("h2", "", patient.name));
  const patientStatus = document.createElement("select"); patientStatus.className = "patient-status-select";
  ["Primera visita pendent","En seguiment","Pendent de reprendre","Alta"].forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; patientStatus.append(option); });
  patientStatus.value = patient.status || "Primera visita pendent";
  patientStatus.addEventListener("change", async () => {
    patientStatus.disabled = true;
    try { await savePatientChange({action:"patient-status",status:patientStatus.value}); }
    catch(error) { alert(error.message); patientStatus.value=patient.status || "Primera visita pendent"; }
    finally { patientStatus.disabled = false; }
  });
  titleWrap.append(patientStatus); heading.append(avatar, titleWrap);
  patientDetail.append(heading);

  const columns = document.createElement("div"); columns.className = "patient-profile-grid";
  const info = document.createElement("section"); info.className = "patient-card";
  info.append(createText("p", "eyebrow", "DADES PERSONALS"), createText("h3", "", "Informació general"));
  const infoGrid = document.createElement("div"); infoGrid.className = "patient-info-grid";
  [["Correu electrònic",patient.email || "No indicat"],["Edat",patient.age ? patient.age + " anys" : "No indicada"],["Modalitat",patient.modality || "No especificada"],["Fitxa creada",safeDateLabel(patient.created)]].forEach(([label,value]) => {
    const item = document.createElement("div"); item.append(createText("small","",label),createText("strong","",value)); infoGrid.append(item);
  });
  info.append(infoGrid);
  const reason = document.createElement("section"); reason.className = "patient-card";
  reason.append(createText("p","eyebrow","INFORMACIÓ DE LA RESERVA"),createText("h3","","Motiu de consulta inicial"),createText("p","patient-reason",patient.reason || "No s'ha indicat cap motiu de consulta."));
  columns.append(info,reason); patientDetail.append(columns);

  const visits = document.createElement("section"); visits.className = "patient-card patient-history-card";
  visits.append(createText("p","eyebrow","HISTORIAL"),createText("h3","","Cites i visites"));
  const appointmentList = document.createElement("div"); appointmentList.className = "patient-timeline";
  const sortedAppointments = [...patient.appointments].sort((a,b)=>b.date.localeCompare(a.date));
  let showAllVisits = false;
  const renderAppointments = () => {
    appointmentList.replaceChildren();
    const visibleAppointments = showAllVisits ? sortedAppointments : sortedAppointments.slice(0,4);
    visibleAppointments.forEach(appointment => {
      const item = document.createElement("div"); item.className = "timeline-item";
      item.append(createText("strong","","" + safeDateLabel(appointment.date)),createText("span","",appointment.time + " · " + appointment.type));
      const status = document.createElement("select"); status.className = "appointment-status-select";
      ["Programada","Realitzada","No presentada","Cancel·lada"].forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; status.append(option); });
      status.value = appointment.status || "Programada";
      status.addEventListener("change", async () => {
        status.disabled = true;
        try { await savePatientChange({action:"appointment-status",eventId:appointment.eventId,status:status.value}); renderPatientDetail(); }
        catch(error) { alert(error.message); status.value=appointment.status || "Programada"; status.disabled=false; }
      });
      item.append(status); appointmentList.append(item);
    });
  };
  if (!sortedAppointments.length) appointmentList.append(createText("p","muted","Encara no hi ha visites registrades."));
  visits.append(createText("p","history-count",sortedAppointments.length + (sortedAppointments.length === 1 ? " visita en total" : " visites en total")));
  renderAppointments();
  if (sortedAppointments.length > 4) {
    const historyToggle = createText("button","history-toggle","Veure tot l'historial");
    historyToggle.type = "button";
    historyToggle.addEventListener("click", () => {
      showAllVisits = !showAllVisits;
      renderAppointments();
      historyToggle.textContent = showAllVisits ? "Mostrar menys visites" : "Veure tot l'historial";
    });
    visits.append(historyToggle);
  }
  visits.append(appointmentList); patientDetail.append(visits);

  const therapy = document.createElement("section"); therapy.className = "patient-card therapy-card";
  const therapyHead = document.createElement("div"); therapyHead.className = "therapy-heading";
  therapyHead.append(createText("div","eyebrow","SEGUIMENT TERAPÈUTIC"),createText("h3","","Notes de les sessions"));
  therapy.append(therapyHead);
  const noteForm = document.createElement("form"); noteForm.className = "therapy-note-form"; noteForm.id = "therapyNoteForm";
  const noteTitle = document.createElement("input"); noteTitle.name = "title"; noteTitle.placeholder = "Títol de la nota (p. ex. Sessió 2 · objectius)"; noteTitle.maxLength = 120; noteTitle.required = true;
  const noteBody = document.createElement("textarea"); noteBody.name = "body"; noteBody.rows = 4; noteBody.maxLength = 10000; noteBody.placeholder = "Escriu aquí les observacions, temes treballats, intervencions, evolució, tasques…"; noteBody.required = true;
  const noteActions = document.createElement("div"); noteActions.className = "patient-form-actions"; const saveNote = createText("button","","Afegir anotació"); saveNote.type = "submit"; saveNote.className = "patient-primary-button";
  noteForm.append(noteTitle,noteBody,noteActions); noteActions.append(saveNote);
  noteForm.addEventListener("submit", async event => {
    event.preventDefault();
    const values = new FormData(noteForm);
    saveNote.disabled = true;
    try {
      await savePatientChange({action:"add-note",title:String(values.get("title")).trim(),body:String(values.get("body")).trim()});
      renderPatientDetail();
    } catch(error) { alert(error.message); }
    finally { saveNote.disabled = false; }
  });
  therapy.append(noteForm);
  const notes = document.createElement("div"); notes.className = "therapy-notes";
  [...patient.notes].sort((a,b)=>String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || ""))).forEach(note => {
    const item = document.createElement("article"); item.className = "therapy-note";
    const head = document.createElement("div"); head.className = "therapy-note-head";
    head.append(createText("strong","",note.title),createText("time","",safeDateLabel(note.date)));
    item.append(head,createText("p","",note.body));
    const actions = document.createElement("div"); actions.className = "therapy-note-actions";
    const edit = createText("button","","Modificar"); edit.type = "button"; edit.className = "note-action";
    edit.addEventListener("click", () => {
      const title = prompt("Títol de la nota:", note.title); if (title === null) return;
      const body = prompt("Contingut de la nota:", note.body); if (body === null) return;
      if (!title.trim() || !body.trim()) { alert("El títol i el contingut no poden quedar buits."); return; }
      edit.disabled = true;
      savePatientChange({action:"edit-note",noteId:note.id,title:title.trim(),body:body.trim()}).then(renderPatientDetail).catch(error=>alert(error.message)).finally(()=>{edit.disabled=false;});
    });
    const remove = createText("button","","Eliminar"); remove.type = "button"; remove.className = "note-action note-delete";
    remove.addEventListener("click", () => {
      if (!confirm("Vols eliminar aquesta anotació? Aquesta acció no es pot desfer.")) return;
      remove.disabled = true;
      savePatientChange({action:"delete-note",noteId:note.id}).then(renderPatientDetail).catch(error=>alert(error.message)).finally(()=>{remove.disabled=false;});
    });
    actions.append(edit,remove); item.append(actions); notes.append(item);
  });
  if (!patient.notes.length) notes.append(createText("p","muted","Encara no hi ha anotacions. Pots afegir la primera sessió aquí."));
  therapy.append(notes); patientDetail.append(therapy);
}
document.getElementById("addPatientToggle").addEventListener("click", () => { addPatientForm.hidden = !addPatientForm.hidden; });
document.getElementById("closePatientForm").addEventListener("click", () => { addPatientForm.hidden = true; });
addPatientForm.addEventListener("submit", event => {
  event.preventDefault();
  const values = new FormData(addPatientForm);
  const name = String(values.get("name") || "").trim();
  if (!name) return;
  patientRecords.unshift({
    id: "local-" + Date.now(), name, email: String(values.get("email") || "").trim(),
    age: Number(values.get("age")) || null, modality: String(values.get("modality") || ""),
    status: "Primera visita pendent", created: new Date().toISOString().slice(0,10),
    reason: String(values.get("reason") || "").trim(), appointments: [], notes: []
  });
  addPatientForm.reset(); addPatientForm.hidden = true; renderPatientList();
});
patientSearch.addEventListener("input", renderPatientList);
document.getElementById("backToPatients").addEventListener("click", () => {
  activePatientId = null; patientDetailView.hidden = true; patientsListView.hidden = false;
});
renderPatientList();
loadPatients();
