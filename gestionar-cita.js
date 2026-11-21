(() => {
  const token=new URLSearchParams(location.search).get("token")||"", $=id=>document.getElementById(id);
  let language="ca",timeZone="Europe/Madrid",currentStart=null,busy=[],selectedDate="",visibleMonth="";
  const strings={
    ca:{eyebrow:"GESTIÓ DE LA CITA",title:"Gestiona la teva cita",intro:"Aquí pots consultar, modificar o cancel·lar la teva reserva.",loading:"Carregant la informació de la cita…",current:"La teva cita actual",date:"Tria una nova data",time:"Hores disponibles",choose:"Selecciona primer una data",none:"No hi ha hores disponibles aquest dia.",change:"Modificar la cita",cancel:"Cancel·lar la cita",note:"Pots modificar o cancel·lar la cita fins a 24 hores abans. Després d'aquest termini, contacta directament amb Anna.",invalid:"Aquest enllaç no és vàlid o la cita ja no està activa.",locked:"Ja no es pot modificar ni cancel·lar aquesta cita perquè falten menys de 24 hores. Contacta directament amb l'Anna.",changed:"La cita s'ha modificat correctament.",cancelled:"La cita s'ha cancel·lat correctament.",confirm:"Segur que vols cancel·lar aquesta cita?",error:"No s'ha pogut completar l'acció. Torna-ho a provar.",selectDate:"Selecciona una hora disponible",email:"T'enviarem un correu amb la confirmació del canvi.",monthError:"No s'ha pogut consultar la disponibilitat d'aquest mes.",available:"Disponible",partial:"Algunes hores ocupades",unavailable:"No disponible"},
    es:{eyebrow:"GESTIÓN DE LA CITA",title:"Gestiona tu cita",intro:"Aquí puedes consultar, modificar o cancelar tu reserva.",loading:"Cargando la información de la cita…",current:"Tu cita actual",date:"Elige una nueva fecha",time:"Horarios disponibles",choose:"Selecciona primero una fecha",none:"No hay horarios disponibles este día.",change:"Modificar la cita",cancel:"Cancelar la cita",note:"Puedes modificar o cancelar la cita hasta 24 horas antes. Después de ese plazo, contacta directamente con Anna.",invalid:"Este enlace no es válido o la cita ya no está activa.",locked:"Ya no se puede modificar ni cancelar esta cita porque faltan menos de 24 horas. Contacta directamente con Anna.",changed:"La cita se ha modificado correctamente.",cancelled:"La cita se ha cancelado correctamente.",confirm:"¿Seguro que quieres cancelar esta cita?",error:"No se ha podido completar la acción. Inténtalo de nuevo.",selectDate:"Selecciona un horario disponible",email:"Te enviaremos un correo con la confirmación del cambio.",monthError:"No se ha podido consultar la disponibilidad de este mes.",available:"Disponible",partial:"Algunas horas ocupadas",unavailable:"No disponible"}
  };
  const t=k=>strings[language][k];
  function status(msg,error=false){$("status").textContent=msg;$("status").classList.toggle("manage-error",error);}
  function parts(ms){return Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));}
  function dayStart(p,h,m){const target=Date.UTC(+p.year,+p.month-1,+p.day,h,m);let guess=target;const fmt=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});for(let i=0;i<3;i++){const q=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));guess+=target-Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute);}return guess;}
  const keyParts=k=>({year:k.slice(0,4),month:k.slice(5,7),day:k.slice(8,10)});
  const key=(y,m,d)=>String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  function localDate(ms){const p=parts(ms);return p.year+"-"+p.month+"-"+p.day;}
  function time(ms){return new Intl.DateTimeFormat(language==="es"?"es-ES":"ca-ES",{timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms));}
  function slots(date){
    const p=keyParts(date),weekday=parts(dayStart(p,12,0)).weekday;
    if(["Sat","Sun"].includes(weekday)||date<localDate(Date.now()))return [];
    let candidate=dayStart(p,16,0),close=dayStart(p,19,20),out=[],guard=0;
    while(candidate+3600000<=close&&guard++<20){
      const conflict=busy.filter(e=>candidate<e.end&&candidate+3600000>e.start).sort((a,b)=>a.end-b.end)[0];
      if(conflict){candidate=conflict.end+600000;continue;}
      if(candidate>Date.now()&&candidate!==currentStart)out.push(candidate);
      candidate+=3600000;
    }
    return out;
  }
  function renderCalendar(){
    const [y,m]=visibleMonth.split("-").map(Number),firstWeekday=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(y,m,0)).getUTCDate(),grid=$("calendarDays");
    grid.innerHTML="";
    for(let i=0;i<firstWeekday;i++){const blank=document.createElement("span");blank.className="manage-calendar-day empty";grid.appendChild(blank);}
    for(let d=1;d<=days;d++){
      const date=key(y,m,d),p=keyParts(date),start=dayStart(p,16,0),end=dayStart(p,19,20),weekday=parts(dayStart(p,12,0)).weekday,weekend=["Sat","Sun"].includes(weekday),options=slots(date),unavailable=weekend||date<localDate(Date.now())||!options.length,hasBusy=busy.some(e=>start<e.end&&end>e.start);
      const b=document.createElement("button");b.type="button";b.textContent=String(d);b.className="manage-calendar-day";
      if(unavailable)b.disabled=true;else b.classList.add("available");
      if(hasBusy&&options.length)b.classList.add("partial");
      if(date===selectedDate)b.classList.add("selected");
      b.setAttribute("aria-label",date+" — "+(unavailable?t("unavailable"):hasBusy?t("partial"):t("available")));
      b.title=unavailable?t("unavailable"):hasBusy?t("partial"):t("available");
      b.addEventListener("click",()=>selectDay(date));grid.appendChild(b);
    }
    $("monthLabel").textContent=new Intl.DateTimeFormat(language==="es"?"es-ES":"ca-ES",{month:"long",year:"numeric"}).format(new Date(Date.UTC(y,m-1,15,12)));
    const now=new Date(),min=key(now.getFullYear(),now.getMonth()+1,1).slice(0,7),maxDate=new Date(now.getFullYear(),now.getMonth()+11,1),max=key(maxDate.getFullYear(),maxDate.getMonth()+1,1).slice(0,7);
    $("monthPrev").disabled=visibleMonth<=min;$("monthNext").disabled=visibleMonth>=max;
  }
  async function loadMonth(month){
    if(visibleMonth&&visibleMonth!==month){selectedDate="";$("newTime").innerHTML="";$("newTime").disabled=true;$("rescheduleButton").disabled=true;}
    visibleMonth=month;$("calendarDays").innerHTML="";
    const [y,m]=month.split("-").map(Number),start=dayStart({year:String(y),month:String(m).padStart(2,"0"),day:"01"},0,0),next=new Date(Date.UTC(y,m,1,12)),end=dayStart({year:String(next.getUTCFullYear()),month:String(next.getUTCMonth()+1).padStart(2,"0"),day:"01"},0,0);
    try{
      const r=await fetch("/api/google/availability?start="+encodeURIComponent(new Date(start).toISOString())+"&end="+encodeURIComponent(new Date(end).toISOString()),{cache:"no-store"}),data=await r.json();
      if(!r.ok||!data.ok)throw new Error(data.message||t("monthError"));
      timeZone=data.timeZone||timeZone;busy=(data.busy||[]).map(e=>({start:e.allDay?start:Date.parse(e.start),end:e.allDay?end:Date.parse(e.end)}));renderCalendar();
      if(selectedDate&&selectedDate.slice(0,7)===visibleMonth)renderTimes();
    }catch(e){$("calendarDays").textContent=t("monthError");status(e.message||t("monthError"),true);}
  }
  function selectDay(date){selectedDate=date;renderCalendar();renderTimes();}
  function renderTimes(){
    const select=$("newTime"),button=$("rescheduleButton"),options=slots(selectedDate);select.innerHTML="";
    button.disabled=true;
    if(!selectedDate){select.add(new Option(t("choose"),""));select.disabled=true;return;}
    if(!options.length){select.add(new Option(t("none"),""));select.disabled=true;return;}
    select.add(new Option(t("selectDate"),""));options.forEach(ms=>select.add(new Option(time(ms),new Date(ms).toISOString())));select.disabled=false;
  }
  async function init(){
    if(!token){$("loading").textContent=t("invalid");return;}
    try{
      const r=await fetch("/api/booking/manage?token="+encodeURIComponent(token),{cache:"no-store"}),data=await r.json();
      if(!r.ok||!data.ok){$("loading").textContent=data.message||t("invalid");return;}
      language=data.language==="es"?"es":"ca";currentStart=Date.parse(data.start);document.documentElement.lang=language;
      $("eyebrow").textContent=t("eyebrow");$("title").textContent=t("title");$("intro").textContent=t("intro");$("loading").classList.add("manage-hidden");$("content").classList.remove("manage-hidden");
      $("appointmentLabel").textContent=t("current");$("appointmentDate").textContent=data.date;$("appointmentTime").textContent=data.time;$("dateLabel").textContent=t("date");$("timeLabel").textContent=t("time");$("rescheduleButton").textContent=t("change");$("cancelButton").textContent=t("cancel");$("cutoffNote").textContent=t("note");
      if(!data.canManage){$("controls").classList.add("manage-hidden");status(data.message||t("locked"),true);return;}
      $("monthPrev").addEventListener("click",()=>{const [y,m]=visibleMonth.split("-").map(Number),d=new Date(Date.UTC(y,m-2,1));loadMonth(key(d.getUTCFullYear(),d.getUTCMonth()+1,1).slice(0,7));});
      $("monthNext").addEventListener("click",()=>{const [y,m]=visibleMonth.split("-").map(Number),d=new Date(Date.UTC(y,m,1));loadMonth(key(d.getUTCFullYear(),d.getUTCMonth()+1,1).slice(0,7));});
      $("newTime").addEventListener("change",()=>{$("rescheduleButton").disabled=!$("newTime").value;});
      $("rescheduleButton").addEventListener("click",reschedule);$("cancelButton").addEventListener("click",cancel);
      const now=new Date();await loadMonth(key(now.getFullYear(),now.getMonth()+1,1).slice(0,7));
    }catch(e){$("loading").textContent=t("error");}
  }
  async function reschedule(){
    const start=$("newTime").value;if(!start)return;$("rescheduleButton").disabled=true;status("");
    try{const r=await fetch("/api/booking/reschedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,start})}),data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message||t("error"));$("appointmentDate").textContent=data.date;$("appointmentTime").textContent=data.time;$("controls").classList.add("manage-hidden");status(t("changed")+" "+(data.emailSent?t("email"):""));}
    catch(e){status(e.message||t("error"),true);$("rescheduleButton").disabled=false;}
  }
  async function cancel(){
    if(!confirm(t("confirm")))return;$("cancelButton").disabled=true;status("");
    try{const r=await fetch("/api/booking/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}),data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message||t("error"));$("controls").classList.add("manage-hidden");status(t("cancelled"));}
    catch(e){status(e.message||t("error"),true);$("cancelButton").disabled=false;}
  }
  init();
})();