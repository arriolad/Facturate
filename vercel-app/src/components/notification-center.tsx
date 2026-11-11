'use client';
import { useEffect, useState } from 'react';
import { Bell, BellRing, Check, CheckCheck, ChevronRight, CircleHelp, CreditCard, FileCheck2, Info, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/lib/notifications';

type Filter='all'|'unread'|'attention'|'invoice'|'payment';
const icons={invoice:FileCheck2,attention:CircleHelp,profile:UserRound,payment:CreditCard,account:Info};
const colors={invoice:'bg-emerald-50 text-emerald-700',attention:'bg-amber-50 text-amber-700',profile:'bg-sky-50 text-sky-700',payment:'bg-rose-50 text-rose-700',account:'bg-[#e8f5f6] text-[#237f89]'};
async function request(path:string,data?:unknown){
  const response=await fetch(path,{method:data?'POST':'GET',headers:{'X-Facturate-Request':'1',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});
  const value=await response.json();if(!response.ok)throw new Error(value.message||'No pudimos completar la acción.');return value;
}
function dateLabel(value:string){
  const date=new Date(value),today=new Date();
  const day=date.toLocaleDateString('es-MX'),now=today.toLocaleDateString('es-MX');
  if(day===now)return `Hoy, ${date.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;
  return date.toLocaleDateString('es-MX',{day:'numeric',month:'short'})+', '+date.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}
export function DeviceNotifications({publicKey,configured}:{publicKey:string|null;configured:boolean}){
  const [state,setState]=useState<'checking'|'off'|'on'|'blocked'|'unsupported'>('checking');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    let alive=true;
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setState('unsupported');return;}
    if(Notification.permission==='denied'){setState('blocked');return;}
    void navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(async r=>{
      const subscription=await r.pushManager.getSubscription();
      // Registration is tied to the signed-in account, not only the browser permission.
      if(subscription&&configured)await request('/api/push/subscribe',subscription.toJSON());
      if(alive)setState(subscription&&configured?'on':'off');
    }).catch(()=>{if(alive){setState('off');setMessage('No pudimos preparar los avisos. Intenta de nuevo.')}});
    return ()=>{alive=false};
  },[configured]);
  async function enable(){
    setBusy(true);setMessage('');
    try{
      // Ask while the click still has user activation (required on iOS).
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){setState(permission==='denied'?'blocked':'off');setMessage('Tus avisos seguirán disponibles dentro de Anuncios.');return;}
      await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      const registration=await navigator.serviceWorker.ready;
      let subscription=await registration.pushManager.getSubscription();
      const bytes=Uint8Array.from(atob(publicKey!.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      await request('/api/push/subscribe',subscription.toJSON());setState('on');setMessage('Listo. Este dispositivo recibirá tus próximos avisos.');
    }catch(e){setMessage(e instanceof Error?e.message:'No pudimos activar los avisos.');}
    finally{setBusy(false)}
  }
  async function disable(){
    setBusy(true);setMessage('');
    try{const r=await navigator.serviceWorker.ready,s=await r.pushManager.getSubscription();if(s){await request('/api/push/unsubscribe',{endpoint:s.endpoint});await s.unsubscribe();}setState('off');setMessage('Los avisos de este dispositivo están desactivados.');}
    catch(e){setMessage(e instanceof Error?e.message:'No pudimos desactivar los avisos.');}finally{setBusy(false)}
  }
  return <section className="rounded-2xl border border-[#dce7f0] bg-white p-5">
    <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f5f6] text-[#237f89]"><BellRing className="size-5"/></span><div><h2 className="text-sm font-semibold">Avisos en este dispositivo</h2><p className="mt-1 text-xs text-[#718198]">{state==='on'?'Activados':state==='blocked'?'Bloqueados en el navegador':state==='checking'?'Comprobando…':'Tú eliges cuándo activarlos'}</p></div></div>
    <p className="mt-4 text-sm leading-6 text-[#64758a]">Recibe un aviso cuando tu factura esté lista o necesitemos tu ayuda, aunque no estés viendo Factúrate.</p>
    {state==='unsupported'?<p className="mt-3 text-xs leading-5 text-[#718198]">En iPhone: abre Factúrate en Safari, toca Compartir → Agregar a pantalla de inicio y entra desde el ícono. En otros dispositivos, usa un navegador compatible.</p>:state==='blocked'?<p className="mt-3 text-xs leading-5 text-[#718198]">Permite las notificaciones de Factúrate desde los ajustes de este sitio en tu navegador. Después vuelve a cargar la página.</p>:<div className="mt-4 flex flex-wrap gap-2">
      <Button disabled={busy||!configured||state==='checking'} onClick={()=>void(state==='on'?disable():enable())} variant={state==='on'?'outline':'default'} className={state==='on'?'rounded-xl border-[#c9dde1] bg-white text-[#237f89] hover:bg-[#e8f5f6]':'rounded-xl bg-[#237f89] text-white hover:bg-[#1c6b74]'}>{busy?'Un momento…':state==='on'?'Desactivar':'Activar avisos'}</Button>
      {state==='on'?<Button disabled={busy} variant="ghost" className="rounded-xl text-[#237f89]" onClick={()=>{setBusy(true);void request('/api/push/test',{}).then(r=>setMessage(r.message)).catch(e=>setMessage(e.message)).finally(()=>setBusy(false))}}>Enviar prueba</Button>:null}
    </div>}
    {!configured?<p className="mt-3 text-xs text-[#718198]">Estamos preparando esta función. Por ahora, revisa tus avisos aquí.</p>:null}
    {message?<p role="status" className="mt-3 text-xs leading-5 text-[#237f89]">{message}</p>:null}
  </section>;
}
export function NotificationCenter({items,unread,loading,error,onRead,onOpen,legacyFound,onImport,busy,publicKey,pushConfigured,account}:{items:AppNotification[];unread:number;loading:boolean;error:string;onRead:(ids?:string[])=>void;onOpen:(n:AppNotification)=>void;legacyFound:boolean;onImport:()=>void;busy:boolean;publicKey:string|null;pushConfigured:boolean;account:React.ReactNode}){
  const [filter,setFilter]=useState<Filter>('all');
  const filtered=items.filter(n=>filter==='all'||filter==='unread'&&!n.readAt||filter==='attention'&&['attention','profile'].includes(n.kind)||n.kind===filter);
  const tabs:[Filter,string][]=[['all','Todos'],['unread','Sin leer'],['attention','Necesitan tu ayuda'],['invoice','Facturas'],['payment','Pagos']];
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <section className="overflow-hidden rounded-3xl border border-[#dce7f0] bg-white shadow-[0_8px_30px_rgba(11,31,58,.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold tracking-tight">Tus notificaciones</h2><p className="mt-1 text-sm text-[#718198]">{unread?`${unread} aviso${unread===1?' nuevo':'s nuevos'}. Lo importante, en un solo lugar.`:'Todo al día. Aquí verás las novedades de tu cuenta.'}</p></div><Button variant="ghost" disabled={!unread||busy} className="rounded-xl text-xs text-[#237f89]" onClick={()=>onRead()}><CheckCheck className="size-4"/>Marcar todo leído</Button></div>
      <div className="flex gap-1 overflow-x-auto border-y border-[#edf1f5] px-4 py-3" role="group" aria-label="Filtrar notificaciones">{tabs.map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${filter===value?'bg-[#e8f5f6] text-[#237f89]':'text-[#718198] hover:bg-[#f4f7fb]'}`}>{label}</button>)}</div>
      {legacyFound&&(filter==='all'||filter==='attention')?<article className="border-b border-[#edf1f5] bg-amber-50/40 px-5 py-5 sm:px-6"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100/70 text-amber-700"><Upload className="size-5"/></span><div className="min-w-0"><h3 className="text-sm font-semibold">Recupera tus datos anteriores</h3><p className="mt-1 text-sm leading-6 text-[#64758a]">Encontramos perfiles y tickets guardados en este navegador. Agrégalos a tu cuenta para conservarlos.</p><Button disabled={busy} variant="outline" className="mt-3 h-9 rounded-xl text-xs" onClick={onImport}>Agregar a mi cuenta<ChevronRight className="size-3.5"/></Button></div></div></article>:null}
      {error?<p role="alert" className="p-6 text-sm text-amber-800">{error}</p>:loading?<p role="status" className="p-8 text-center text-sm text-[#718198]">Buscando tus avisos…</p>:filtered.length? <ul className="divide-y divide-[#edf1f5]">{filtered.map(n=>{const Icon=icons[n.kind]||Info;return <li key={n.id} className={`px-5 py-5 transition sm:px-6 ${n.readAt?'bg-white':'bg-[#f6fbfc]/70'}`}><div className="flex gap-3 sm:gap-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors[n.kind]||colors.account}`}><Icon className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold leading-5">{n.title}</h3>{!n.readAt?<span aria-label="Sin leer" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#2b9da8]"/>:null}</div><p className="mt-1 text-sm leading-6 text-[#64758a]">{n.body}</p><p className="mt-2 text-[11px] text-[#8794a5]">{dateLabel(n.createdAt)}</p><div className="mt-3 flex flex-wrap items-center gap-4">{n.actionLabel?<button disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-[#237f89] hover:underline disabled:opacity-50" onClick={()=>onOpen(n)}>{n.actionLabel}<ChevronRight className="size-3.5"/></button>:null}{!n.readAt?<button disabled={busy} className="flex items-center gap-1 text-xs text-[#718198] hover:text-[#237f89]" onClick={()=>onRead([n.id])}><Check className="size-3.5"/>Marcar leído</button>:null}</div></div></div></li>})}</ul>:<div className="grid justify-items-center px-6 py-14 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#f0f7f8] text-[#2b9da8]"><Bell className="size-6"/></span><h3 className="font-semibold">{filter==='all'?'Todo tranquilo por aquí':'No tienes avisos en esta categoría'}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-[#718198]">Los nuevos avisos aparecerán aquí cuando haya cambios en tus tickets o tu cuenta.</p></div>}
    </section>
    <aside className="space-y-4"><DeviceNotifications publicKey={publicKey} configured={pushConfigured}/>{account}<div className="flex gap-2 px-2 text-xs leading-5 text-[#718198]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2b9da8]"/>Tus avisos y documentos solo aparecen dentro de tu cuenta.</div></aside>
  </div>;
}
