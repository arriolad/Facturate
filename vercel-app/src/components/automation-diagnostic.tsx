"use client";

import { useEffect, useState } from "react";
import type { AutomationDiagnosis, AutomationJob } from "@/lib/facturate-workspace";
type Checkpoint={id:string;at:string;method:string;status:string;afterFinal:boolean;excerpt?:string;errorCode?:string;evidenceFileId?:string;selector?:string;field?:string};
type Tracking={pollCount:number;firstPollAt?:string;lastPollAt?:string;maxPollGapMs:number;idleMs:number;aiRequestedAt?:string;lastAiStatus?:string;lastAiStatusAt?:string;lastActivityAt?:string;lastError?:{code:string;message:string;at:string};errorCount:number};
const aiStatus:Record<string,string>={queued:'en cola',in_progress:'pensando',completed:'respondió',failed:'falló',cancelled:'cancelada',incomplete:'incompleta'};
const when=(value?:string)=>value?new Date(value).toLocaleString('es-MX'):'sin registro';
const minutes=(ms:number)=>ms<60_000?`${Math.round(ms/1000)} s`:`${Math.round(ms/60_000)} min`;
const stepStatus:Record<string,string>={attempting:'Intento registrado',observed:'Respuesta observada',completed:'Paso completado',rejected:'Paso rechazado',uncertain:'Respuesta incierta'};
const stepName:Record<string,string>={goto:'Abrir portal',getTabs:'Comprobar página',text:'Leer portal',snapshot:'Revisar campos',screenshot:'Capturar evidencia',type:'Llenar campo',select:'Seleccionar opción',checkbox:'Marcar opción',click:'Pulsar botón',solve:'Resolver CAPTCHA',verifyField:'Comprobar campo'};

/** Reads the existing result only. Never starts a browser or retries an invoice. */
export function AutomationDiagnostic({ ticketId, job, onRecover }: { ticketId: string; job: AutomationJob; onRecover?:(kind:"format"|"blank")=>void }) {
  const [recoverable,setRecoverable]=useState<"format"|"blank"|null>(null);
  const [diagnosis, setDiagnosis] = useState<AutomationDiagnosis | undefined>(job.diagnosis);
  const [tracking,setTracking]=useState<Tracking|null>(null);
  const [checkpoints,setCheckpoints]=useState<Checkpoint[]>([]),[legacy,setLegacy]=useState<string[]>([]),[image,setImage]=useState<string|null>(null);
  const [pendingInfo,setPendingInfo]=useState<{commands:string[];reserved:boolean;attempted:boolean;pending:boolean;session:boolean;recoveries:number}|null>(null);
  useEffect(() => {
    if (job.state !== "needs_review") return;
    const controller = new AbortController();
    void fetch(`/api/tickets/${encodeURIComponent(ticketId)}/automation-diagnostic`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const result = await response.json();
        if(result.jobId!==job.id)return;
        setCheckpoints(result.checkpoints??[]);setTracking(result.tracking??null);setLegacy(result.steps??[]);
        setPendingInfo({commands:(result.pendingCommands??[]).map((x:{method?:string;selector?:string})=>`${x.method??'desconocido'}${x.selector?` (${x.selector})`:''}`),reserved:Boolean(result.guard?.submissionReserved),attempted:Boolean(result.guard?.finalClickAttempted),pending:Boolean(result.guard?.pendingResponse),session:Boolean(result.guard?.sessionAvailable),recoveries:Number(result.guard?.recoveryCount??0)});
        setRecoverable(result.jobId!==job.id?null:result.blankRecoveryAvailable===true?"blank":result.formatRecoveryAvailable===true?"format":null);
        const value = result.diagnosis;
        if (result.jobId === job.id && typeof value?.code === "string" && typeof value.message === "string" && typeof value.recovery === "string") setDiagnosis(value);
      })
      .catch(() => { /* The saved message remains visible if inspection is unavailable. */ });
    return () => controller.abort();
  }, [ticketId, job.id, job.state, job.diagnosis]);
  const detail = job.diagnosis ?? diagnosis;
  return <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
    <strong>{detail?.code?.startsWith('PORTAL_')&&['PORTAL_MAINTENANCE','PORTAL_OVERLOADED'].includes(detail.code)?'Proceso pausado por disponibilidad del portal.':detail?.code === "LOGIN_REQUIRED_SESSION_CLOSED" ? "El portal pidió iniciar sesión y el navegador terminó." : job.state === "failed" ? "La solicitud necesita revisión." : "Resultado pendiente de verificación."}</strong>
    <p className="mt-2">{detail?.message ?? job.message}</p>
    {detail ? <p className="mt-2">{detail.recovery}</p> : null}
    {recoverable&&onRecover?<button className="mt-3 rounded-lg bg-[#2b9da8] px-4 py-2 font-semibold text-white" onClick={()=>onRecover(recoverable)}>{recoverable==="blank"?"Reabrir portal desde cero":"Retomar intento tras corregir formato"}</button>:null}
    {detail ? <p className="mt-2">No hay un acuse verificado de esta solicitud. La evidencia se conserva y el reenvío automático permanece bloqueado.</p> : null}
    <details className="mt-3 border-t border-amber-200 pt-3">
      <summary className="cursor-pointer font-semibold">Pasos y evidencia del intento</summary>
      {pendingInfo?<p className="mt-2">Envío final reservado: {pendingInfo.reserved?'sí':'no'} · Clic final intentado: {pendingInfo.attempted?'sí':'no'} · Respuesta pendiente: {pendingInfo.pending?'sí':'no'} · Sesión registrada: {pendingInfo.session?'sí':'no'} · Recuperaciones: {pendingInfo.recoveries} · Acciones pendientes: {pendingInfo.commands.join(', ')||'ninguna registrada'}.</p>:null}
      {checkpoints.length?<ol className="mt-2 space-y-3">{checkpoints.map(step=><li key={step.id} className="rounded-lg bg-white/70 p-3">
        <p className="font-semibold">{stepName[step.method]??step.method} · {stepStatus[step.status]??step.status}</p>
        <p>{new Date(step.at).toLocaleString('es-MX')}{step.afterFinal?' · Envío final iniciado o reservado para ejecución':''}</p>
        {step.excerpt?<p className="mt-1 whitespace-pre-wrap break-words">{step.excerpt}</p>:null}
        {step.errorCode?<p>Código: {step.errorCode}</p>:null}
        {step.selector?<p>Campo: {step.selector}{step.field?` · dato: ${step.field}`:''}</p>:null}
        {step.evidenceFileId?<button className="mt-1 underline" onClick={()=>setImage(image===step.evidenceFileId?null:step.evidenceFileId!)}>{image===step.evidenceFileId?'Ocultar captura':'Ver captura del paso'}</button>:null}
        {image===step.evidenceFileId&&image?<img className="mt-2 w-full rounded-lg border" src={`/api/tickets/${encodeURIComponent(ticketId)}/automation-evidence/${encodeURIComponent(image)}`} alt="Evidencia privada observada en este paso del portal"/>:null}
      </li>)}</ol>:tracking?<p className="mt-2">El navegador no llegó a ejecutar ningún paso en este intento.</p>:<p className="mt-2">Este intento es anterior al registro detallado por paso. No se generarán capturas retrospectivas ni se repetirá la solicitud para obtenerlas.</p>}
      {tracking?<div className="mt-3 rounded-lg bg-white/70 p-3">
        <p className="font-semibold">Seguimiento del intento</p>
        <p>Consultas de la página: {tracking.pollCount} · Primera: {when(tracking.firstPollAt)} · Última: {when(tracking.lastPollAt)}</p>
        <p>Pausa más larga sin consultar: {minutes(tracking.maxPollGapMs)}{tracking.maxPollGapMs>120_000?' (la pestaña estuvo cerrada o en segundo plano)':''}</p>
        <p>IA: {tracking.lastAiStatus?(aiStatus[tracking.lastAiStatus]??tracking.lastAiStatus):'sin registro'} · Pedida: {when(tracking.aiRequestedAt)} · Revisada: {when(tracking.lastAiStatusAt)}</p>
        <p>Última actividad: {when(tracking.lastActivityAt)}</p>
        <p>Errores de consulta: {tracking.errorCount}{tracking.lastError?` · Último: ${tracking.lastError.code} (${when(tracking.lastError.at)}) ${tracking.lastError.message}`:''}</p>
      </div>:null}
      {legacy.length?<details className="mt-3"><summary className="cursor-pointer">Decisiones registradas por el agente</summary><p>Describen lo que el agente pretendía hacer; por sí solas no prueban que el portal lo ejecutó.</p><ol className="list-decimal space-y-1 pl-5">{legacy.map((step,index)=><li key={index}>{step}</li>)}</ol></details>:null}
    </details>
    <PortalHealth ticketId={ticketId}/>
  </div>;
}

type Health={eligible?:boolean;status:string;message?:string;checkedAt?:string;evidenceFileId?:string};
function PortalHealth({ticketId}:{ticketId:string}){
 const endpoint=`/api/tickets/${encodeURIComponent(ticketId)}/portal-health`;
 const [health,setHealth]=useState<Health|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false);
 useEffect(()=>{const c=new AbortController();void fetch(endpoint,{cache:'no-store',signal:c.signal}).then(async r=>{if(r.ok)setHealth(await r.json());}).catch(()=>{});return()=>c.abort();},[endpoint]);
 const running=health?.status==='running';
 useEffect(()=>{if(!running)return;const c=new AbortController();let pending=false;const timer=window.setInterval(()=>{if(pending)return;pending=true;void fetch(endpoint,{cache:'no-store',signal:c.signal}).then(async r=>{if(r.ok)setHealth(await r.json());}).catch(()=>{}).finally(()=>{pending=false;});},3000);return()=>{c.abort();window.clearInterval(timer);};},[running,endpoint]);
 async function check(){if(busy||running)return;setBusy(true);setError('');setShow(false);try{const r=await fetch(endpoint,{method:'POST',headers:{'X-Facturate-Request':'1'},cache:'no-store'}),value=await r.json();if(!r.ok)throw new Error(value.message??'No pudimos comprobar el portal.');setHealth(value);}catch(e){setError(e instanceof Error?e.message:'No pudimos comprobar el portal.');}finally{setBusy(false);}}
 if(!health?.eligible)return null;
 return <section aria-label="Disponibilidad actual del portal" className="mt-4 border-t border-amber-200 pt-3">
  <p className="font-semibold">Disponibilidad actual de GOGAS</p>
  <p>Revisa solo la página pública, sin enviar el ticket ni datos fiscales. El resultado del intento anterior se conserva por separado.</p>
  <button disabled={busy||running} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold disabled:opacity-50" onClick={()=>void check()}>{busy||running?'Comprobando disponibilidad…':'Comprobar portal sin enviar datos'}</button>
  <p role="status" className="mt-2">{error||health.message}</p>
  {health.checkedAt?<p>Comprobado: {new Date(health.checkedAt).toLocaleString('es-MX')}</p>:null}
  {health.evidenceFileId?<button className="mt-2 underline" onClick={()=>setShow(v=>!v)}>{show?'Ocultar captura del estado del portal':'Ver captura del estado del portal'}</button>:null}
  {show&&health.evidenceFileId?<img className="mt-2 w-full rounded-lg border" src={`${endpoint}/evidence`} alt="Captura privada de la disponibilidad pública de GOGAS; no es confirmación de envío"/>:null}
 </section>;
}
