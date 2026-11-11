"use client";
import { NotificationCenter } from "@/components/notification-center";
import type { AppNotification } from "@/lib/notifications";
import { BackupControls } from "@/components/backup-controls";
import { BrowserConnectionTest } from "@/components/browser-connection-test";
import { PortalConnection, type PortalAccessOptions } from "@/components/portal-connection";
import { InvoiceLookup } from "@/components/invoice-lookup";
import { AutomationDiagnostic } from "@/components/automation-diagnostic";
import { AgentVerification } from "@/components/agent-verification";
import { billingEntryUrl } from "@/lib/billing-portals";
import { InvoiceDocuments, type InvoiceAssociation } from "@/components/invoice-documents";
import { FiscalArchive } from "@/components/fiscal-archive";
import { TaxDeclarations } from "@/components/tax-declarations";
import { FiscalCasePanel } from "@/components/fiscal-case";
import { allowedCfdiUses, catalogValue, regimeEntry, useEntry, TAX_REGIMES, LEGAL_FORMS, personType, currentEntry, SETTLEMENT_METHODS } from "@/lib/fiscal-rules";
import { documentedAmount, invoiceIncluded, invoiceStatusLabel, invoiceNeedsReview } from "@/lib/invoice-state";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MapPin,
  Mail,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  ReceiptText,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canOpenBillingPortal,
  createInitialWorkspace,
  formatPurchaseDateMX,
  normalizePurchaseDate,
  LEGACY_PROFILE_STORAGE_KEY,
  LEGACY_TICKETS_STORAGE_KEY,
  loadLocalWorkspace,
  WORKSPACE_STORAGE_KEY,
  type FiscalProfile,
  type LocalFiscalProfile,
  type Ticket,
  type TicketStatus,
  type ExtractedField,
} from "@/lib/facturate-workspace";

type View = "tickets" | "invoices" | "profile" | "operation" | "announcements" | "archive" | "declarations";


const statusStyle: Partial<Record<TicketStatus, string>> = {
  "Requiere revisión": "border-amber-200 bg-amber-50 text-amber-800",
  "Listo para solicitar": "border-blue-200 bg-blue-50 text-blue-800",
  "Solicitud en proceso": "border-sky-200 bg-sky-50 text-sky-800",
  "CAPTCHA pendiente": "border-amber-200 bg-amber-50 text-amber-800",
  "Esperando respuesta del comercio": "border-sky-200 bg-sky-50 text-sky-800",
  "Factura recibida": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "No facturable": "border-rose-200 bg-rose-50 text-rose-800",
};

const navItems: Array<{
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "tickets", label: "Mis tickets", icon: FileText },
  { id: "invoices", label: "Facturas", icon: ReceiptText },
  { id: "archive", label: "Archivo de facturas", icon: FolderOpen },
  { id: "declarations", label: "Declaraciones", icon: Calculator },
  { id: "profile", label: "Perfil fiscal", icon: UserRound },
  { id: "operation", label: "Resumen", icon: LayoutDashboard },
  { id: "announcements", label: "Anuncios", icon: Bell },
];

const mobileNavItems = navItems;

const viewTitles: Record<View, string> = {
  archive: "Archivo de facturas",
  declarations: "Prepara tus declaraciones",
  tickets: "Tus tickets, en un solo lugar",
  invoices: "Tus facturas y gastos, organizados",
  profile: "Tu perfil fiscal",
  operation: "Así avanza tu facturación",
  announcements: "Anuncios",
};

const sectorColors: Record<string, string> = {
  Alimentación: "#2b9da8",
  Movilidad: "#2878c8",
  Viajes: "#6c68d8",
  "Oficina y servicios": "#e6a23c",
  Salud: "#3ba272",
  "Por clasificar": "#a7b3c2",
};

function formatDate(value: string) {
  const normalizedDate = normalizePurchaseDate(value);
  const date = normalizedDate
    ? new Date(`${normalizedDate}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function inferSector(ticket: Ticket) {
  if (ticket.category && ticket.category !== "Por clasificar") return ticket.category;
  const source = `${ticket.merchant} ${ticket.fileName}`.toLowerCase();
  if (/rest|café|cafe|coffee|taquer|comida|oxxo|seven|7-eleven|supermerc|walmart|costco/.test(source)) {
    return "Alimentación";
  }
  if (/pemex|shell|mobil|gasolin|uber|didi|taxi|estacionamiento|parco|autopista|caseta/.test(source)) {
    return "Movilidad";
  }
  if (/hotel|airbnb|aeromexico|volaris|vivaaerobus|aerolínea|aerolinea/.test(source)) {
    return "Viajes";
  }
  if (/office|staples|amazon|telmex|izzi|totalplay|software|papeler|home depot/.test(source)) {
    return "Oficina y servicios";
  }
  if (/farmacia|hospital|médic|medic|laboratorio|dentista|san pablo|guadalajara/.test(source)) {
    return "Salud";
  }
  return "Por clasificar";
}

function escapeCsv(value: string | number) {
  let safe = String(value).replace(/"/g, '""');
  if (/^[\s\x00-\x1f]*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe}"`;
}


type Capabilities = { visualReady: boolean; storage: boolean; aiConfigured: boolean; browserConfigured: boolean; model: string; automation: "cloud-ready"|"setup-required"; mail: boolean; antivirus: boolean; aiUsedToday: number; aiDailyLimit: number };
const initialCapabilities: Capabilities = {visualReady:false,storage:false,aiConfigured:false,browserConfigured:false,model:"",automation:"setup-required",mail:false,antivirus:false,aiUsedToday:0,aiDailyLimit:10};
async function apiRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Facturate-Request","1");
  if(init.body && !(init.body instanceof FormData)) headers.set("Content-Type","application/json");
  const response = await fetch(path,{...init,headers,cache:"no-store"});
  const value = await response.json();
  if(!response.ok) throw new Error(value.message ?? "No se pudo completar la operación.");
  return value;
}

export default function Home({onSignOut}: {onSignOut?:()=>void} = {}) {
  const [view,setView] = useState<View>("tickets");
  const [workspace,setWorkspace] = useState(createInitialWorkspace);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [csfBusy,setCsfBusy] = useState(false);
  const [csfReviewFields,setCsfReviewFields] = useState<string[]>([]);
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState("");
  const [capabilities,setCapabilities] = useState(initialCapabilities);
  const [consentVersion,setConsentVersion] = useState<string|null>(null);
  const [requiredConsentVersion,setRequiredConsentVersion] = useState("");
  const [accountEmail,setAccountEmail] = useState("");
  const [dirty,setDirty] = useState(false);
  const [legacyFound,setLegacyFound] = useState(false);
  const [notifications,setNotifications] = useState<AppNotification[]>([]);
  const [unread,setUnread] = useState(0);
  const [notificationsLoading,setNotificationsLoading] = useState(true);
  const [notificationsError,setNotificationsError] = useState("");
  const [readingNotifications,setReadingNotifications] = useState(false);
  const [pushConfig,setPushConfig] = useState<{configured:boolean;publicKey:string|null}>({configured:false,publicKey:null});
  async function reloadNotifications(){
    try{const data=await apiRequest('/api/notifications');setNotifications(data.items);setUnread(data.unread);setPushConfig({configured:data.pushConfigured,publicKey:data.publicKey});setNotificationsError('');}
    catch(e){setNotificationsError(e instanceof Error?e.message:'No pudimos cargar tus avisos.');}
    finally{setNotificationsLoading(false)}
  }
  async function markNotificationsRead(ids?:string[]){
    if(readingNotifications)return;
    setReadingNotifications(true);
    try{await apiRequest('/api/notifications/read',{method:'POST',body:JSON.stringify(ids?{ids}:{all:true})});await reloadNotifications();}
    catch(e){setNotice(e instanceof Error?e.message:'No pudimos marcar los avisos.');}
    finally{setReadingNotifications(false)}
  }
  async function openNotification(n:AppNotification){
    if(dirty||busy||csfBusy){setNotice('Guarda o descarta tus cambios antes de abrir el aviso.');return;}
    if(n.kind==='account'){document.getElementById('account-details')?.setAttribute('open','');void markNotificationsRead([n.id]);return;}
    setBusy(true);
    try{
      if(n.profileId&&n.profileId!==workspace.activeProfileId)await apiRequest('/api/profiles/'+n.profileId+'/select',{method:'POST',body:'{}'});
      await reloadWorkspace();await markNotificationsRead([n.id]);
      setSelectedId(n.ticketId??null);setView(n.ticketId?'tickets':'profile');
    }catch(e){setNotice(e instanceof Error?e.message:'No pudimos abrir el aviso.');}finally{setBusy(false)}
  }

  async function reloadWorkspace() {
    const data=await apiRequest("/api/workspace");
    setWorkspace(data.workspace);
    setCapabilities(data.capabilities);
    setConsentVersion(data.consentVersion);
    setRequiredConsentVersion(data.requiredConsentVersion);
    setAccountEmail(data.user.email);
    setDirty(false);
    setLoadError("");
    return data.workspace;
  }
  useEffect(()=>{
    let alive=true;
    const timer=window.setTimeout(()=>{
      void reloadWorkspace().catch(error=>{if(alive)setLoadError(error.message)}).finally(()=>{if(alive)setLoading(false)});
      if(new URLSearchParams(window.location.search).get('view')==='announcements')setView('announcements');
      const hasLegacy=Boolean(localStorage.getItem(WORKSPACE_STORAGE_KEY)||localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)||localStorage.getItem(LEGACY_TICKETS_STORAGE_KEY));
      if(hasLegacy){
        const data=loadLocalWorkspace(localStorage.getItem(WORKSPACE_STORAGE_KEY),localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY),localStorage.getItem(LEGACY_TICKETS_STORAGE_KEY));
        void apiRequest('/api/legacy-import/status',{method:'POST',body:JSON.stringify({workspace:data})}).then(result=>{if(alive)setLegacyFound(!result.imported)}).catch(()=>{if(alive)setLegacyFound(true)});
      }
    },0);
    return ()=>{alive=false;window.clearTimeout(timer)};
  },[]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=""}};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);

  useEffect(()=>{
    if(loading||consentVersion!==requiredConsentVersion)return;
    void reloadNotifications();
    const timer=window.setInterval(()=>{void reloadNotifications()},15000);
    const refresh=()=>{if(document.visibilityState==='visible')void reloadNotifications()};
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
  },[loading,consentVersion,requiredConsentVersion]);
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),10000);return()=>window.clearTimeout(timer)},[notice]);

  const activeProfile=workspace.profiles.find(p=>p.id===workspace.activeProfileId)??workspace.profiles[0];
  const profile=activeProfile.fiscal;
  const tickets=activeProfile.tickets;
  const ticketCfdiUse=activeProfile.ticketCfdiUse;
  const ticketPaymentMethod=activeProfile.ticketPaymentMethod??"";
  const selected=tickets.find(t=>t.id===selectedId)??null;
  const selectedAutomationId=selected?.automation?.id;
  const selectedAutomationState=selected?.automation?.state;
  const selectedAutomationActive=workspace.profiles.some(p=>p.tickets.some(t=>t.automation&&["queued","running","needs_captcha","needs_human","dispatch_unknown"].includes(t.automation.state)));
  const profileComplete=Boolean(activeProfile.confirmedAt && profile.rfc && profile.legalName && profile.taxRegime && profile.postalCode && profile.email);
  const counts={
    review:tickets.filter(t=>["Recibido","Requiere revisión","Requiere información","CAPTCHA pendiente","Portal bloqueado","Error temporal","Error permanente"].includes(t.status)||invoiceNeedsReview(t)).length,
    process:tickets.filter(t=>["Analizando documentos","Listo para solicitar","Solicitud en proceso","Solicitud enviada","Esperando respuesta del comercio"].includes(t.status)).length,
    done:tickets.filter(t=>t.status==="Factura recibida" && Boolean(t.invoices?.some(invoiceIncluded))).length,
  };
  useEffect(()=>{
    if(!selectedAutomationActive||dirty||busy||csfBusy)return;
    const timer=window.setInterval(()=>{void reloadWorkspace().catch(()=>{})},5000);
    return ()=>window.clearInterval(timer);
  },[selectedAutomationActive,selectedAutomationId,dirty,busy,csfBusy]);
  const updateProfileRecord=(profileId:string,updater:(current:LocalFiscalProfile)=>LocalFiscalProfile)=>{
    setWorkspace(current=>({...current,profiles:current.profiles.map(p=>p.id===profileId?updater(p):p)}));
  };
  function setProfile(next:React.SetStateAction<FiscalProfile>) {
    setDirty(true);
    updateProfileRecord(activeProfile.id,current=>({...current,fiscal:typeof next==="function"?next(current.fiscal):next,confirmedAt:null}));
  }
  function setTicketCfdiUse(value:string) {
    updateProfileRecord(activeProfile.id,current=>({...current,ticketCfdiUse:value}));
  }
  function setTicketPaymentMethod(value:string) {
    updateProfileRecord(activeProfile.id,current=>({...current,ticketPaymentMethod:value}));
  }
  function updateTicket(ticketId:string,patch:Partial<Ticket>) {
    setDirty(true);
    updateProfileRecord(activeProfile.id,current=>({...current,tickets:current.tickets.map(t=>t.id===ticketId?{...t,...patch}:t)}));
  }
  async function task(work:()=>Promise<string|void>) {
    if(busy||csfBusy)return;
    setBusy(true);
    try{const message=await work();await reloadWorkspace();await reloadNotifications();if(message)setNotice(message)}
    catch(error){setNotice(error instanceof Error?error.message:"No se pudo completar la operación.")}
    finally{setBusy(false)}
  }
  function discardConfirmed() {return !dirty||window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y continuar?");}
  function navigate(next:View) {
    if(busy||csfBusy)return;
    if(dirty){setNotice("Guarda tus cambios o descártalos antes de cambiar de sección.");return;}
    setSelectedId(null);setView(next);
  }
  function selectTicket(ticketId:string) {
    if(busy||csfBusy)return;
    if(dirty){setNotice("Guarda tus cambios o descártalos antes de abrir otro ticket.");return;}
    setSelectedId(ticketId);setNotice("");
  }
  function discardDraft() {
    if(!window.confirm("¿Descartar los cambios sin guardar y recuperar la última versión guardada?"))return;
    void task(async()=>"Se recuperó la última versión guardada.");
  }
  function switchProfile(profileId:string) {
    if(!discardConfirmed())return;
    void task(async()=>{await apiRequest("/api/profiles/"+profileId+"/select",{method:"POST",body:"{}"});setSelectedId(null);setCsfReviewFields([]);return "Perfil cambiado. Solo se muestran datos de tu cuenta."});
  }
  function addProfile(displayName:string) {
    if(!discardConfirmed())return;
    void task(async()=>{await apiRequest("/api/profiles",{method:"POST",body:JSON.stringify({displayName})});setSelectedId(null);setView("profile");return "Perfil creado en tu cuenta. Completa y confirma sus datos."});
  }
  function renameProfile(profileId:string,displayName:string) {
    if(dirty){setNotice("Guarda o descarta tus cambios antes de renombrar el perfil.");return;}
    void task(async()=>{const current=workspace.profiles.find(p=>p.id===profileId)!;await apiRequest("/api/profiles/"+profileId,{method:"POST",body:JSON.stringify({...current,displayName,confirm:false})});return "Nombre guardado. Reconfirma el perfil antes de solicitar."});
  }
  function deleteProfile(profileId:string) {
    void task(async()=>{await apiRequest("/api/profiles/"+profileId,{method:"DELETE"});setSelectedId(null);return "Perfil, tickets y archivos eliminados del almacenamiento activo. Los respaldos tienen una retención independiente."});
  }
  function saveProfile() {
    void task(async()=>{await apiRequest("/api/profiles/"+activeProfile.id,{method:"POST",body:JSON.stringify({...activeProfile,confirm:true})});setCsfReviewFields([]);return "Perfil confirmado y guardado en tu cuenta."});
  }
  function saveTicket() {
    if(!selected)return;
    void task(async()=>{await apiRequest("/api/tickets/"+selected.id,{method:"POST",body:JSON.stringify({revision:selected.revision,fields:selected})});return "Cambios guardados. Revisa y confirma los datos finales."});
  }
  function ticketAction(action:string,reference?:string,portalAccess?:PortalAccessOptions) {
    if(!selected)return;
    if(dirty){setNotice("Guarda primero los cambios del perfil o del ticket.");return;}
    void task(async()=>{
      try{const result=await apiRequest("/api/tickets/"+selected.id+"/action",{method:"POST",body:JSON.stringify({revision:selected.revision,action,reference,portalAccess,confirmed:true})});return result.message;}
      catch(error){await reloadWorkspace().catch(()=>{});throw error;}
    });
  }
  async function uploadFile(file:File,kind:string,profileId:string,ticketId?:string,association?:InvoiceAssociation) {
    const form=new FormData();
    form.append("file",file);form.append("kind",kind);form.append("profileId",profileId);
    form.append("cfdiUse",ticketCfdiUse);form.append("paymentMethod",ticketPaymentMethod);if(ticketId)form.append("ticketId",ticketId);
    if(association)form.append("association",JSON.stringify(association));
    return apiRequest("/api/files",{method:"POST",body:form});
  }
  async function addFiles(files:File[]) {
    if(busy||csfBusy)return;
    if(!discardConfirmed())return;
    const profileId=activeProfile.id;setBusy(true);
    try{
      for(const file of files.slice(0,5)){
        const uploaded=await uploadFile(file,"ticket",profileId);
        setSelectedId(uploaded.ticketId??null);
        setNotice(uploaded.message);
        await reloadWorkspace();
        if(!uploaded.duplicate && capabilities.aiConfigured) {
          const result=await apiRequest("/api/analyze",{method:"POST",body:JSON.stringify({fileId:uploaded.fileId})});
          setNotice(result.message);await reloadWorkspace();
        } else if(!capabilities.aiConfigured) setNotice("Ticket guardado de forma privada. La IA todavía no está configurada: completa los campos manualmente o vuelve a analizar cuando se conecte.");
      }
      if(files.length>5)setNotice("Se procesaron los primeros cinco archivos. Sube el resto en otro lote.");
    }catch(error){setNotice(error instanceof Error?error.message:"Error al cargar el ticket.");await reloadWorkspace().catch(()=>{})}
    finally{setBusy(false)}
  }
  async function analyzeCsf(file:File) {
    if(busy||csfBusy||!discardConfirmed())return;
    const profileId=activeProfile.id;setCsfBusy(true);setCsfReviewFields([]);
    try{
      const uploaded=await uploadFile(file,"csf",profileId);
      await reloadWorkspace();
      const result=await apiRequest("/api/analyze-csf",{method:"POST",body:JSON.stringify({fileId:uploaded.fileId})});
      const fields=result.fields as ExtractedField[];
      if(!result.readable){setNotice(result.message);return;}
      const proposal=Object.fromEntries(fields.filter(f=>f.value!==null).map(f=>[f.field,f.value]));
      updateProfileRecord(profileId,current=>({...current,fiscal:{...current.fiscal,...proposal,csfFileName:file.name},confirmedAt:null,extraction:fields}));
      setCsfReviewFields(fields.filter(f=>f.requiresReview).map(f=>f.field));setDirty(true);setNotice("Propuesta de IA lista. Revisa los datos y sus fuentes antes de pulsar Guardar y confirmar perfil.");
    }catch(error){setNotice(error instanceof Error?error.message:"No se pudo analizar la constancia.")}
    finally{setCsfBusy(false)}
  }
  function reanalyzeTicket(){
    if(!selected?.fileId)return;
    void task(async()=>{const result=await apiRequest("/api/analyze",{method:"POST",body:JSON.stringify({fileId:selected.fileId})});return result.message});
  }
  function removeTicket(ticketId:string){
    if(!window.confirm("¿Eliminar este ticket y su foto original? Las facturas de tu archivo se conservarán. Esta acción no se puede deshacer."))return;
    void task(async()=>{await apiRequest("/api/tickets/"+ticketId,{method:"DELETE"});setSelectedId(null);return "Ticket y archivos eliminados del almacenamiento activo."});
  }
  async function downloadFile(fileId:string){
    try{const result=await apiRequest("/api/files/"+fileId+"/link",{method:"POST",body:"{}"});const a=document.createElement("a");a.href=result.url;a.rel="noreferrer";a.click();}
    catch(error){setNotice(error instanceof Error?error.message:"No fue posible descargar el archivo.")}
  }
  async function importInvoice(file:File,kind:string,association?:InvoiceAssociation) {
    if(!selected||dirty)throw new Error("Guarda o descarta los cambios antes de asociar una factura.");
    setBusy(true);try{const result=await uploadFile(file,kind,activeProfile.id,selected.id,association);await reloadWorkspace();setNotice(result.message);}finally{setBusy(false);}
  }
  async function updateInvoice(invoiceId:string,action:string,revision:number,reason?:string){
    if(dirty)throw new Error("Guarda o descarta los cambios antes de actualizar la factura.");
    setBusy(true);try{const result=await apiRequest("/api/invoices/"+invoiceId+"/action",{method:"POST",body:JSON.stringify({action,revision,reason,confirmed:true})});await reloadWorkspace();setNotice(result.message);}finally{setBusy(false);}
  }
  function importLegacy(){
    if(dirty){setNotice("Guarda o descarta tus cambios antes de importar los registros anteriores.");return;}
    void task(async()=>{
      const data=loadLocalWorkspace(localStorage.getItem(WORKSPACE_STORAGE_KEY),localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY),localStorage.getItem(LEGACY_TICKETS_STORAGE_KEY));
      await apiRequest("/api/legacy-import",{method:"POST",body:JSON.stringify({workspace:data})});
      setLegacyFound(false);
      return "Listo. Tus datos anteriores ya están en tu cuenta. La copia de este navegador sigue guardada como respaldo.";
    });
  }

  if(loading||loadError) return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6 text-[#10233f]">
      <section className="max-w-lg rounded-3xl border border-[#dce7f0] bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Factúrate</h1>
        <p className="mt-4 text-sm leading-6">{loading?"Conectando con tu espacio privado…":loadError}</p>
        {!loading?<div className="mt-5 flex flex-wrap gap-3"><a href="/signin-with-chatgpt?return_to=%2F" target="_top" className="rounded-xl bg-[#2b9da8] px-4 py-3 font-semibold text-white">Iniciar sesión con ChatGPT</a><Button variant="outline" onClick={()=>window.location.reload()}>Reintentar conexión</Button></div>:null}
      </section>
    </main>
  );
  if(consentVersion!==requiredConsentVersion) return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-5 text-[#10233f]">
      <section className="max-w-2xl rounded-3xl border border-[#dce7f0] bg-white p-6 shadow-xl sm:p-9">
        <ShieldCheck className="size-9 text-[#2b9da8]"/><h1 className="mt-4 text-2xl font-semibold">Tu espacio privado en Factúrate</h1>
        <p className="mt-3 text-sm leading-6">Prueba personal. Perfiles y documentos se guardan en una base de datos y almacenamiento privados de Sites (Cloudflare), asociados a tu sesión de ChatGPT. No se publican tus archivos ni se comparten con otros perfiles de cuenta.</p>
        <p className="mt-3 text-sm leading-6">Si activas el análisis, el documento se enviará a OpenAI API para extraer los datos, con almacenamiento de respuestas desactivado. El proveedor puede conservar registros de seguridad según sus condiciones; esto no equivale a retención cero.</p>
        <p className="mt-3 text-sm leading-6">Solo carga documentos propios y confiables. Hay controles de tipo, tamaño y contenido activo, pero todavía no un antivirus completo. Esta versión no envía solicitudes automáticas, no resuelve CAPTCHA ni consulta tu correo.</p>
        <p className="mt-3 text-sm leading-6">Puedes eliminar perfiles y documentos desde la aplicación. Las copias de respaldo tienen retención independiente pendiente de verificar. El aviso legal definitivo, el contacto ARCO y la política de retención deben completarse antes de invitar a otras personas.</p>
        <a className="mt-4 inline-block text-sm text-[#237f89] underline" href="/privacidad" target="_blank" rel="noreferrer">Leer condiciones y pendientes de privacidad</a>
        <Button disabled={busy} className="mt-6 h-auto w-full whitespace-normal rounded-xl bg-[#2b9da8] p-4" onClick={()=>void task(async()=>{await apiRequest("/api/consent",{method:"POST",body:JSON.stringify({version:requiredConsentVersion})});return "Espacio personal activado. Empieza con documentos de prueba."})}>Acepto para mis pruebas personales</Button>
        {notice?<p role="alert" className="mt-3 text-sm text-amber-800">{notice}</p>:null}
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#10233f]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[250px] shrink-0 border-r border-[#1b3b62] bg-[#0b1f3a] px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#2b9da8] text-white shadow-[0_10px_30px_rgba(43,157,168,.32)]">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-xl font-medium tracking-[-0.035em]">Factúrate</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Centro de facturación
              </p>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="Navegación principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-white/12 text-white shadow-sm"
                      : "text-white/55 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-[#79d5dc]" : ""}`} />
                  {item.label}
                  {item.id === "announcements" && unread+Number(legacyFound)>0?<span className="ml-auto rounded-full bg-[#2b9da8] px-2 py-0.5 text-[10px] text-white">{unread+Number(legacyFound)>99?'99+':unread+Number(legacyFound)}</span>:null}
                  {item.id === "tickets" && counts.review > 0 ? (
                    <span className="ml-auto rounded-full bg-[#2b9da8] px-2 py-0.5 text-[10px] text-white">
                      {counts.review}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.06] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold">
              <UsersRound className="size-4 text-[#79d5dc]" />
              Perfil activo
            </div>
            <p className="truncate text-sm font-semibold text-white/90">
              {activeProfile.displayName}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/48">
              {workspace.profiles.length} perfil{workspace.profiles.length === 1 ? "" : "es"} de demostración.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-7 sm:pt-7 lg:pb-10 lg:px-10">
          <header className="mb-7 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2b9da8]">
                Facturación asistida
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                {viewTitles[view]}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={()=>navigate('announcements')} aria-label={`Anuncios, ${unread+Number(legacyFound)} avisos sin leer`} className={`relative grid size-11 place-items-center rounded-2xl border shadow-sm transition ${view==='announcements'?'border-[#b8dde1] bg-[#e8f5f6] text-[#237f89]':'border-[#d8e4ef] bg-white text-[#496479] hover:bg-[#e8f5f6]'}`}><Bell className="size-5"/>{unread+Number(legacyFound)>0?<span className="absolute -right-1 -top-1 min-w-4 rounded-full border-2 border-[#f4f7fb] bg-[#2b9da8] px-1 text-center text-[9px] font-bold leading-4 text-white">{unread+Number(legacyFound)>99?'99+':unread+Number(legacyFound)}</span>:null}</button>
            <ProfileSwitcher
              profiles={workspace.profiles}
              activeProfileId={workspace.activeProfileId}
              disabled={busy || csfBusy}
              onSwitch={switchProfile}
              onCreate={addProfile}
              onRename={renameProfile}
              onDelete={deleteProfile}
            />
            </div>
          </header>

          {dirty?<div className="mb-4 flex flex-wrap items-center gap-3"><p role="status" className="text-sm font-semibold text-amber-800">Hay cambios sin guardar. Confírmalos antes de continuar.</p><Button disabled={busy||csfBusy} variant="ghost" size="sm" onClick={discardDraft}>Descartar cambios</Button></div>:null}
          {notice ? (
            <div className="fixed bottom-24 left-4 right-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[#b8dde1] bg-white px-4 py-3 text-sm text-[#17636b] shadow-lg lg:bottom-6">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <p role="status" className="flex-1 leading-6">{notice}</p>
              <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {view === 'announcements'?<NotificationCenter items={notifications} unread={unread} loading={notificationsLoading} error={notificationsError} onRead={ids=>void markNotificationsRead(ids)} onOpen={n=>void openNotification(n)} legacyFound={legacyFound} onImport={importLegacy} busy={busy||csfBusy||dirty||readingNotifications} publicKey={pushConfig.publicKey} pushConfigured={pushConfig.configured} account={<details id="account-details" className="group rounded-2xl border border-[#dce7f0] bg-white p-5"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Tu cuenta<ChevronDown className="size-4 text-[#718198] transition group-open:rotate-180"/></summary><div className="mt-4 space-y-4 text-xs leading-5 text-[#64758a]"><p className="break-all">{accountEmail}</p><p>{capabilities.aiUsedToday} de {capabilities.aiDailyLimit} lecturas usadas hoy. El límite es de esta versión de prueba; incluye tickets y constancias.</p><p>{capabilities.automation==='cloud-ready'&&capabilities.visualReady?'Puedes solicitar tus facturas con el ticket disponible durante el llenado.':capabilities.automation==='cloud-ready'?'Verifica la lectura visual del ticket antes de iniciar nuevas solicitudes.':capabilities.browserConfigured?'El navegador está configurado. Completa la verificación del agente para habilitar las solicitudes automáticas.':'La solicitud automática necesita configurar el navegador y el flujo del comercio. Por ahora puedes guardar y revisar tus tickets.'}</p><AgentVerification disabled={busy||csfBusy||dirty} ready={capabilities.automation==="cloud-ready"} onVerified={()=>{void apiRequest("/api/workspace").then(data=>setCapabilities(data.capabilities)).catch(()=>setNotice("Recarga la página para actualizar la disponibilidad de la automatización."));}}/>{capabilities.automation==="cloud-ready"?<AgentVerification portal disabled={busy||csfBusy||dirty} ready={false}/>:null}<AgentVerification visual disabled={busy||csfBusy||dirty} ready={capabilities.visualReady} onVerified={()=>{void apiRequest("/api/workspace").then(data=>setCapabilities(data.capabilities)).catch(()=>{});}}/><BrowserConnectionTest disabled={busy||csfBusy||dirty}/><BackupControls disabled={busy||csfBusy||dirty}/><button type="button" onClick={onSignOut} className="block text-[#237f89] underline">Cerrar sesión</button></div></details>}/>:null}

          {view === "tickets" ? (
            <TicketsView
              profile={profile}
              tickets={tickets}
              counts={counts}
              busy={busy}
              selectedId={selectedId}
              profileComplete={profileComplete}
              cfdiUse={ticketCfdiUse}
              paymentMethod={ticketPaymentMethod}
              onPaymentMethodChange={setTicketPaymentMethod}
              onFiles={addFiles}
              onSelect={selectTicket}
              onCfdiUseChange={setTicketCfdiUse}
            />
          ) : null}

          {view === "profile" ? (
            <ProfileView
              profileName={activeProfile.displayName}
              profile={profile}
              setProfile={setProfile}
              csfBusy={csfBusy}
              reviewFields={csfReviewFields}
              onCsfFile={analyzeCsf}
              onSave={saveProfile}
              saving={busy}
              extraction={activeProfile.extraction ?? []}
              csfFileId={activeProfile.csfFileId}
              onDownload={downloadFile}
            />
          ) : null}

          {view === "invoices" ? (
            <InvoicesView
              profile={profile}
              tickets={tickets}
              profileComplete={profileComplete}
              onSelect={selectTicket}
            />
          ) : null}

          {view === "archive" ? <FiscalArchive key={activeProfile.id} profileId={activeProfile.id} profileName={activeProfile.displayName} onDownload={downloadFile}/> : null}
          {view === "declarations" ? <TaxDeclarations key={activeProfile.id} profileId={activeProfile.id} profile={profile} confirmed={profileComplete} onArchive={()=>navigate("archive")}/> : null}

          {view === "operation" ? (
            <OperationView tickets={tickets} counts={counts} />
          ) : null}
        </section>
      </div>

      {selected ? (
        <TicketPanel key={selected.id}
          ticket={selected}
          tickets={tickets}
          onInvoiceAction={updateInvoice}
          profileComplete={profileComplete}
          onClose={() => { if(dirty){setNotice("Guarda o descarta los cambios antes de cerrar el panel.");return;}setSelectedId(null); }}
          onChange={(patch) => updateTicket(selected.id, patch)}
          onRemove={() => removeTicket(selected.id)}
          onSave={saveTicket}
          onAction={ticketAction}
          onAnalyze={reanalyzeTicket}
          onDownload={downloadFile}
          onRefresh={()=>void reloadWorkspace()}
          onInvoice={importInvoice}
          profile={profile}
          automationReady={capabilities.automation==="cloud-ready"&&capabilities.visualReady}
          browserConfigured={capabilities.browserConfigured}
          disabled={busy || csfBusy}
          dirty={dirty}
          notice={notice}
          onDiscard={discardDraft}
        />
      ) : null}

      <nav className="fixed inset-x-3 bottom-3 z-30 flex overflow-x-auto rounded-2xl border border-[#dce7f5] bg-white/95 p-2 shadow-2xl shadow-[#0b1f3a]/12 backdrop-blur lg:hidden">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isPrimary = false;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`relative flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold ${
                view === item.id ? "text-[#2b9da8]" : "text-[#718198]"
              }`}
            >
              <span
                className={`grid place-items-center rounded-xl transition ${
                  isPrimary
                    ? "-mt-7 size-12 bg-[#2b9da8] text-white shadow-[0_10px_24px_rgba(43,157,168,.32)]"
                    : "size-7"
                }`}
              >
                <Icon className={isPrimary ? "size-5" : "size-4"} />
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function profileInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "P";
}

function ProfileSwitcher({
  profiles,
  activeProfileId,
  disabled,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: {
  profiles: LocalFiscalProfile[];
  activeProfileId: string;
  disabled: boolean;
  onSwitch: (profileId: string) => void;
  onCreate: (displayName: string) => void;
  onRename: (profileId: string, displayName: string) => void;
  onDelete: (profileId: string) => void;
}) {
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const [editorMode, setEditorMode] = useState<"create" | "rename" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  function openEditor(mode: "create" | "rename") {
    setEditorMode(mode);
    setDraftName(mode === "rename" ? activeProfile.displayName : "");
    setNameError("");
  }

  function closeEditor() {
    setEditorMode(null);
    setDraftName("");
    setNameError("");
  }

  function saveName() {
    const name = draftName.trim();
    if (!name) {
      setNameError("Escribe un nombre para identificar este perfil.");
      return;
    }

    const duplicate = profiles.some(
      (profile) =>
        profile.displayName.toLocaleLowerCase("es-MX") ===
          name.toLocaleLowerCase("es-MX") &&
        (editorMode === "create" || profile.id !== activeProfileId),
    );
    if (duplicate) {
      setNameError("Ya existe un perfil con ese nombre.");
      return;
    }

    if (editorMode === "create") onCreate(name);
    if (editorMode === "rename") onRename(activeProfileId, name);
    closeEditor();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`Cambiar perfil. Perfil activo: ${activeProfile.displayName}`}
            className="h-11 shrink-0 rounded-2xl border-[#d8e4ef] bg-white px-2.5 text-[#173c55] shadow-[0_8px_24px_rgba(15,54,101,.08)] hover:bg-[#f7fafc] sm:px-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#e8f5f6] text-xs font-bold text-[#237f89]">
              {profileInitials(activeProfile.displayName)}
            </span>
            <span className="min-w-0 text-left">
              <span className="block max-w-[76px] truncate text-xs font-semibold sm:max-w-[130px]">
                {activeProfile.displayName}
              </span>
              <span className="hidden text-[10px] font-medium text-[#7b8a9b] sm:block">
                Cambiar perfil
              </span>
            </span>
            <ChevronDown className="size-3.5 text-[#718198]" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-[300px] rounded-2xl border-[#dce6ef] bg-white p-2 shadow-[0_20px_70px_rgba(11,31,58,.18)]"
        >
          <DropdownMenuLabel className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#718198]">
            Perfiles fiscales
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={activeProfileId} onValueChange={onSwitch}>
            {profiles.map((profileItem) => (
              <DropdownMenuRadioItem
                key={profileItem.id}
                value={profileItem.id}
                disabled={disabled}
                className="rounded-xl py-2.5 pr-3 pl-8 focus:bg-[#eef8f8]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#edf4fb] text-[11px] font-bold text-[#2878c8]">
                  {profileInitials(profileItem.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#173c55]">
                    {profileItem.displayName}
                  </span>
                  <span className="block truncate text-[11px] text-[#7a899a]">
                    {profileItem.fiscal.legalName ||
                      `${profileItem.tickets.length} ticket${profileItem.tickets.length === 1 ? "" : "s"}`}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator className="my-2 bg-[#e7edf3]" />
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => openEditor("create")}
            className="rounded-xl px-3 py-2.5 text-[#173c55] focus:bg-[#eef8f8]"
          >
            <Plus className="size-4 text-[#2b9da8]" /> Nuevo perfil
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => openEditor("rename")}
            className="rounded-xl px-3 py-2.5 text-[#173c55] focus:bg-[#eef8f8]"
          >
            <Pencil className="size-4 text-[#2878c8]" /> Renombrar perfil
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled || profiles.length === 1}
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
            className="rounded-xl px-3 py-2.5"
          >
            <Trash2 className="size-4" /> Eliminar perfil
          </DropdownMenuItem>

          <p className="mx-1 mt-2 rounded-xl bg-[#f3f6f9] px-3 py-2 text-[10px] leading-4 text-[#718198]">
            Cada perfil tiene sus propios datos fiscales, tickets y facturas dentro de tu cuenta.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editorMode !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="rounded-[24px] border-[#dce6ef] p-6 sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#e8f5f6] text-[#2b9da8]">
              {editorMode === "create" ? (
                <UsersRound className="size-5" />
              ) : (
                <Pencil className="size-5" />
              )}
            </div>
            <DialogTitle className="text-xl text-[#10233f]">
              {editorMode === "create" ? "Crear otro perfil" : "Renombrar perfil"}
            </DialogTitle>
            <DialogDescription className="leading-6 text-[#718198]">
              {editorMode === "create"
                ? "Tendrá sus propios datos fiscales, tickets y facturas guardados dentro de tu cuenta."
                : "Este nombre solo sirve para reconocer el perfil dentro de Factúrate."}
            </DialogDescription>
          </DialogHeader>

          <label className="mt-2 space-y-2 text-sm font-semibold text-[#173c55]">
            <span>Nombre del perfil</span>
            <Input
              autoFocus
              maxLength={40}
              value={draftName}
              placeholder="Ej. Diego, Oficina o Empresa"
              onChange={(event) => {
                setDraftName(event.target.value);
                setNameError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveName();
                }
              }}
              className="h-12 rounded-xl border-[#d9e5ef] bg-[#f7f9fc]"
            />
            {nameError ? (
              <span className="block text-xs font-medium text-rose-600">{nameError}</span>
            ) : null}
          </label>

          <DialogFooter className="mt-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={closeEditor} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveName}
              className="rounded-xl bg-[#2b9da8] hover:bg-[#23858e]"
            >
              <Check className="size-4" />
              {editorMode === "create" ? "Crear perfil" : "Guardar nombre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-[24px] border-[#eadde0] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {activeProfile.displayName}?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              Se eliminarán de tu cuenta sus datos fiscales, tickets, archivo de facturas, borradores de declaraciones y archivos del almacenamiento activo. No se puede deshacer. Los respaldos tienen retención independiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDelete(activeProfileId)}
              className="rounded-xl"
            >
              Eliminar perfil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TicketsView({
  profile,
  tickets,
  counts,
  busy,
  selectedId,
  profileComplete,
  cfdiUse,
  paymentMethod,
  onPaymentMethodChange,
  onFiles,
  onSelect,
  onCfdiUseChange,
}: {
  profile: FiscalProfile;
  tickets: Ticket[];
  counts: { review: number; process: number; done: number };
  busy: boolean;
  selectedId: string | null;
  profileComplete: boolean;
  cfdiUse: string;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  onFiles: (files: File[]) => void;
  onSelect: (id: string) => void;
  onCfdiUseChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query,setQuery] = useState("");
  const visibleTickets = tickets.filter(t=>(t.merchant+" "+t.ticketNumber+" "+t.folio).toLocaleLowerCase("es-MX").includes(query.toLocaleLowerCase("es-MX")));

  return (
    <div className="space-y-6">
      <section
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(Array.from(event.dataTransfer.files));
        }}
        className="group relative overflow-hidden rounded-[30px] border border-[#dce7f0] bg-white shadow-[0_18px_60px_rgba(15,54,101,.10)]"
      >
        <div className="relative min-h-[330px] overflow-hidden bg-[linear-gradient(145deg,#0b1f3a_0%,#123d66_100%)] px-6 pb-14 pt-7 text-white sm:min-h-[290px] sm:px-8">
          <div className="absolute -right-20 -top-24 size-64 rounded-full bg-[#2b9da8]/25 blur-3xl" />
          <div className="relative mx-auto max-w-xl text-center">
            <div className="mx-auto flex w-fit items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-[#2b9da8] shadow-[0_8px_24px_rgba(43,157,168,.28)]">
                <FileCheck2 className="size-4" />
              </div>
              <p className="text-xl font-medium tracking-[-0.035em]">Factúrate</p>
            </div>
            <h2 className="mt-6 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
              Escanea o sube tu ticket
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/62">
              Coloca el ticket completo y con buena luz. También puedes seleccionar una foto o PDF.
            </p>
          </div>

          <div className="relative mx-auto mt-7 h-32 max-w-md sm:h-28">
            <span className="absolute left-0 top-0 size-12 rounded-tl-[28px] border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 size-12 rounded-tr-[28px] border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 size-12 rounded-bl-[28px] border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 size-12 rounded-br-[28px] border-b-4 border-r-4 border-white" />
            <div className="absolute inset-0 grid place-items-center">
              <Camera className="size-7 text-white/35" />
            </div>
          </div>
        </div>

        <div className="relative -mt-8 rounded-t-[30px] bg-white px-5 pb-5 pt-8 sm:px-7 sm:pb-7">
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#f3f6f9] px-4 py-3.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#2b9da8] shadow-sm">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Ticket de compra</p>
              <p className="mt-0.5 text-xs text-[#718198]">Imagen o PDF · revisaremos los datos contigo</p>
            </div>
            <ChevronRight className="size-4 text-[#7d8b9d]" />
          </div>

          <div className="mb-5 rounded-2xl border border-[#d9e5ef] bg-white p-4 shadow-[0_8px_26px_rgba(15,54,101,.06)]">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f5f6] text-[#2b9da8]">
                <ReceiptText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Uso del CFDI para esta factura</p>
                <p className="mt-1 text-xs leading-5 text-[#718198]">
                  Se aplicará a los tickets que subas a continuación.
                </p>
              </div>
            </div>

            <Select value={cfdiUse} onValueChange={onCfdiUseChange}>
              <SelectTrigger className="mt-4 h-12 w-full rounded-xl border-[#d9e5ef] bg-[#f7f9fc] px-4 text-left shadow-none">
                <SelectValue placeholder="Selecciona el Uso CFDI" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="max-h-72 max-w-[calc(100vw-2rem)] rounded-xl"
              >
                {allowedCfdiUses(profile).map(catalogValue).map((use) => (
                  <SelectItem key={use} value={use} className="py-2.5">
                    {use}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="mt-5 block text-sm font-semibold" htmlFor="upload-payment-method">Forma de pago</label>
            <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
              <SelectTrigger id="upload-payment-method" className="mt-2 h-12 w-full rounded-xl bg-[#f7f9fc]"><SelectValue placeholder="Leer del ticket y revisar después" /></SelectTrigger>
              <SelectContent className="max-h-72">{PAYMENT_METHODS.map(method=><SelectItem key={method.code} value={method.code}>{method.value}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-2 text-xs leading-5 text-[#718198]">Es el instrumento con el que pagaste. Si no lo eliges, intentaremos leerlo del ticket; podrás confirmarlo o corregirlo antes de solicitar.</p>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-[#6d7f93]">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2b9da8]" />
              Confirma la opción según tu régimen y el tipo de gasto antes de enviar.
            </p>
          </div>

          {!profileComplete ? (
            <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="size-3.5" /> Completa tu perfil fiscal antes de solicitar la factura.
            </p>
          ) : null}

          <Input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void onFiles(Array.from(event.target.files));
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-14 w-full rounded-2xl bg-[#2b9da8] px-5 text-base font-semibold shadow-[0_8px_20px_rgba(43,157,168,.25)] hover:bg-[#23858e]"
          >
            {busy ? <RefreshCw className="animate-spin" /> : <Upload />}
            {busy ? "Analizando…" : "Subir ticket"}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Por validar" value={counts.review} tone="blue" />
        <Metric label="En seguimiento" value={counts.process} tone="sky" />
        <Metric label="CFDI completados" value={counts.done} tone="green" />
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#dfe7f1] bg-white shadow-[0_18px_60px_rgba(15,54,101,.06)]">
        <div className="flex flex-col gap-4 border-b border-[#e4ebf4] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold tracking-[-0.02em]">Mis solicitudes</h2>
            <p className="mt-1 text-xs text-black/42">Historial de demostración · datos ficticios</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
            <Input className="h-10 rounded-xl bg-[#f4f7fb] pl-9" placeholder="Buscar proveedor…" aria-label="Buscar tickets" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
        </div>

        {tickets.length ? (
          <div className="divide-y divide-black/6">
            {visibleTickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelect(ticket.id)}
                className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#faf9f6] ${
                  selectedId === ticket.id ? "bg-[#f2f7ff]" : ""
                }`}
              >
                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#edf3fa]">
                  {ticket.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ticket.preview} alt="Vista previa del ticket" className="size-full object-cover" />
                  ) : (
                    <FileText className="size-5 text-black/35" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{ticket.merchant || "Comercio por confirmar"}</p>
                  {ticket.invoices?.length?<p className="mt-1 text-xs leading-5 text-[#526e87]">{ticket.invoices.filter(i=>i.lifecycle!=="replaced").map(invoiceStatusLabel).join(" · ")}</p>:null}
                  <p className="mt-1 truncate text-xs text-black/42">
                    {ticket.fileName} · {formatDate(ticket.createdAt)}
                    <span className="mt-1 block text-[#237f89] sm:hidden">{ticket.status}</span>
                  </p>
                </div>
                <Badge variant="outline" className={`hidden sm:inline-flex ${statusStyle[ticket.status]}`}>
                  {ticket.status}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-black/28" />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 py-12 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf3fa]">
                <FileText className="size-5 text-black/35" />
              </div>
              <p className="mt-4 text-sm font-bold">Todavía no hay tickets</p>
              <p className="mt-1 text-xs text-black/42">Sube uno para probar el flujo completo.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileView({
  profileName,
  profile,
  setProfile,
  csfBusy,
  reviewFields,
  onCsfFile,
  onSave,
  saving,
  extraction,
  csfFileId,
  onDownload,
}: {
  profileName: string;
  profile: FiscalProfile;
  setProfile: React.Dispatch<React.SetStateAction<FiscalProfile>>;
  csfBusy: boolean;
  reviewFields: string[];
  onCsfFile: (file: File) => Promise<void>;
  onSave: () => void;
  saving: boolean;
  extraction: ExtractedField[];
  csfFileId?: string;
  onDownload: (id:string) => void;
}) {
  const fiscalFields: Array<{ key: keyof FiscalProfile; label: string; placeholder: string }> = [
    { key: "rfc", label: "RFC", placeholder: "XAXX010101000" },
    { key: "legalName", label: "Nombre o razón social", placeholder: "Como aparece ante el SAT" },
    { key: "taxRegime", label: "Régimen fiscal", placeholder: "Selecciona el régimen de tu CSF" },
    ...(personType(profile.rfc)==="moral"?[{key:"legalForm" as keyof FiscalProfile,label:"Forma jurídica (opcional)",placeholder:"No sustituye al régimen fiscal"}]:[]),
    { key: "postalCode", label: "Código postal fiscal", placeholder: "00000" },
    { key: "cfdiUse", label: "Uso CFDI predeterminado", placeholder: "Selecciona un uso compatible" },
    { key: "email", label: "Correo de entrega de facturas", placeholder: "correo@ejemplo.com" },
    { key: "phone", label: "Teléfono (opcional)", placeholder: "Solo si el portal lo requiere" },
  ];

  const addressFields: Array<{ key: keyof FiscalProfile; label: string; placeholder: string }> = [
    { key: "streetType", label: "Tipo de vialidad", placeholder: "Calle, avenida, boulevard…" },
    { key: "street", label: "Nombre de la vialidad", placeholder: "Nombre de la calle" },
    { key: "exteriorNumber", label: "Número exterior", placeholder: "Número exterior" },
    { key: "interiorNumber", label: "Número interior", placeholder: "Opcional" },
    { key: "neighborhood", label: "Colonia", placeholder: "Colonia" },
    { key: "locality", label: "Localidad", placeholder: "Localidad" },
    { key: "municipality", label: "Municipio o alcaldía", placeholder: "Municipio o demarcación" },
    { key: "state", label: "Estado", placeholder: "Entidad federativa" },
    { key: "country", label: "País", placeholder: "Confirma si no aparece en la constancia" },
  ];

  const fieldLabels: Record<string, string> = Object.fromEntries(
    [...fiscalFields, ...addressFields].map((field) => [field.key, field.label]),
  );

  function renderField(field: { key: keyof FiscalProfile; label: string; placeholder: string }) {
    const needsReview = reviewFields.includes(field.key);
    return (
      <label key={field.key} className="space-y-2 text-sm font-bold">
        <span className="flex items-center gap-2">
          {field.label}
          {needsReview ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-amber-800">
              Revisar
            </span>
          ) : null}
        </span>
        {field.key==="taxRegime"||field.key==="cfdiUse"||field.key==="legalForm"?<select aria-label={field.label} value={field.key==="taxRegime"?(regimeEntry(profile.taxRegime)?catalogValue(regimeEntry(profile.taxRegime)!):profile.taxRegime):field.key==="cfdiUse"?(useEntry(profile.cfdiUse)?catalogValue(useEntry(profile.cfdiUse)!):profile.cfdiUse):profile.legalForm} onChange={e=>setProfile(current=>({...current,[field.key]:e.target.value}))} className="h-11 w-full rounded-xl border border-[#dce7f0] bg-[#f7f9fc] px-3 text-sm font-normal">
          <option value="">{field.placeholder}</option>
          {field.key==="taxRegime"?TAX_REGIMES.filter(row=>currentEntry(row)&&(!personType(profile.rfc)||row.persons?.includes(personType(profile.rfc)!))).map(row=><option key={row.code} value={catalogValue(row)}>{catalogValue(row)}</option>):field.key==="cfdiUse"?allowedCfdiUses(profile).map(row=><option key={row.code} value={catalogValue(row)}>{catalogValue(row)}</option>):LEGAL_FORMS.map(form=><option key={form} value={form}>{form}</option>)}
        </select>:<Input
          value={profile[field.key]}
          placeholder={field.placeholder}
          onChange={(event) =>
            setProfile((current) => ({ ...current, [field.key]: event.target.value }))
          }
          className={`h-11 rounded-xl bg-[#f7f9fc] font-normal ${
            needsReview ? "border-amber-300 bg-amber-50/60" : ""
          }`}
        />}
      </label>
    );
  }

  return (
    <section className="mx-auto max-w-4xl rounded-[28px] border border-[#dfe7f1] bg-white p-5 shadow-[0_18px_60px_rgba(15,54,101,.06)] sm:p-8">
      <div className="flex items-start gap-4 border-b border-[#e4ebf4] pb-6">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f5f6] text-[#2b9da8]">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2b9da8]">
            {profileName}
          </p>
          <h2 className="mt-1 text-lg font-semibold">Datos del receptor</h2>
          <p className="mt-1 text-sm leading-6 text-black/45">
            Se reutilizan en cada solicitud. Confirma siempre el Uso CFDI antes de enviar.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#b8dde1] bg-[linear-gradient(135deg,#eef9fa_0%,#f7fbff_100%)] p-4 sm:p-5">
        <label className={`flex items-center gap-4 ${csfBusy ? "cursor-wait" : "cursor-pointer"}`}>
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#2b9da8] text-white shadow-[0_8px_24px_rgba(43,157,168,.24)]">
            {csfBusy ? <RefreshCw className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#173c55]">
              {csfBusy ? "Leyendo tu constancia…" : "Autorrellenar con tu Constancia de Situación Fiscal"}
            </p>
            <p className="mt-1 truncate text-xs leading-5 text-[#60778a]">
              {profile.csfFileName || "Sube una imagen o PDF; los datos dudosos quedarán para revisión."}
            </p>
          </div>
          <span className="hidden rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#247f88] shadow-sm sm:inline-flex">
            {profile.csfFileName ? "Cambiar archivo" : "Elegir archivo"}
          </span>
          <Input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={csfBusy}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onCsfFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {reviewFields.length ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Hay datos que requieren tu revisión</p>
            <p className="mt-1 text-xs leading-5">
              {reviewFields.map((field) => fieldLabels[field] ?? field).join(", ")}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {fiscalFields.map(renderField)}
      </div>

      <div className="mt-8 border-t border-[#e4ebf4] pt-7">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#edf4fb] text-[#2878c8]">
            <MapPin className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Domicilio fiscal</h3>
            <p className="mt-1 text-xs leading-5 text-[#718198]">
              Se obtiene de la constancia y puedes corregirlo antes de solicitar una factura.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {addressFields.map(renderField)}
        </div>
      </div>

      <FiscalCasePanel profile={profile}/>
      <ExtractionReview fields={extraction}/>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {csfFileId?<Button variant="outline" onClick={()=>onDownload(csfFileId)}>Descargar constancia privada</Button>:null}
        <Button type="button" disabled={saving || csfBusy} onClick={onSave} className="h-11 rounded-xl bg-[#2b9da8] px-5 hover:bg-[#23858e]">
          <Save /> Guardar y confirmar perfil
        </Button>
      </div>
    </section>
  );
}

function InvoicesView({
  profile,
  tickets,
  profileComplete,
  onSelect,
}: {
  profile: FiscalProfile;
  tickets: Ticket[];
  profileComplete: boolean;
  onSelect: (id: string) => void;
}) {
  const invoices = tickets.filter((ticket) => Boolean(ticket.invoices?.length));
  const invoiceCount=new Set(invoices.flatMap(t=>(t.invoices??[]).filter(invoiceIncluded).map(i=>i.id))).size;
  const totalDocumented = invoices.reduce((sum, ticket) => sum + documentedAmount(ticket), 0);
  const unclassified = invoices.filter((ticket) => inferSector(ticket) === "Por clasificar").length;

  const sectorMap = new Map<string, { amount: number; count: number }>();
  invoices.filter(ticket=>documentedAmount(ticket)>0).forEach((ticket) => {
    const sector = inferSector(ticket);
    const current = sectorMap.get(sector) ?? { amount: 0, count: 0 };
    sectorMap.set(sector, {
      amount: current.amount + documentedAmount(ticket),
      count: current.count + 1,
    });
  });

  const shareBase = totalDocumented || 1;
  const sectors = Array.from(sectorMap.entries())
    .map(([name, values]) => ({
      name,
      ...values,
      share: Math.round((values.amount / shareBase) * 100),
      color: sectorColors[name] ?? sectorColors["Por clasificar"],
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);

  const gradientSlices = sectors.reduce<{ slices: string[]; cursor: number }>(
    (current, sector) => {
      const end = current.cursor + sector.share;
      return {
        cursor: end,
        slices: [
          ...current.slices,
          `${sector.color} ${current.cursor}% ${end}%`,
        ],
      };
    },
    { slices: [], cursor: 0 },
  ).slices;
  const chartBackground = gradientSlices.length
    ? `conic-gradient(${gradientSlices.join(", ")})`
    : "conic-gradient(#e6edf4 0% 100%)";

  function exportInvoices() {
    if (!invoices.length) return;
    const headers = [
      "Comercio",
      "RFC emisor",
      "Fecha",
      "Total MXN",
      "Folio o ticket",
      "Uso CFDI",
      "Sector",
      "Estado",
    ];
    const rows = invoices.map((ticket) => [
      ticket.merchant || "Por confirmar",
      ticket.merchantRfc,
      ticket.purchaseDate,
      documentedAmount(ticket).toFixed(2),
      ticket.ticketNumber,
      ticket.cfdiUse,
      inferSector(ticket),
      (ticket.invoices??[]).map(invoiceStatusLabel).join("; "),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `facturas-facturate-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <FiscalCasePanel profile={profile}/>
      <p className="text-xs leading-6 text-[#526e87]">{invoiceCount} XML en los totales. Se excluyen sustituidas, cancelaciones reportadas y CFDI cancelados o no encontrados en SAT. Los XML sin consulta se incluyen como documentos registrados, con vigencia pendiente. Las compras agrupadas se suman por su importe asignado.</p>
      <section className="relative overflow-hidden rounded-[30px] bg-[#0b1f3a] p-6 text-white shadow-[0_22px_70px_rgba(11,31,58,.2)] sm:p-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-[#2b9da8]/25 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-2 text-xs font-medium text-white/72">
              <Calculator className="size-4 text-[#79d5dc]" /> Tu resumen de gastos
            </div>
            <h2 className="mt-6 max-w-2xl text-3xl font-medium leading-tight tracking-[-0.045em] sm:text-4xl">
              Entiende en qué gastas y conserva cada CFDI en orden.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/56">
              Este resumen usa únicamente las facturas registradas en Factúrate. Los cálculos fiscales definitivos requieren XML y validación contable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!invoices.length}
                onClick={exportInvoices}
                className="h-11 rounded-xl bg-[#2b9da8] px-5 hover:bg-[#23858e]"
              >
                <FileSpreadsheet /> Exportar a Excel
              </Button>
              <span className="self-center text-xs text-white/40">Archivo CSV compatible con Excel</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryTile label="Facturas organizadas" value={String(invoiceCount)} />
            <SummaryTile label="Por clasificar" value={String(unclassified)} />
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[.08] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/40">Gasto documentado</p>
              <p className="mt-2 text-2xl font-medium tracking-[-0.04em]">{formatMoney(totalDocumented)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <article className="rounded-[26px] border border-[#dfe7f1] bg-white p-5 shadow-[0_18px_60px_rgba(15,54,101,.06)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PieChart className="size-4 text-[#2b9da8]" /> Gastos por sector
              </p>
              <p className="mt-1 text-xs text-[#718198]">Clasificación sugerida; confirma la categoría con tu contador</p>
            </div>
            <Badge variant="outline" className="border-[#dce7f0] bg-[#f7fafc] text-[#5f7289]">
              {invoiceCount} CFDI
            </Badge>
          </div>

          <div className="mt-7 grid gap-7 sm:grid-cols-[170px_1fr] sm:items-center">
            <div
              className="relative mx-auto grid size-40 place-items-center rounded-full"
              style={{ background: chartBackground }}
              role="img"
              aria-label="Gráfica de gastos por sector"
            >
              <div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-inner">
                <div>
                  <p className="text-2xl font-medium tracking-[-0.04em]">{invoiceCount}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-[#7a899a]">facturas</p>
                </div>
              </div>
            </div>

            {sectors.length ? (
              <div className="space-y-4">
                {sectors.map((sector) => (
                  <div key={sector.name}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: sector.color }} />
                        <span className="truncate">{sector.name}</span>
                      </span>
                      <span className="shrink-0 text-[#6f8093]">{sector.share}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2f7]">
                      <div className="h-full rounded-full" style={{ width: `${sector.share}%`, background: sector.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-[#718198]">
                Cuando completes tu primera factura, aquí aparecerá la distribución real de tus gastos.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[26px] border border-[#cfe4e6] bg-[#eef8f8] p-5 shadow-[0_18px_60px_rgba(43,157,168,.08)] sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-white text-[#2b9da8] shadow-sm">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Lectura fiscal preliminar</p>
              <p className="mt-0.5 text-xs text-[#58777b]">Orientación, no determinación fiscal</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-[#829195]">Determinación fiscal</p>
            <p className="mt-2 text-2xl font-medium tracking-[-0.04em]">Revisión contable requerida</p>
            <p className="mt-3 text-xs leading-5 text-[#6c7d80]">
              No es correcto aplicar un porcentaje al total. Se necesitan IVA desglosado, régimen, actividad, ingresos, pagos provisionales y deducibilidad de cada gasto.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InsightItem label="Perfil fiscal" value={profileComplete ? "Completo" : "Incompleto"} ready={profileComplete} />
            <InsightItem label="XML asociados" value={String(new Set(invoices.flatMap(t=>(t.invoices??[]).map(i=>i.id))).size)+" disponibles"} ready={invoices.length>0} />
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-[#dfe7f1] bg-white shadow-[0_18px_60px_rgba(15,54,101,.06)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf4fb] text-[#2878c8]">
              <Mail className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Recepción por correo</p>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700">
                  No conectada
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-[#718198]">
                Factúrate todavía no envía correos ni supervisa una bandeja de entrada para detectar PDF o XML. El correo del perfil solo se usa como dato de entrega al solicitar la factura.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Confirmación manual requerida
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-[#dfe7f1] bg-white shadow-[0_18px_60px_rgba(15,54,101,.06)]">
        <div className="flex flex-col gap-4 border-b border-[#e5ebf2] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="size-4 text-[#2b9da8]" /> Biblioteca de facturas
            </p>
            <p className="mt-1 text-xs text-[#718198]">XML asociados a tus tickets · origen de la gestión indicado en el historial</p>
          </div>
          <Button variant="outline" disabled={!invoices.length} onClick={exportInvoices} className="rounded-xl">
            <Download /> Descargar reporte
          </Button>
        </div>

        {invoices.length ? (
          <div className="divide-y divide-[#edf1f5]">
            {invoices.map((invoice) => {
              const sector = inferSector(invoice);
              return (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => onSelect(invoice.id)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[#f8fafc] sm:grid-cols-[1.2fr_.8fr_auto] sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f5f6] text-[#2b9da8]">
                      <ReceiptText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{invoice.merchant || "Comercio por confirmar"}</p>
                      <p className="mt-1 truncate text-xs text-[#7a899a]">
                        {invoice.merchantRfc || "RFC pendiente"} · {formatDate(invoice.purchaseDate || invoice.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full bg-[#f1f5f8] px-3 py-1 text-[11px] font-medium text-[#607286]">
                    {sector}
                  </span>
                  <p className="text-xs leading-5 text-[#526e87]">{(invoice.invoices??[]).map(invoiceStatusLabel).join(" · ")}</p>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="text-sm font-semibold">{formatMoney(documentedAmount(invoice))}</p>
                    <ChevronRight className="size-4 text-[#91a0b0]" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center px-6 py-12 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf3f7] text-[#8090a2]">
                <ReceiptText className="size-5" />
              </div>
              <p className="mt-4 text-sm font-semibold">Aún no hay facturas completadas</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[#7a899a]">
                Aquí aparecerán los tickets con un XML asociado que coincida con los datos confirmados.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OperationView({
  tickets,
  counts,
}: {
  tickets: Ticket[];
  counts: { review: number; process: number; done: number };
}) {
  const total = tickets.length;
  const resolutionProgress = total ? Math.round((counts.done / total) * 100) : 0;
  const attempts = tickets.reduce((sum, item) => sum + item.attempts, 0);
  const pipeline = [
    { label: "Por validar", value: counts.review, color: "#e6a23c" },
    { label: "En seguimiento", value: counts.process, color: "#2878c8" },
    { label: "CFDI completados", value: counts.done, color: "#2b9da8" },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] bg-[#0b1f3a] p-6 text-white shadow-[0_22px_70px_rgba(11,31,58,.2)] sm:p-8">
        <div className="absolute -right-12 -top-20 size-64 rounded-full bg-[#2878c8]/25 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-2 text-xs font-medium text-white/70">
              <BarChart3 className="size-4 text-[#79d5dc]" /> Resumen operativo
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
              Cada solicitud, visible de principio a fin.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/52">
              Revisa qué necesita tu atención, qué sigue en trámite y qué ya terminó con CFDI.
            </p>
            <div className="mt-7 max-w-xl">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/48">Avance de resolución</span>
                <span className="font-medium text-white">{resolutionProgress}%</span>
              </div>
              <Progress value={resolutionProgress} className="h-2.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#79d5dc]" />
            </div>
          </div>

          <div
            className="grid size-40 shrink-0 place-items-center rounded-full p-3"
            style={{ background: `conic-gradient(#2b9da8 ${resolutionProgress}%, rgba(255,255,255,.1) 0)` }}
          >
            <div className="grid size-full place-items-center rounded-full bg-[#0b1f3a] text-center">
              <div>
                <p className="text-4xl font-medium tracking-[-0.05em]">{counts.done}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">resueltas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Solicitudes registradas" value={total} tone="navy" />
        <Metric label="Por validar" value={counts.review} tone="blue" />
        <Metric label="En seguimiento" value={counts.process} tone="sky" />
        <Metric label="CFDI completados" value={counts.done} tone="green" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <article className="rounded-[26px] border border-[#dfe7f1] bg-white p-5 shadow-[0_18px_60px_rgba(15,54,101,.06)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Flujo actual</p>
              <p className="mt-1 text-xs text-[#758599]">Distribución de todas las solicitudes</p>
            </div>
            <span className="rounded-full bg-[#f1f5f8] px-3 py-1 text-[11px] font-medium text-[#64758a]">{total} movimientos</span>
          </div>

          <div className="mt-7 space-y-6">
            {pipeline.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
                    {stage.label}
                  </span>
                  <span className="text-[#68798d]">{stage.value}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f6]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${total ? Math.max((stage.value / total) * 100, stage.value ? 8 : 0) : 0}%`, background: stage.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <MiniStat label="Con revisión" value={String(counts.review + counts.process)} />
            <MiniStat label="Seguimientos manuales" value={String(attempts)} />
          </div>
        </article>

        <article className="rounded-[26px] border border-[#dfe7f1] bg-white p-5 shadow-[0_18px_60px_rgba(15,54,101,.06)] sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#e8f5f6] text-[#2b9da8]">
              <Settings className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Cobertura del asistente</p>
              <p className="mt-0.5 text-xs text-[#758599]">Capacidades de esta versión privada</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <CapabilityRow title="Lectura de tickets y constancias" status="Disponible" tone="ready" />
            <CapabilityRow title="Manejo automático del portal" status="Falta conectar navegador" tone="pending" />
            <CapabilityRow title="Si aparece un CAPTCHA" status="Te pediremos ayuda" tone="manual" />
            <CapabilityRow title="Entrega por correo" status="La realiza el comercio" tone="blocked" />
          </div>

          <div className="mt-6 rounded-2xl border border-[#dce7f0] bg-[#f7fafc] p-4 text-xs leading-5 text-[#65768a]">
            La IA puede leer tus documentos, pero todavía no tiene un navegador seguro conectado para llenar portales por sí sola. Por ahora, Factúrate te acompaña, abre el portal y guarda el folio que obtengas.
          </div>
        </article>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4">
      <p className="text-2xl font-medium tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">{label}</p>
    </div>
  );
}

function InsightItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[#66787b]">
        <span className={`size-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#183c41]">{value}</p>
    </div>
  );
}

function CapabilityRow({
  title,
  status,
  tone,
}: {
  title: string;
  status: string;
  tone: "ready" | "pending" | "manual" | "blocked";
}) {
  const tones = {
    ready: "bg-emerald-50 text-emerald-700",
    pending: "bg-blue-50 text-blue-700",
    manual: "bg-amber-50 text-amber-700",
    blocked: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e4eaf1] p-4">
      <span className="text-sm font-medium text-[#263b54]">{title}</span>
      <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${tones[tone]}`}>{status}</span>
    </div>
  );
}


function ExtractionReview({fields}:{fields:ExtractedField[]}) {
  if(!fields.length)return null;
  return <details className="mt-5 rounded-2xl border border-[#dfe7f1] bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold">Revisar lo que leyó la IA</summary>
    <p className="mt-3 text-xs leading-5 text-[#718198]">Compara cada dato con el ticket original. Si algo no coincide, corrígelo antes de continuar.</p>
    <div className="mt-3 divide-y divide-[#edf2f7]">{fields.map(field=><div key={field.field} className="py-3 text-xs">
      <div className="flex items-center justify-between gap-3"><span className="font-semibold">{field.field}</span><span className={field.requiresReview?"text-amber-800":"text-[#237f89]"}>{field.requiresReview?"Necesita revisión":"Lectura clara"}</span></div>
      <p className="mt-1 break-words">{field.value??"No visible en el documento"}</p>
      <p className="mt-2 leading-5 text-[#718198]">Dónde lo encontró: {field.source??"No encontró texto suficiente"}</p>
      {field.observation?<p className="mt-1 leading-5 text-amber-800">{field.observation}</p>:null}
    </div>)}</div>
  </details>;
}

function TicketPanel({
  ticket,tickets,onInvoiceAction,profileComplete,profile,automationReady,browserConfigured,onClose,onChange,onRemove,onSave,onAction,onAnalyze,onDownload,onInvoice,onRefresh,disabled,dirty,notice,onDiscard,
}:{
  ticket:Ticket; tickets:Ticket[]; onInvoiceAction:(id:string,action:string,revision:number,reason?:string)=>Promise<void>; profileComplete:boolean; profile:FiscalProfile; automationReady:boolean; browserConfigured:boolean; onClose:()=>void;
  onChange:(patch:Partial<Ticket>)=>void; onRemove:()=>void; onSave:()=>void;
  onAction:(action:string,reference?:string,portalAccess?:PortalAccessOptions)=>void; onAnalyze:()=>void;
  onRefresh:()=>void; onDownload:(id:string)=>void; onInvoice:(file:File,kind:string,options?:InvoiceAssociation)=>Promise<void>; disabled:boolean; dirty:boolean;
  notice:string; onDiscard:()=>void;
}) {
  const [reference,setReference]=useState("");
  const [manualConfirmed,setManualConfirmed]=useState(false);
  const [portalAccess,setPortalAccess]=useState<PortalAccessOptions>({loginEmail:profile.email,allowEmailAttempt:true,useSavedSession:true});
  const [connectionBusy,setConnectionBusy]=useState(false);
  const activeAutomation=Boolean(ticket.automation&&["queued","running","needs_captcha","needs_human","dispatch_unknown","needs_review"].includes(ticket.automation.state));
  const editable=!activeAutomation&&["Recibido","Requiere revisión","Requiere información","Listo para solicitar","Error temporal"].includes(ticket.status);
  const invoiceAllowed=Boolean(ticket.confirmedAt)&&profileComplete&&!["queued","running","needs_captcha","needs_human","dispatch_unknown"].includes(ticket.automation?.state??"");
  const fields:Array<{key:keyof Ticket;label:string;placeholder:string}>=[
    {key:"merchant",label:"Comercio",placeholder:"Nombre visible"},
    ...(ticket.merchantRfc ? [{key:"merchantRfc" as keyof Ticket,label:"RFC del emisor",placeholder:"RFC visible en el ticket"}] : []),
    {key:"purchaseDate",label:"Fecha de compra",placeholder:"DD/MM/AAAA"},
    {key:"total",label:"Total MXN",placeholder:"123.45, sin símbolo ni comas"},
    {key:"folio",label:"Folio",placeholder:"Solo si aparece"},
    {key:"ticketNumber",label:"Número de ticket",placeholder:"No confundir con el folio"},
    {key:"branch",label:"Sucursal",placeholder:"Si aparece"},
    {key:"securityCode",label:"Código de seguridad",placeholder:"Si el ticket lo incluye"},
    {key:"trackingNumber",label:"Número de rastreo",placeholder:"Solo si dice Rastreo"},
    {key:"stationNumber",label:"Estación",placeholder:"No es el número de ticket"},
    {key:"transactionNumber",label:"Transacción",placeholder:"Conserva todos los dígitos"},
    {key:"portalUrl",label:"URL de facturación",placeholder:"https://…"},
  ];
  function confirmData(){
    const summary=profile.legalName+" · RFC "+profile.rfc+" · CP "+profile.postalCode+" · "+ticket.cfdiUse+"\nCorreo de entrega: "+profile.email+"\nTicket: "+(ticket.trackingNumber||ticket.ticketNumber||ticket.folio||ticket.transactionNumber||"Identificador por localizar en el original")+" · Total: "+ticket.total+"\nForma de pago: "+(ticket.paymentMethod||"Pendiente")+"\nMétodo de pago: "+(ticket.settlementMethod||"Pendiente")+"\nPortal: "+billingEntryUrl(ticket.portalUrl);
    if(automationReady){
      if(window.confirm("¿Los datos son correctos y quieres solicitar la factura?\n\n"+summary+"\n\nAl continuar, autorizas a Factúrate a analizar el ticket original durante todo el proceso con OpenAI, usar Browserless y compartir con el portal oficial solo los datos requeridos para llenar y enviar una sola solicitud. Puede consultar el original para leer identificadores adicionales que el portal vaya pidiendo. Se respetan tu forma y método de pago, tus correcciones y tu perfil fiscal; los datos ambiguos requieren tu intervención. El navegador intentará resolver los CAPTCHA. Primero buscará la opción de invitado o reutilizará tu sesión guardada.\nCorreo de acceso: "+portalAccess.loginEmail+". Intento con correo: "+(portalAccess.allowEmailAttempt?"autorizado (podría enviar un código o enlace)":"desactivado")+". Uso de sesión guardada: "+(portalAccess.useSavedSession?"sí":"no")+". Si todavía hace falta contraseña, código o un paso personal, te pedirá completar solo el acceso en la sesión remota y continuará."))onAction("confirm-and-request",undefined,portalAccess);
      return;
    }
    if(window.confirm("¿Los datos son correctos?\n\n"+summary+"\n\nSe guardarán como confirmados. La solicitud automática todavía no está activada y no se enviará nada."))onAction("confirm");
  }
  function openPortal(){
    try{
      const url=new URL(billingEntryUrl(ticket.portalUrl));
      if(url.protocol!=="https:"||url.username||url.password)throw Error();
      const opened=window.open(url.href,"_blank","noopener,noreferrer");
      if(!opened)window.alert("No pudimos abrir el portal en otra pestaña. Permite las ventanas emergentes para Factúrate y vuelve a intentarlo.");
    }catch{
      window.alert("Revisa la dirección del portal de facturación y guarda los cambios antes de continuar.");
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#07182d]/35 backdrop-blur-[2px]">
      <aside role="dialog" aria-modal="true" aria-label="Revisión del ticket" className="h-[100dvh] w-full max-w-xl overflow-y-auto bg-[#f7f9fc] pb-8 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dfe7f1] bg-[#f7f9fc] px-5 py-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2b9da8]">Revisión del ticket</p><p className="mt-1 truncate font-semibold">{ticket.fileName}</p></div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar panel"><X/></Button>
        </div>
        <div className="space-y-5 p-5 sm:p-7">
          {notice?<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{notice}</p>:null}
          {dirty?<Button disabled={disabled} variant="ghost" size="sm" onClick={onDiscard}>Descartar cambios sin guardar</Button>:null}
          <div className="rounded-2xl border border-[#d7e1ed] bg-white p-4">
            <div className="flex items-center justify-between gap-2"><Badge variant="outline" className={statusStyle[ticket.status]??"border-[#dce7f0] bg-[#edf4fb] text-[#173c55]"}>{ticket.status}</Badge><span className="text-[11px] text-[#718198]">Historial en servidor</span></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {ticket.fileId?<Button disabled={disabled} variant="outline" size="sm" onClick={()=>onDownload(ticket.fileId!)}><Download/>Documento original</Button>:null}
              {editable&&ticket.fileId?<Button disabled={disabled||dirty} variant="outline" size="sm" onClick={onAnalyze}><Sparkles/>Analizar con IA</Button>:null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(field=>{
            const rawValue=String(ticket[field.key]??"");
            const displayValue=field.key==="purchaseDate"?formatPurchaseDateMX(rawValue):rawValue;
            return <label key={field.key} className={`space-y-2 text-xs font-semibold ${field.key==="portalUrl"?"sm:col-span-2":""}`}>
              <span>{field.label}{ticket.extraction?.find(f=>f.field===field.key)?.requiresReview?<span className="ml-2 text-amber-700">· compárala con el ticket</span>:null}</span>
              <Input disabled={disabled||!editable} value={displayValue} placeholder={field.placeholder} inputMode={field.key==="purchaseDate"?"numeric":undefined} onChange={e=>onChange({[field.key]:e.target.value})} className="h-11 rounded-xl bg-white font-normal"/>
              {field.key==="purchaseDate"?<span className="block font-normal text-[#718198]">Ejemplo: 18/09/2026</span>:null}
            </label>;
          })}</div>
          <label className="block space-y-2 text-xs font-semibold"><span>Uso del CFDI</span>
            <Select disabled={disabled||!editable} value={useEntry(ticket.cfdiUse)?catalogValue(useEntry(ticket.cfdiUse)!):ticket.cfdiUse} onValueChange={v=>onChange({cfdiUse:v})}>
              <SelectTrigger className="h-12 w-full rounded-xl bg-white"><SelectValue placeholder="Selecciona el uso para esta compra"/></SelectTrigger>
              <SelectContent className="max-h-72 max-w-[calc(100vw-2rem)]">{allowedCfdiUses(profile).map(catalogValue).map(use=><SelectItem key={use} value={use}>{use}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-xs font-semibold" htmlFor="ticket-payment-method"><span>Forma de pago</span>
            <Select disabled={disabled||!editable} value={PAYMENT_METHODS.find(m=>m.code===ticket.paymentMethod||m.value===ticket.paymentMethod)?.code??""} onValueChange={v=>onChange({paymentMethod:v})}>
              <SelectTrigger id="ticket-payment-method" className="h-12 w-full rounded-xl bg-white"><SelectValue placeholder="Selecciona cómo pagaste esta compra"/></SelectTrigger>
              <SelectContent className="max-h-72">{PAYMENT_METHODS.map(method=><SelectItem key={method.code} value={method.code}>{method.value}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-xs font-semibold" htmlFor="ticket-settlement-method"><span>Método de pago (PUE / PPD)</span>
            <Select disabled={disabled||!editable} value={ticket.settlementMethod??""} onValueChange={v=>onChange({settlementMethod:v})}>
              <SelectTrigger id="ticket-settlement-method" className="h-12 w-full rounded-xl bg-white"><SelectValue placeholder="Confirma cómo se liquida la operación"/></SelectTrigger>
              <SelectContent>{SETTLEMENT_METHODS.map(method=><SelectItem key={method.code} value={method.code}>{method.code} · {method.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <p className="text-xs leading-6 text-[#526e87]">Forma de pago es efectivo, tarjeta u otro instrumento. Método indica PUE o PPD. PPD requiere forma 99 · Por definir; PUE requiere la forma real. No elegimos estos datos por ti.</p>
          <p className="text-xs leading-6 text-[#526e87]">El agente podrá volver a analizar el ticket original mientras avanza por el portal. Conservaremos las etiquetas de cada identificador y te pediremos ayuda cuando falte un dato o no se pueda leer con claridad.</p>
          <label className="block space-y-2 text-xs font-semibold"><span>Categoría del gasto (informativa)</span>
            <Select disabled={disabled||!editable} value={ticket.category||"Por clasificar"} onValueChange={v=>onChange({category:v})}>
              <SelectTrigger className="w-full rounded-xl bg-white"><SelectValue/></SelectTrigger><SelectContent>{Object.keys(sectorColors).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <ExtractionReview fields={ticket.extraction??[]}/>
          <div className="rounded-2xl border border-[#dce7f0] bg-white p-4 text-xs leading-6">
            <p className="font-semibold">Receptor de la factura</p><p>{profile.legalName||"Nombre pendiente"} · {profile.rfc||"RFC pendiente"}</p>
            <p>{profile.taxRegime||"Régimen pendiente"} · CP {profile.postalCode||"pendiente"}</p><p>{profile.email||"Correo pendiente"}</p>
            {!profileComplete?<p className="mt-2 text-amber-800">Guarda y confirma el perfil fiscal antes de continuar.</p>:null}
          </div>
          {editable?<div className="flex flex-wrap gap-3">
            <Button disabled={disabled} variant="outline" onClick={onSave}><Save/>Guardar cambios</Button>
            <Button disabled={disabled||connectionBusy||dirty||!profileComplete||!ticket.paymentMethod||!ticket.settlementMethod||Boolean(automationReady&&!portalAccess.loginEmail.trim())} onClick={confirmData} className="bg-[#2b9da8] hover:bg-[#23858e]"><CheckCircle2/>{automationReady?"Confirmar datos y solicitar factura":"Confirmar datos"}</Button>
          </div>:null}
          {dirty?<p role="status" className="text-xs text-amber-800">Tienes cambios pendientes. Guárdalos para poder continuar.</p>:null}
          <section className="rounded-2xl border border-[#cde0ed] bg-[#edf5fb] p-4">
            <h3 className="text-sm font-semibold">Solicitar tu factura</h3>
            {browserConfigured&&ticket.portalUrl?<PortalConnection key={ticket.id} ticketId={ticket.id} access={portalAccess} onChange={setPortalAccess} onBusyChange={setConnectionBusy} disabled={disabled||dirty||["queued","running","needs_human","needs_captcha","dispatch_unknown"].includes(ticket.automation?.state??"")}/>:null}
            {automationReady?<>
              <p className="mt-2 text-xs leading-6 text-[#526e87]">Después de confirmar, el agente revisa los campos del portal y consulta el ticket original durante cada etapa. Usa la forma y el método de pago y el perfil fiscal confirmados, pide ayuda si falta información y envía una sola solicitud. Puedes volver a abrir el ticket para consultar el resultado.</p>
              <p className="mt-2 break-all text-xs leading-6 text-[#526e87]">Portal que se abrirá: {billingEntryUrl(ticket.portalUrl)||"Falta indicar la URL de facturación."}</p>
              {ticket.status==="Solicitud en proceso"?<div className="mt-4 rounded-xl border border-sky-200 bg-white p-4 text-xs leading-6 text-[#274b68]"><strong>Estamos solicitando tu factura.</strong><p>{ticket.automation?.message||"El agente está trabajando en el portal del comercio."}</p><p>No necesitas hacer nada.</p></div>:null}
              {ticket.automation&&["needs_captcha","needs_human"].includes(ticket.automation.state)?<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                <strong>El portal necesita tu intervención.</strong>
                <p className="mt-2">{ticket.automation.message}</p>{ticket.automation.assistanceExpiresAt?<p>Completa el acceso antes de {new Date(ticket.automation.assistanceExpiresAt).toLocaleString("es-MX")}. Si vence, esta sesión no podrá continuar.</p>:null}<p>Completa el paso en la sesión segura y elige Done. El navegador continuará desde el mismo lugar.</p>
                {ticket.automation?.liveUrl?<Button className="mt-3 whitespace-normal bg-[#2b9da8]" onClick={()=>window.open(ticket.automation!.liveUrl,"_blank","noopener,noreferrer")}><ExternalLink/>Abrir comprobación segura</Button>:null}
                <Button disabled={disabled||!ticket.automation?.liveUrl} variant="outline" className="mt-3 whitespace-normal" onClick={()=>onAction("resume-automation")}>Actualizar estado del navegador</Button>
              </div>:null}
              {ticket.status==="Solicitud enviada"?<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900"><strong>Solicitud enviada.</strong><p>{ticket.automation?.message||"El comercio recibió la solicitud."}</p><p>Revisa el correo indicado en tu perfil para recibir la factura.</p></div>:null}
              {ticket.automation&&["dispatch_unknown","needs_review","failed"].includes(ticket.automation.state)?<AutomationDiagnostic key={ticket.automation.id} ticketId={ticket.id} job={ticket.automation} onRecover={kind=>onAction(kind==="blank"?"repair-page":"repair-format")}/>:null}
              {ticket.automation&&["needs_review","submitted"].includes(ticket.automation.state)?<InvoiceLookup ticketId={ticket.id} onDownload={onDownload} onVerified={onRefresh}/>:null}
              {ticket.automation?.evidenceFileId?<Button type="button" variant="outline" className="mt-3" onClick={()=>onDownload(ticket.automation!.evidenceFileId!)}><Download/>Descargar evidencia del portal</Button>:null}
              {ticket.automation&&["queued","running","needs_captcha","needs_human"].includes(ticket.automation.state)?<Button type="button" variant="outline" disabled={disabled} className="mt-3" onClick={()=>{if(window.confirm("¿Detener el navegador? Esto no cancela una factura que ya se haya emitido. Después será necesario verificar el resultado en el portal."))onAction("cancel")}}>Detener navegador</Button>:null}
              {editable?<p className="mt-3 text-xs leading-6 text-[#526e87]">Usa el botón <strong>Confirmar datos y solicitar factura</strong>. Esa será la autorización para llenar y enviar la solicitud.</p>:null}
            </>:<>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><strong>{browserConfigured?"Falta verificar el agente de facturación.":"La solicitud automática todavía no está activada."}</strong><p>{browserConfigured?"En Anuncios > Tu cuenta, ejecuta Verificar automatización. Cuando pase la prueba podrás confirmar este ticket y solicitar su factura automáticamente.":"Puedes continuar manualmente mientras se configura la automatización."}</p></div>
              {canOpenBillingPortal(ticket.status)?<Button disabled={disabled||dirty||!ticket.portalUrl} className="mt-4 bg-[#2b9da8]" onClick={openPortal}><ExternalLink/>{ticket.status==="CAPTCHA pendiente"?"Abrir portal y resolver comprobación":"Abrir portal de facturación"}</Button>:null}
              {ticket.status==="Listo para solicitar"?<>
                <div className="mt-3 flex flex-wrap gap-2"><Button disabled={disabled||dirty} variant="outline" onClick={()=>onAction("captcha")}>El portal pide una comprobación</Button><Button disabled={disabled||dirty} variant="outline" onClick={()=>onAction("blocked")}>No puedo entrar al portal</Button></div>
                <div className="mt-5 border-t border-[#d1e1ee] pt-4">
                  <label className="text-xs font-semibold">Folio o número de confirmación<Input disabled={disabled} className="mt-2 bg-white" value={reference} maxLength={180} onChange={e=>setReference(e.target.value)} placeholder="Ejemplo: Factura 1295"/></label>
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={manualConfirmed} onChange={e=>setManualConfirmed(e.target.checked)}/>Ya terminé la solicitud en el portal y recibí este folio.</label>
                  <Button disabled={disabled||dirty||!manualConfirmed||reference.trim().length<3} className="mt-3 w-full whitespace-normal bg-[#123d66]" onClick={()=>onAction("manual-sent",reference)}>Guardar folio y marcar como enviada</Button>
                </div>
              </>:null}
              {ticket.status==="CAPTCHA pendiente"?<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><strong>El portal necesita comprobar que eres una persona.</strong><p className="mt-2">Abre el portal, resuelve la comprobación y regresa a Factúrate.</p><Button disabled={disabled} variant="outline" className="mt-3 whitespace-normal" onClick={()=>{if(window.confirm("¿Ya resolviste la comprobación en el portal?"))onAction("resume")}}>Listo, ya la resolví</Button></div>:null}
            </>}
            {ticket.status==="Portal bloqueado"?<p className="mt-3 text-xs leading-6 text-amber-900">No pudimos abrir el portal. Revisa que la dirección sea correcta o solicita ayuda al comercio.</p>:null}
            {["Solicitud enviada","Esperando respuesta del comercio"].includes(ticket.status)?<div className="mt-4 flex flex-wrap gap-3">
              {ticket.status==="Solicitud enviada"?<Button disabled={disabled} variant="outline" onClick={()=>onAction("waiting")}>Sigo esperando al comercio</Button>:null}
              <Button disabled={disabled||ticket.attempts>=3} variant="outline" onClick={()=>onAction("follow-up")}>Registrar seguimiento manual ({ticket.attempts}/3)</Button>
              <p className="text-xs leading-5 text-[#526e87]">No se reemite ni se reenvía la solicitud. No hay supervisión automática de correo.</p>
            </div>:null}
          </section>
          <InvoiceDocuments ticket={ticket} tickets={tickets} allowed={invoiceAllowed} disabled={disabled||dirty} onImport={onInvoice} onAction={onInvoiceAction} onDownload={onDownload}/>
          <section className="rounded-2xl border border-[#dfe7f1] bg-white p-4">
            <h3 className="text-sm font-semibold">Historial verificable de acciones</h3><ol className="mt-4 space-y-4">{ticket.events?.map(e=><li key={e.id} className="border-l-2 border-[#b8dde1] pl-3 text-xs"><p className="font-semibold">{e.state}</p><time className="mt-1 block text-[#718198]">{new Date(e.at).toLocaleString("es-MX")}</time><p className="mt-1 leading-5">{e.cause}</p></li>)}</ol>
          </section>
          <button disabled={disabled} type="button" onClick={onRemove} className="text-xs font-semibold text-rose-700 hover:underline">Eliminar ticket</button>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "blue" | "sky" | "green" | "navy" }) {
  const tones = {
    blue: { dot: "#2b9da8", wash: "#e8f5f6" },
    sky: { dot: "#2878c8", wash: "#e9f3fc" },
    green: { dot: "#3ba272", wash: "#eaf7f0" },
    navy: { dot: "#0b1f3a", wash: "#edf2f7" },
  };
  const selectedTone = tones[tone];
  return (
    <article className="rounded-[22px] border border-[#dfe7f1] bg-white p-4 shadow-[0_12px_35px_rgba(15,54,101,.05)]">
      <div className="flex items-center justify-between">
        <span className="size-2.5 rounded-full" style={{ background: selectedTone.dot }} />
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: selectedTone.wash }}>
          <span className="size-1.5 rounded-full" style={{ background: selectedTone.dot }} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-medium tracking-[-0.05em] text-[#10233f]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#718198]">{label}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f2f6fb] p-3">
      <p className="text-xl font-medium">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-black/40">{label}</p>
    </div>
  );
}
