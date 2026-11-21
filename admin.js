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
    const name = document.createElement("span");
    name.textContent = event.summary || "Cita";
    item.append(time, name);
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
