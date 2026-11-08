const translations = {
  ca: {
    brandSubtitle:"PSICOLOGIA", navHome:"Inici", navAbout:"Sobre mi", navServices:"Acompanyament", navMethod:"Metodologia", navContact:"Contacte", navCta:"Demana cita",
    heroEyebrow:"PSICOLOGIA · UN ESPAI PER A TU", heroTitle:"Un espai per entendre’t, cuidar-te i avançar.", heroLead:"Un acompanyament psicològic proper i individualitzat, amb una mirada respectuosa i basada en l’evidència.", heroButton:"Coneix aquest espai", heroBottom:"Un procés, al teu ritme.",
    aboutIndex:"SOBRE MI", aboutEyebrow:"UNA MIRADA PROPERA I SENSE JUDICIS", aboutTitle:"Cada persona té una història. I cada procés, el seu propi camí.", aboutText:"Aquest és un espai pensat per poder parlar del que et preocupa, comprendre millor què estàs vivint i trobar eines que t’ajudin en el teu dia a dia. Sense presses i partint de les teves necessitats.", aboutLink:"La manera de treballar",
    servicesIndex:"ACOMPANYAMENT", servicesEyebrow:"EN QUÈ PODEM TREBALLAR", servicesTitle:"Un espai per posar paraules, comprendre i fer canvis.", servicesIntro:"El punt de partida és sempre la persona: allò que necessita, el moment en què es troba i els seus objectius.", serviceOne:"Ansietat i preocupacions", serviceTwo:"Estat d’ànim i benestar emocional", serviceThree:"Autoestima i autoconeixement", serviceFour:"Canvis vitals i moments difícils", servicesNote:"Els àmbits d’acompanyament definitius es concretaran abans de l’obertura de la consulta.",
    methodIndex:"METODOLOGIA", methodEyebrow:"COM TREBALLAREM", methodTitle:"Comprendre què passa també és una manera de començar a canviar-ho.", methodOneTitle:"Escoltar", methodOneText:"Conèixer la teva situació, la teva història i què t’ha portat fins aquí.", methodTwoTitle:"Comprendre", methodTwoText:"Identificar patrons, necessitats i factors que poden estar influint en el teu malestar.", methodThreeTitle:"Avançar", methodThreeText:"Definir objectius i treballar amb eines adaptades a tu i al teu moment.",
    contactIndex:"CONTACTE", contactEyebrow:"UN PRIMER PAS", contactTitle:"Quan sigui el moment, podem començar parlant.", contactText:"La consulta i el sistema de reserva encara estan en preparació. Aquest espai s’actualitzarà amb tota la informació abans de començar a oferir visites.", comingSoon:"Properament", footerText:"Un espai per entendre’t, cuidar-te i avançar."
  },
  es: {
    brandSubtitle:"PSICOLOGÍA", navHome:"Inicio", navAbout:"Sobre mí", navServices:"Acompañamiento", navMethod:"Metodología", navContact:"Contacto", navCta:"Pide cita",
    heroEyebrow:"PSICOLOGÍA · UN ESPACIO PARA TI", heroTitle:"Un espacio para comprenderte, cuidarte y avanzar.", heroLead:"Un acompañamiento psicológico cercano e individualizado, desde una mirada respetuosa y basada en la evidencia.", heroButton:"Conoce este espacio", heroBottom:"Un proceso, a tu ritmo.",
    aboutIndex:"SOBRE MÍ", aboutEyebrow:"UNA MIRADA CERCANA Y SIN JUICIOS", aboutTitle:"Cada persona tiene una historia. Y cada proceso, su propio camino.", aboutText:"Este es un espacio pensado para poder hablar de lo que te preocupa, comprender mejor lo que estás viviendo y encontrar herramientas que te ayuden en tu día a día. Sin prisas y partiendo de tus necesidades.", aboutLink:"La forma de trabajar",
    servicesIndex:"ACOMPAÑAMIENTO", servicesEyebrow:"EN QUÉ PODEMOS TRABAJAR", servicesTitle:"Un espacio para poner palabras, comprender y hacer cambios.", servicesIntro:"El punto de partida es siempre la persona: lo que necesita, el momento en el que se encuentra y sus objetivos.", serviceOne:"Ansiedad y preocupaciones", serviceTwo:"Estado de ánimo y bienestar emocional", serviceThree:"Autoestima y autoconocimiento", serviceFour:"Cambios vitales y momentos difíciles", servicesNote:"Los ámbitos de acompañamiento definitivos se concretarán antes de la apertura de la consulta.",
    methodIndex:"METODOLOGÍA", methodEyebrow:"CÓMO TRABAJAREMOS", methodTitle:"Comprender qué ocurre también es una forma de empezar a cambiarlo.", methodOneTitle:"Escuchar", methodOneText:"Conocer tu situación, tu historia y qué te ha traído hasta aquí.", methodTwoTitle:"Comprender", methodTwoText:"Identificar patrones, necesidades y factores que pueden estar influyendo en tu malestar.", methodThreeTitle:"Avanzar", methodThreeText:"Definir objetivos y trabajar con herramientas adaptadas a ti y a tu momento.",
    contactIndex:"CONTACTO", contactEyebrow:"UN PRIMER PASO", contactTitle:"Cuando sea el momento, podemos empezar hablando.", contactText:"La consulta y el sistema de reserva todavía están en preparación. Este espacio se actualizará con toda la información antes de empezar a ofrecer visitas.", comingSoon:"Próximamente", footerText:"Un espacio para comprenderte, cuidarte y avanzar."
  }
};
const langButtons = document.querySelectorAll("[data-lang]");
function setLanguage(lang) {
  const copy = translations[lang] || translations.ca;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (copy[key]) el.textContent = copy[key];
  });
  langButtons.forEach(button => {
    const active = button.dataset.lang === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector(".menu-toggle").setAttribute("aria-label", lang === "ca" ? "Obrir menú" : "Abrir menú");
}
langButtons.forEach(button => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));
document.getElementById("year").textContent = new Date().getFullYear();
