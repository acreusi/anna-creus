const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");

async function checkSession() {
  try {
    const response = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) showApp();
    else showLogin();
  } catch { showLogin(); }
}
function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
}
function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
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
  });
});
document.getElementById("logoutButton").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
  showLogin();
});
checkSession();
