"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export type PortalAccessOptions={loginEmail:string;allowEmailAttempt:boolean;useSavedSession:boolean};
type Connection={id:string;email:string;status:string;liveUrl?:string;expiresAt?:string};
type Settings={host:string;accounts:Connection[]};
export function PortalConnection({ticketId,access,onChange,onBusyChange,disabled}:{ticketId:string;access:PortalAccessOptions;onChange:(value:PortalAccessOptions)=>void;onBusyChange:(value:boolean)=>void;disabled:boolean}) {
  const [settings,setSettings]=useState<Settings>();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [failure,setFailure]=useState(false);
  const [confirmation,setConfirmation]=useState<{path:string;method:string;data?:object;title:string;description:string}>();
  const base=`/api/tickets/${encodeURIComponent(ticketId)}/portal-account`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(base,{cache:"no-store",signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("No se pudieron consultar las conexiones. Recarga el ticket para comprobar su estado.");
      setSettings(await response.json());setFailure(false);
    }).catch(error=>{if(!controller.signal.aborted){setFailure(true);setMessage(error.message);}});
    return ()=>controller.abort();
  },[base]);
  async function mutate(path:string,method:string,data?:object){
    if(busy)return;
    setBusy(true);onBusyChange(true);setMessage("");
    try {
      const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json","X-Facturate-Request":"1"},body:data?JSON.stringify(data):undefined,cache:"no-store"});
      const result=await response.json();if(!response.ok)throw new Error(result.message??"No se pudo completar la conexión.");
      const refreshed=await fetch(base,{cache:"no-store"});if(!refreshed.ok)throw new Error("Recarga el ticket para comprobar el estado de la conexión.");
      setSettings(await refreshed.json());setFailure(false);
      setMessage(method==="DELETE"?result.message:result.status==="blocked"?"El comercio bloqueó este navegador antes del inicio de sesión. No se guardó una cuenta personal. Puedes consultar la evidencia en el navegador o probar una nueva conexión.":path.endsWith("/save")?"Sesión guardada para este correo y comercio. Se usará en próximas solicitudes; el comercio puede exigir acceso de nuevo.":"Abre el navegador seguro, inicia sesión y vuelve aquí para guardar la conexión. Este paso no solicita una factura.");
    }catch(error){setMessage(error instanceof Error?error.message:"No se pudo completar la conexión.");}
    finally{setBusy(false);onBusyChange(false);}
  }
  const selected=settings?.accounts.find(account=>account.email.toLowerCase()===access.loginEmail.trim().toLowerCase());
  const ready=selected?.status==="saved";
  return <section aria-label="Acceso al portal y sesiones guardadas" className="mt-4 space-y-3 rounded-xl border border-[#cde0ed] bg-white p-4 text-xs leading-6">
    <p className="font-semibold">Acceso al portal{settings?` · ${settings.host}`:""}</p>
    <p>Primero intentaremos facturar como invitado. Si el portal exige acceso, usaremos una sesión guardada o intentaremos continuar con el correo indicado. Solo te pediremos intervenir si hace falta contraseña, código u otro paso personal. Después el agente seguirá con la facturación.</p>
    <label className="block font-semibold">Correo para intentar el acceso<Input type="email" autoComplete="email" maxLength={254} value={access.loginEmail} disabled={disabled||busy} onChange={event=>onChange({...access,loginEmail:event.target.value})}/></label>
    <p>Este correo puede ser diferente del correo de entrega de la factura. No cambia tu perfil fiscal.</p>
    <label className="flex items-start gap-2"><input type="checkbox" checked={access.allowEmailAttempt} disabled={disabled||busy} onChange={event=>onChange({...access,allowEmailAttempt:event.target.checked})}/>Autorizo intentar el acceso con este correo; el comercio podría enviarme un código o enlace.</label>
    <label className="flex items-start gap-2"><input type="checkbox" checked={access.useSavedSession} disabled={disabled||busy} onChange={event=>onChange({...access,useSavedSession:event.target.checked})}/>Usar mi sesión guardada para este correo y comercio cuando esté disponible.</label>
    {selected?.status==="blocked"?<p className="font-semibold text-amber-800">El comercio bloqueó el acceso de este navegador. Tu cuenta todavía no está conectada. No se puede guardar esta pantalla como sesión iniciada.</p>:null}
    {selected?.status==="blocked"&&selected.liveUrl?<Button type="button" variant="outline" onClick={()=>window.open(selected.liveUrl,"_blank","noopener,noreferrer")}>Ver bloqueo del portal</Button>:null}
    {selected?.status==="needs_login"?<p className="text-amber-800">El comercio volvió a pedir acceso. Actualiza la conexión antes de reutilizarla.</p>:null}
    {ready?<p className="font-semibold text-emerald-800">Sesión guardada para {selected.email}.</p>:null}
    {settings?.accounts.filter(account=>account.id!==selected?.id).map(account=><Button key={account.id} size="sm" variant="outline" disabled={disabled||busy} onClick={()=>onChange({...access,loginEmail:account.email,useSavedSession:true})}>{account.status==="saved"?"Usar conexión de":"Revisar conexión de"} {account.email}</Button>)}
    <p>Para recordar un acceso nuevo, inicia sesión en el navegador seguro y confirma que deseas guardarlo. Browserless conservará el estado de acceso; Factúrate no almacena tu contraseña. Cada conexión es personal y está separada por comercio. Consume una sesión de tu plan.</p>
    {selected?.status==="connecting"&&selected.liveUrl?<>
      <p>Acceso pendiente{selected.expiresAt?` · disponible hasta ${new Date(selected.expiresAt).toLocaleString("es-MX")}`:""}. Abre la sesión y completa el acceso; cierra la vista remota al terminar y regresa para guardar.</p>
      <Button type="button" variant="outline" disabled={busy} onClick={()=>window.open(selected.liveUrl,"_blank","noopener,noreferrer")}>Abrir navegador seguro de acceso</Button>
      <Button type="button" disabled={busy} className="whitespace-normal bg-[#2b9da8]" onClick={()=>setConfirmation({path:`/${encodeURIComponent(selected.id)}/save`,method:"POST",data:{signedIn:true,rememberSession:true},title:"Guardar tu sesión personal",description:"Confirma que ya iniciaste sesión con "+selected.email+". Browserless conservará tu acceso para reutilizarlo desde tu cuenta de Factúrate en este comercio. No se guardará tu contraseña en Factúrate ni se solicitará una factura ahora."})}>Ya inicié sesión: guardar conexión</Button>
    </>:<Button type="button" variant="outline" disabled={disabled||busy||!settings||failure||!access.loginEmail.includes("@")} onClick={()=>setConfirmation({path:"/connect",method:"POST",data:{email:access.loginEmail,rememberSession:true},title:"Conectar tu cuenta del comercio",description:"Conectaremos "+access.loginEmail+" con "+settings?.host+". Inicia sesión en el navegador remoto y luego confirma el guardado. Browserless conservará tu acceso para próximas solicitudes. No se solicitará una factura en este paso."})}>{selected?.status==="blocked"?"Probar una nueva conexión":ready?"Actualizar acceso guardado":"Conectar y recordar sesión"}</Button>}
    {selected?<Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirmation({path:`/${encodeURIComponent(selected.id)}`,method:"DELETE",title:"Eliminar conexión guardada",description:"Factúrate dejará de reutilizar esta conexión. Esto no detiene una solicitud en proceso ni cierra tus otras sesiones del comercio."})}>Desconectar este correo</Button>:null}
    <AlertDialog open={Boolean(confirmation)} onOpenChange={open=>{if(!open)setConfirmation(undefined);}}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>{confirmation?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={()=>{const action=confirmation;setConfirmation(undefined);if(action)void mutate(action.path,action.method,action.data);}}>Confirmar conexión</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <p role="status" aria-live="polite">{busy?"Procesando la conexión; no se está solicitando una factura…":message}</p>
  </section>;
}
