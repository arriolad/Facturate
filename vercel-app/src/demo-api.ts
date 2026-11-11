import {createInitialWorkspace,createLocalProfile} from '@/lib/facturate-workspace';
let workspace=createInitialWorkspace();
const profile=workspace.profiles[0];
profile.displayName='Perfil de demostración';
profile.fiscal={...profile.fiscal,rfc:'XAXX010101000',legalName:'Usuario de demostración',taxRegime:'612 - Personas Físicas con Actividades Empresariales y Profesionales',postalCode:'01000',email:'demo@example.invalid'};
profile.confirmedAt='2026-11-11T12:00:00Z';
const states=['Requiere revisión','Factura recibida','Listo para solicitar','Esperando respuesta del comercio'] as const;
profile.tickets=['Café de ejemplo','Papelería de ejemplo','Estacionamiento de ejemplo','Restaurante de ejemplo'].map((merchant,i)=>({id:'demo-ticket-'+i,fileName:'ticket-ejemplo-'+(i+1)+'.png',fileType:'image/png',createdAt:'2026-11-10T12:00:00Z',status:states[i],merchant,merchantRfc:'',purchaseDate:'2026-11-10',total:['148.00','580.00','75.00','420.00'][i],ticketNumber:'DEMO-'+(i+1),portalUrl:'',cfdiUse:'G03 - Gastos en general',confidence:0,attempts:0,revision:1,paymentMethod:'04 - Tarjeta de crédito',settlementMethod:'PUE',events:[],invoices:i===1?[{id:'demo-invoice',fileId:'demo-xml',uuid:'00000000-0000-4000-8000-000000000001',total:'580.00',receivedAt:'2026-11-10T12:00:00Z',validation:'Documento ficticio de demostración',lifecycle:'active',satStatus:'unverified',revision:1}]:[]}));
const demoSeed=structuredClone(workspace);
let demoEmail='demo@example.invalid';
export function resetDemoWorkspace(email?:string){workspace=structuredClone(demoSeed);demoEmail=email??'demo@example.invalid';}
const nativeFetch=window.fetch.bind(window);
const demoOnly='Esta función necesita la app privada. La demo pública no carga archivos, analiza documentos ni envía solicitudes reales.';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const path=url.pathname,method=init.method??'GET';
 let body:any={};try{if(typeof init.body==='string')body=JSON.parse(init.body)}catch{return json({message:'Datos inválidos.'},400)}
 if(path==='/api/workspace')return json({workspace,capabilities:{visualReady:false,storage:false,aiConfigured:false,browserConfigured:false,model:'',automation:'setup-required',mail:false,antivirus:false,aiUsedToday:0,aiDailyLimit:0},consentVersion:'demo',requiredConsentVersion:'demo',user:{email:demoEmail}});
 if(path==='/api/notifications')return json({items:[],unread:0,pushConfigured:false,publicKey:null});
 if(path==='/api/notifications/read')return json({ok:true});
 if(path==='/api/legacy-import/status')return json({imported:true});
 if(path==='/api/profiles'&&method==='POST'){const p=createLocalProfile(body.displayName);workspace.profiles.push(p);workspace.activeProfileId=p.id;return json({message:'Perfil de demostración creado.'});}
 const match=path.match(/^\/api\/profiles\/([^/]+)(\/select)?$/);
 if(match){const p=workspace.profiles.find(p=>p.id===match[1]);if(!p)return json({message:'Perfil no encontrado.'},404);if(match[2]){workspace.activeProfileId=p.id;return json({ok:true});}if(method==='DELETE'){if(workspace.profiles.length===1)return json({message:'Conserva al menos un perfil de demostración.'},400);workspace.profiles=workspace.profiles.filter(v=>v.id!==p.id);workspace.activeProfileId=workspace.profiles[0].id;return json({ok:true});}Object.assign(p,body);return json({ok:true});}
 const ticketMatch=path.match(/^\/api\/tickets\/([^/]+)$/);
 if(ticketMatch){const p=workspace.profiles.find(p=>p.id===workspace.activeProfileId)!;if(method==='DELETE'){p.tickets=p.tickets.filter(t=>t.id!==ticketMatch[1]);return json({ok:true});}const ticket=p.tickets.find(t=>t.id===ticketMatch[1]);if(ticket&&body.fields){Object.assign(ticket,body.fields);ticket.revision=(ticket.revision??0)+1;return json({ok:true});}}
 if(path==='/api/fiscal/archive'||path==='/api/fiscal/archive/sync')return json({documents:[]});
 if(path==='/api/fiscal/declarations'&&method==='GET')return json({drafts:[]});
 return json({message:demoOnly},409);
};
