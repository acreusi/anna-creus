(() => {
  const token = new URLSearchParams(location.search).get("token") || "";
  const $ = id => document.getElementById(id);
  let language = "ca", timeZone = "Europe/Madrid", currentStart = null, busy = [];
  const text = {
    ca:{eyebrow:"GESTIÓ DE LA CITA",title:"Gestiona la teva cita",intro:"Aquí pots consultar, modificar o cancel·lar la teva reserva.",loading:"Carregant la informació de la cita…",current:"La teva cita actual",date:"Tria una nova data",time:"Hores disponibles",choose:"Selecciona primer una data",none:"No hi ha hores disponibles aquest dia.",change:"Modificar la cita",cancel:"Cancel·lar la cita",note:"Pots modificar o cancel·lar la cita fins a 24 hores abans. Després d'aquest termini, contacta directament amb Anna.",invalid:"Aquest enllaç no és vàlid o la cita ja no està activa.",locked:"Ja no es pot modificar ni cancel·lar aquesta cita perquè falten menys de 24 hores. Contacta directament amb l'Anna.",changed:"La cita s'ha modificat correctament.",cancelled:"La cita s'ha cancel·lat correctament.",confirm:"Segur que vols cancel·lar aquesta cita?",error:"No s'ha pogut completar l'acció. Torna-ho a provar.",selectDate:"Selecciona una hora disponible",loadingTimes:"Consultant les hores…",datePast:"La data ha de ser futura.",email:"T'enviarem un correu amb la confirmació del canvi."},
    es:{eyebrow:"GESTIÓN DE LA CITA",title:"Gestiona tu cita",intro:"Aquí puedes consultar, modificar o cancelar tu reserva.",loading:"Cargando la información de la cita…",current:"Tu cita actual",date:"Elige una nueva fecha",time:"Horarios disponibles",choose:"Selecciona primero una fecha",none:"No hay horarios disponibles este día.",change:"Modificar la cita",cancel:"Cancelar la cita",note:"Puedes modificar o cancelar la cita hasta 24 horas antes. Después de ese plazo, contacta directamente con Anna.",invalid:"Este enlace no es válido o la cita ya no está activa.",locked:"Ya no se puede modificar ni cancelar esta cita porque faltan menos de 24 horas. Contacta directamente con Anna.",changed:"La cita se ha modificado correctamente.",cancelled:"La cita se ha cancelado correctamente.",confirm:"¿Seguro que quieres cancelar esta cita?",error:"No se ha podido completar la acción. Inténtalo de nuevo.",selectDate:"Selecciona un horario disponible",loadingTimes:"Consultando los horarios…",datePast:"La fecha debe ser futura.",email:"Te enviaremos un correo con la confirmación del cambio."}
  };
  const t = key => text[language][key];
  function setStatus(message,error=false){$("status").textContent=message;$("status").classList.toggle("manage-error",error);}
  function parts(ms){return Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));}
  function dayStart(p,h,m){const target=Date.UTC(+p.year,+p.month-1,+p.day,h,m);let guess=target;const fmt=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});for(let i=0;i<3;i++){const q=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));guess+=target-Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute);}return guess;}
  function localDate(ms){const p=parts(ms);return p.year+"-"+p.month+"-"+p.day;}
  function formatTime(ms){return new Intl.DateTimeFormat(language==="es"?"es-ES":"ca-ES",{timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms));}
  async function loadTimes(){
    const date=$("newDate").value, select=$("newTime"), button=$("rescheduleButton");
    select.innerHTML='<option value="">'+t("loadingTimes")+'</option>';select.disabled=true;button.disabled=true;
    if(!date)return;
    const p={year:date.slice(0,4),month:date.slice(5,7),day:date.slice(8,10)};
    const dayMs=dayStart(p,12,0);
    if(dayMs<Date.now()-86400000){select.innerHTML='<option value="">'+t("datePast")+'</option>';return;}
    try{
      const min=dayStart(p,0,0),max=dayStart(p,23,59);
      const response=await fetch("/api/google/availability?start="+encodeURIComponent(new Date(min).toISOString())+"&end="+encodeURIComponent(new Date(max).toISOString()),{cache:"no-store"});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||"Availability error");
      busy=(data.busy||[]).map(e=>({start:e.allDay?min:Date.parse(e.start),end:e.allDay?max:Date.parse(e.end)}));
      let candidate=dayStart(p,16,0),close=dayStart(p,19,20),options=[],guard=0;
      if(["Sat","Sun"].includes(parts(dayMs).weekday))candidate=close;
      while(candidate+3600000<=close&&guard++<20){
        const conflict=busy.filter(e=>candidate<e.end&&candidate+3600000>e.start).sort((a,b)=>a.end-b.end)[0];
        if(conflict){candidate=conflict.end+600000;continue;}
        if(candidate>Date.now() && candidate!==currentStart)options.push(candidate);
        candidate+=3600000;
      }
      select.innerHTML="";
      if(!options.length){select.innerHTML='<option value="">'+t("none")+'</option>';return;}
      select.add(new Option(t("selectDate"),""));
      options.forEach(ms=>select.add(new Option(formatTime(ms),new Date(ms).toISOString())));
      select.disabled=false;
    }catch(e){select.innerHTML='<option value="">'+t("error")+'</option>';setStatus(e.message||t("error"),true);}
  }
  async function init(){
    if(!token){$("loading").textContent=t("invalid");return;}
    try{
      const response=await fetch("/api/booking/manage?token="+encodeURIComponent(token),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok||!data.ok){$("loading").textContent=data.message||t("invalid");return;}
      language=data.language==="es"?"es":"ca";currentStart=Date.parse(data.start);
      document.documentElement.lang=language;
      $("eyebrow").textContent=t("eyebrow");$("title").textContent=t("title");$("intro").textContent=t("intro");$("loading").classList.add("manage-hidden");$("content").classList.remove("manage-hidden");
      $("appointmentLabel").textContent=t("current");$("appointmentDate").textContent=data.date;$("appointmentTime").textContent=data.time;
      $("dateLabel").textContent=t("date");$("timeLabel").textContent=t("time");$("rescheduleButton").textContent=t("change");$("cancelButton").textContent=t("cancel");$("cutoffNote").textContent=t("note");
      if(!data.canManage){$("controls").classList.add("manage-hidden");setStatus(data.message||t("locked"),true);return;}
      const today=localDate(Date.now());$("newDate").min=today;$("newDate").addEventListener("change",loadTimes);
      $("newTime").addEventListener("change",()=>{$("rescheduleButton").disabled=!$("newTime").value;});
      $("rescheduleButton").addEventListener("click",reschedule);
      $("cancelButton").addEventListener("click",cancel);
    }catch(e){$("loading").textContent=t("error");}
  }
  async function reschedule(){
    const start=$("newTime").value;if(!start)return;
    $("rescheduleButton").disabled=true;setStatus("");
    try{
      const response=await fetch("/api/booking/reschedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,start})});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||t("error"));
      $("appointmentDate").textContent=data.date;$("appointmentTime").textContent=data.time;$("controls").classList.add("manage-hidden");
      setStatus(t("changed")+" "+(data.emailSent?t("email"):""));
    }catch(e){setStatus(e.message||t("error"),true);$("rescheduleButton").disabled=false;}
  }
  async function cancel(){
    if(!confirm(t("confirm")))return;
    $("cancelButton").disabled=true;setStatus("");
    try{
      const response=await fetch("/api/booking/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||t("error"));
      $("controls").classList.add("manage-hidden");setStatus(t("cancelled"));
    }catch(e){setStatus(e.message||t("error"),true);$("cancelButton").disabled=false;}
  }
  init();
})();