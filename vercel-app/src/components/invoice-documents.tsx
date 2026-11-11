'use client';
import { useId,useState } from 'react';
import type { Ticket } from '@/lib/facturate-workspace';
import { invoiceStatusLabel } from '@/lib/invoice-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export type InvoiceAssociation={allocations?:Array<{ticketId:string;amount:string}>;reason?:string;replacesInvoiceId?:string;invoiceId?:string;confirmed?:boolean};
export function InvoiceDocuments({ticket,tickets,allowed,disabled,onImport,onAction,onDownload}:{ticket:Ticket;tickets:Ticket[];allowed:boolean;disabled:boolean;onImport:(file:File,kind:string,options?:InvoiceAssociation)=>Promise<void>;onAction:(id:string,action:string,revision:number,reason?:string)=>Promise<void>;onDownload:(id:string)=>void}){
 const prefix=useId();
 const [file,setFile]=useState<File|null>(null),[amounts,setAmounts]=useState<Record<string,string>>({}),[replacement,setReplacement]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[xmlTotal,setXmlTotal]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false);
 async function selectFile(candidate:File){
  setError('');if(candidate.size>5*1024*1024){setError('El XML excede 5 MB.');return;}
  const xml=await candidate.text();if(/<!\s*(DOCTYPE|ENTITY)/i.test(xml)){setError('El XML contiene declaraciones no permitidas.');return;}
  const document=new DOMParser().parseFromString(xml,'application/xml');
  if(document.querySelector('parsererror')||document.documentElement.localName!=='Comprobante'){setError('Selecciona un XML CFDI.');return;}
  // This display is only a preview. The server independently parses and validates everything.
  const total=document.documentElement.getAttribute('Total')??'';setXmlTotal(total);setFile(candidate);setAmounts({[ticket.id]:total});setReplacement('');setReason('');setConfirmed(false);
 }
 async function run(action:()=>Promise<void>){setWorking(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'No se completó la operación.');}finally{setWorking(false);}}
 const blocked=disabled||working;
 return <section className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
  <h3 className="text-sm font-semibold">Archivos y estado de la factura</h3>
  <p className="mt-2 text-xs leading-6 text-[#526e87]">Asocia el XML del comercio y concilia sus importes. El original y las sustituciones se conservan. Consultar el SAT comprueba su estado en ese momento; no cancela ni emite facturas.</p>
  {error?<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{error}</p>:null}
  {allowed?<label className="mt-4 block text-xs font-semibold">XML original o sustituto<input disabled={blocked} type="file" accept=".xml,application/xml,text/xml" className="mt-2 block w-full text-xs" onChange={e=>{const value=e.target.files?.[0];if(value)void run(()=>selectFile(value));e.target.value='';}}/></label>:<p className="mt-3 text-xs text-amber-800">Confirma el perfil y el ticket antes de asociar un XML.</p>}
  {file?<div className="mt-4 space-y-3 rounded-xl border p-3 text-xs">
   <p className="break-all font-semibold">{file.name} · Total XML: ${xmlTotal} MXN</p>
   <label className="block" htmlFor={prefix+'replacement'}>¿Sustituye una factura anterior?</label>
   <select id={prefix+'replacement'} disabled={blocked} value={replacement} onChange={e=>setReplacement(e.target.value)} className="w-full rounded-lg border bg-white p-2"><option value="">No · primera factura</option>{ticket.invoices?.filter(i=>i.lifecycle!=='replaced').map(i=><option value={i.id} key={i.id}>{i.uuid}</option>)}</select>
   <p>Para sustituir, el XML debe relacionar el UUID anterior con tipo 04. La asociación no demuestra que el anterior esté cancelado ante el SAT.</p>
   <fieldset disabled={blocked} className="space-y-2"><legend className="mb-2 font-semibold">Compras incluidas y monto asignado (MXN)</legend>
    {tickets.filter(t=>t.id===ticket.id||t.confirmedAt).map(t=><div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f7f9fc] p-2">
     <label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" checked={t.id in amounts} disabled={t.id===ticket.id} onChange={e=>setAmounts(current=>{const next={...current};if(e.target.checked)next[t.id]=t.total;else delete next[t.id];return next;})}/><span className="truncate">{t.merchant||t.fileName} · {t.trackingNumber||t.ticketNumber||t.folio||t.purchaseDate} · ticket ${t.total}</span></label>
     {t.id in amounts?<Input aria-label={'Monto asignado a '+(t.merchant||t.fileName)+' '+(t.trackingNumber||t.ticketNumber||t.folio||t.purchaseDate)} inputMode="decimal" className="h-9 w-28 bg-white" value={amounts[t.id]} onChange={e=>setAmounts(v=>({...v,[t.id]:e.target.value}))}/>:null}
    </div>)}
   </fieldset>
   <label className="block" htmlFor={prefix+'reason'}>Motivo de la diferencia de importes, si la hay</label><textarea id={prefix+'reason'} disabled={blocked} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} className="min-h-20 w-full rounded-lg border p-2" placeholder="Ejemplo: el XML agrupa dos compras; importes revisados con el comercio."/>
   <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={blocked} onChange={e=>setConfirmed(e.target.checked)}/>Revisé el XML y confirmo los tickets, importes y motivo. Los totales originales del ticket se conservarán.</label>
   <div className="flex flex-wrap gap-2"><Button size="sm" disabled={blocked||!confirmed} onClick={()=>void run(async()=>{await onImport(file,'invoice-xml',{allocations:Object.entries(amounts).map(([ticketId,amount])=>({ticketId,amount})),reason,replacesInvoiceId:replacement||undefined,confirmed});setFile(null);})}>Validar y asociar XML</Button><Button variant="outline" size="sm" disabled={blocked} onClick={()=>setFile(null)}>Descartar selección</Button></div>
  </div>:null}
  {ticket.invoices?.map(invoice=>{
   let latest:{status?:string;message?:string;checkedAt?:string;state?:string;cancellation?:string}|null=null;try{latest=invoice.satResult?JSON.parse(invoice.satResult):null;}catch{ /* Old records have no SAT query. */ }
   return <article key={invoice.id} className="mt-4 rounded-xl border border-[#dce7f0] bg-[#f5fafb] p-3 text-xs leading-6">
    <h4 className="break-all font-semibold">UUID · {invoice.uuid}</h4><p className="font-semibold">{invoiceStatusLabel(invoice)}</p>
    <p>Total XML: ${invoice.total} MXN · Asignado a este ticket: ${invoice.allocatedTotal??invoice.total} · {invoice.groupSize??1} compra(s)</p>
    {invoice.reason?<p>Conciliación: {invoice.reason}</p>:null}<p>{invoice.validation}</p>
    {invoice.satVerifiedAt?<p>Último resultado comprobado: {new Date(invoice.satVerifiedAt).toLocaleString('es-MX')}</p>:null}
    {latest?<p>Consulta: {latest.checkedAt?new Date(latest.checkedAt).toLocaleString('es-MX'):''}. {latest.state?`SAT: ${latest.state}. `:""}{latest.cancellation?`Cancelación: ${latest.cancellation}. `:""}{latest.message}{latest.status==='unknown'?' Se mantiene el estado comprobado anterior.':''}</p>:<p>Aún no se ha consultado al SAT.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={blocked} onClick={()=>onDownload(invoice.fileId)}>XML privado</Button>{invoice.pdfFileId?<Button size="sm" variant="outline" disabled={blocked} onClick={()=>onDownload(invoice.pdfFileId!)}>PDF privado</Button>:null}<Button size="sm" variant="outline" disabled={blocked} onClick={()=>void run(()=>onAction(invoice.id,'verify-sat',invoice.revision??0))}>{working?'Consultando…':'Consultar estado SAT'}</Button></div>
    {invoice.lifecycle==='reported_cancelled'&&invoice.satStatus==='valid'&&invoice.satVerifiedAt&&invoice.cancellationReportedAt&&invoice.satVerifiedAt>invoice.cancellationReportedAt?<Button size="sm" variant="outline" disabled={blocked} className="mt-3" onClick={()=>{if(window.confirm('El SAT confirmó vigencia después del reporte. ¿Corregir el reporte y volver a incluir este XML en los totales?'))void run(()=>onAction(invoice.id,'clear-report',invoice.revision??0));}}>Corregir reporte: SAT confirma vigencia</Button>:null}
    {!invoice.pdfFileId?<label className="mt-3 block font-semibold">Adjuntar PDF a este UUID<input disabled={blocked} type="file" accept=".pdf,application/pdf" className="mt-2 block w-full" onChange={e=>{const f=e.target.files?.[0];if(f)void run(()=>onImport(f,'invoice-pdf',{invoiceId:invoice.id}));e.target.value='';}}/></label>:null}
    {invoice.lifecycle!=='replaced'&&invoice.lifecycle!=='reported_cancelled'&&invoice.satStatus!=='cancelled'?<Button size="sm" variant="ghost" className="mt-2 whitespace-normal text-amber-900" disabled={blocked} onClick={()=>{const reason=window.prompt('Describe la cancelación comunicada por el comercio (al menos 10 caracteres). Esto no cancela ante el SAT.');if(reason&&window.confirm('¿Registrar el reporte y excluir el XML de los totales? Se conservará el original. Consulta después su estado SAT.'))void run(()=>onAction(invoice.id,'report-cancellation',invoice.revision??0,reason));}}>Reportar cancelación del comercio</Button>:null}
   </article>;
  })}
 </section>;
}
