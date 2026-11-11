"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Check={id?:string;status:string;eligible?:boolean;message?:string;evidenceFileId?:string;result?:{uuid:string;rfc:string;total:string;series:string;folio:string;status:string}};
export function InvoiceLookup({ticketId,onDownload,onVerified}:{ticketId:string;onDownload:(id:string)=>void;onVerified:()=>void}){
 const [check,setCheck]=useState<Check|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[showEvidence,setShowEvidence]=useState(false);
 const pending=useRef(false),reported=useRef<string|null>(null);
 const endpoint=`/api/tickets/${encodeURIComponent(ticketId)}/invoice-lookup`;
 useEffect(()=>{const c=new AbortController();void fetch(endpoint,{cache:'no-store',signal:c.signal}).then(async r=>{if(r.ok)setCheck(await r.json());}).catch(()=>{});return()=>c.abort();},[endpoint]);
 const active=check?.status==='queued'||check?.status==='running';
 useEffect(()=>{if(!active)return;const c=new AbortController();let inFlight=false;const timer=window.setInterval(()=>{if(inFlight)return;inFlight=true;void fetch(endpoint,{cache:'no-store',signal:c.signal}).then(async r=>{if(r.ok)setCheck(await r.json());}).catch(()=>{}).finally(()=>{inFlight=false;});},3000);return()=>{c.abort();window.clearInterval(timer);};},[active,endpoint]);
 useEffect(()=>{if(check?.status==='found'&&check.id&&reported.current!==check.id){reported.current=check.id;onVerified();}},[check?.status,check?.id,onVerified]);
 async function start(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const r=await fetch(endpoint,{method:'POST',headers:{'X-Facturate-Request':'1'},cache:'no-store'});const value=await r.json();if(!r.ok)throw new Error(value.message??'No pudimos iniciar la consulta.');setCheck(value);}catch(e){setError(e instanceof Error?e.message:'No pudimos iniciar la consulta.');}finally{pending.current=false;setBusy(false);}}
 if(!check?.eligible)return null;
 return <section aria-label="Consulta de facturas emitidas" className="mt-4 rounded-xl border border-[#c9dfe9] bg-white p-4 text-xs leading-6 text-[#15324c]">
  <p className="font-semibold">Consultar factura emitida en GOGAS</p>
  <p>Busca con el RFC y rastreo ya confirmados. Solo consulta; no vuelve a solicitar una factura.</p>
  {check.status!=='found'?<Button disabled={busy||active} onClick={()=>void start()} variant="outline" className="mt-3 whitespace-normal">{busy||active?'Consultando facturas emitidas…':'Consultar factura emitida sin reenviar'}</Button>:null}
  <p role="status" className="mt-3">{error||check.message}</p>
  {check.result?<p className="mt-2 break-all">UUID: {check.result.uuid}<br/>RFC: {check.result.rfc} · Total: ${check.result.total}</p>:null}
  {check.evidenceFileId?<Button variant="outline" className="mt-3 whitespace-normal" onClick={()=>setShowEvidence(v=>!v)}>{showEvidence?'Ocultar evidencia de la consulta':'Ver evidencia de la consulta'}</Button>:null}
  {showEvidence&&check.evidenceFileId?<a href={`${endpoint}/evidence`} target="_blank" rel="noreferrer"><img src={`${endpoint}/evidence`} alt="Captura privada del resultado real de la consulta de GOGAS" className="mt-3 w-full rounded-lg border border-[#dce7f0]"/></a>:null}
  {check.evidenceFileId?<Button variant="outline" className="mt-3 whitespace-normal" onClick={()=>onDownload(check.evidenceFileId!)}>Descargar evidencia de la consulta</Button>:null}
 </section>;
}
