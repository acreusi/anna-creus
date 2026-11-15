export async function onRequestPost({ request, env }) {
  const json = (body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_STORE)return json({ok:false,message:"La configuració de Google no està completa."},500);
  const calendarId=await env.GOOGLE_TOKEN_STORE.get("google_calendar_id"),refreshToken=await env.GOOGLE_TOKEN_STORE.get("google_calendar_refresh_token"),timeZone=await env.GOOGLE_TOKEN_STORE.get("google_calendar_timezone")||"Europe/Madrid";
  if(!calendarId||!refreshToken)return json({ok:false,message:"El calendari encara no està configurat."},409);
  let body;try{body=await request.json();}catch{return json({ok:false,message:"La sol·licitud no és vàlida."},400);}
  const name=String(body.name||"").trim().slice(0,100),email=String(body.email||"").trim().slice(0,254),startMs=Date.parse(body.start||"");
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isFinite(startMs))return json({ok:false,message:"Revisa el nom, el correu i l'hora seleccionada."},400);
  if(startMs<Date.now()||startMs>Date.now()+370*86400000)return json({ok:false,message:"La data seleccionada ja no és vàlida."},400);
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(new Date(startMs)).map(x=>[x.type,x.value]));
  if(["Sat","Sun"].includes(parts.weekday))return json({ok:false,message:"La consulta està tancada aquest dia."},400);
  const dayStart=(hour,minute)=>{const target=Date.UTC(+parts.year,+parts.month-1,+parts.day,hour,minute);let guess=target;const f=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});for(let i=0;i<3;i++){const q=Object.fromEntries(f.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));guess+=target-Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute);}return guess;};
  const duration=3600000,close=dayStart(19,20),dayMin=dayStart(0,0),dayMax=dayStart(23,59);
  if(startMs+duration>close)return json({ok:false,message:"Aquesta hora queda fora de l'horari de reserva."},400);
  try{
    const tr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"})}),td=await tr.json();
    if(!tr.ok||!td.access_token)return json({ok:false,message:"No s'ha pogut connectar amb Google Calendar."},502);
    const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(calendarId)+"/events?"+new URLSearchParams({timeMin:new Date(dayMin).toISOString(),timeMax:new Date(dayMax).toISOString(),singleEvents:"true",orderBy:"startTime",maxResults:"2500"});
    const check=await fetch(url,{headers:{authorization:"Bearer "+td.access_token}}),data=await check.json();
    if(!check.ok)return json({ok:false,message:"No s'ha pogut verificar la disponibilitat."},502);
    const busy=(data.items||[]).filter(e=>e.status!=="cancelled"&&e.transparency!=="transparent"&&e.start&&e.end).map(e=>({start:e.start.dateTime?Date.parse(e.start.dateTime):dayMin,end:e.end.dateTime?Date.parse(e.end.dateTime):dayMax}));
    let candidate=dayStart(16,0),valid=false,guard=0;
    while(candidate+duration<=close&&guard++<12){const conflict=busy.filter(e=>candidate<e.end&&candidate+duration>e.start).sort((a,b)=>a.end-b.end)[0];if(conflict){candidate=conflict.end+600000;continue;}if(candidate===startMs){valid=true;break;}if(candidate>startMs)break;candidate+=duration;}
    if(!valid)return json({ok:false,message:"Aquesta hora ja no està disponible. Actualitza el calendari i tria una altra hora."},409);
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(calendarId+"|"+new Date(startMs).toISOString())),eventId=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const event={id:eventId,summary:"Cita — "+name,description:"Contacte: "+email,visibility:"private",start:{dateTime:new Date(startMs).toISOString(),timeZone},end:{dateTime:new Date(startMs+duration).toISOString(),timeZone}};
    const insert=await fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(calendarId)+"/events",{method:"POST",headers:{authorization:"Bearer "+td.access_token,"content-type":"application/json"},body:JSON.stringify(event)}),inserted=await insert.json();
    if(insert.status===409)return json({ok:false,message:"Una altra persona acaba de reservar aquesta hora. Actualitza el calendari i tria'n una altra."},409);
    if(!insert.ok)return json({ok:false,message:"Google Calendar no ha pogut desar la reserva."},502);
    return json({ok:true,bookingId:inserted.id});
  }catch(error){console.error("Booking failed:",error?.message||"Unknown error");return json({ok:false,message:"S'ha produït un error en confirmar la reserva."},500);}
}