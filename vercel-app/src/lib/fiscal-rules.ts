import catalog from './data/sat-catalogs.json';

export type PersonType='fisica'|'moral';
type CatalogRow={code:string;label:string;persons?:string[];regimes?:string[];start?:string;end?:string};
export const FISCAL_CATALOG=catalog;
export const TAX_REGIMES=catalog.regimes as CatalogRow[];
export const CFDI_USE_CATALOG=catalog.uses as CatalogRow[];
export const PAYMENT_FORM_CATALOG=catalog.forms as CatalogRow[];
export const SETTLEMENT_METHODS=[{code:'PUE',label:'Pago en una sola exhibición'},{code:'PPD',label:'Pago en parcialidades o diferido'}];
export const LEGAL_FORMS=['S.A. de C.V.','S.A.','S.A.P.I. de C.V.','S. de R.L. de C.V.','S. de R.L.','S.C.','A.C.','S.A.S.','Otra persona moral'];
export const personType=(rfc:string):PersonType|undefined=>/^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/.test(rfc)?'moral':/^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/.test(rfc)?'fisica':undefined;
const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function catalogEntry(rows:CatalogRow[],value:string){return rows.find(row=>row.code===value.trim().split(/[\s·]/)[0]||norm(row.label)===norm(value));}
export const regimeEntry=(v:string)=>catalogEntry(TAX_REGIMES,v);
export const useEntry=(v:string)=>catalogEntry(CFDI_USE_CATALOG,v);
export const catalogValue=(r:CatalogRow)=>`${r.code} · ${r.label}`;
export const currentEntry=(r:CatalogRow,date=new Date().toISOString().slice(0,10))=>(!r.start||r.start<=date)&&(!r.end||r.end>=date);
export function allowedCfdiUses(profile:{rfc:string;taxRegime:string}){
 const person=personType(profile.rfc),regime=regimeEntry(profile.taxRegime);
 return CFDI_USE_CATALOG.filter(r=>!['CN01','CP01'].includes(r.code)&&currentEntry(r)&&(!person||r.persons?.includes(person))&&(!regime||r.regimes?.includes(regime.code)));
}
export function fiscalErrors(profile:{rfc:string;taxRegime:string;legalForm?:string},ticket?:{cfdiUse:string;paymentMethod?:string;settlementMethod?:string},requirePayment=false){
 const errors:string[]=[],person=personType(profile.rfc),regime=regimeEntry(profile.taxRegime);
 if(!person)errors.push('El RFC no permite identificar persona física o moral.');
 if(!regime||!currentEntry(regime))errors.push('Selecciona un régimen vigente del catálogo SAT.');
 else if(person&&!regime.persons?.includes(person))errors.push(`El régimen ${regime.code} no corresponde al tipo de persona de este RFC.`);
 if(profile.legalForm&&(!LEGAL_FORMS.includes(profile.legalForm)||person!=='moral'))errors.push('La forma jurídica solo corresponde a personas morales y no sustituye al régimen fiscal.');
 if(ticket){
  const use=useEntry(ticket.cfdiUse);
  if(!use||!allowedCfdiUses(profile).some(r=>r.code===use.code))errors.push('El uso CFDI no es compatible con el régimen y tipo de persona confirmados.');
  const form=ticket.paymentMethod?catalogEntry(PAYMENT_FORM_CATALOG,ticket.paymentMethod):undefined;
  if(ticket.paymentMethod&&(!form||!currentEntry(form)))errors.push('La forma de pago no pertenece al catálogo vigente.');
  if(requirePayment&&!form)errors.push('Confirma la forma de pago.');
  if(ticket.settlementMethod&&!SETTLEMENT_METHODS.some(m=>m.code===ticket.settlementMethod))errors.push('El método de pago debe ser PUE o PPD.');
  if(requirePayment&&!ticket.settlementMethod)errors.push('Confirma el método de pago PUE o PPD.');
  if(ticket.settlementMethod==='PPD'&&form?.code!=='99')errors.push('Para PPD selecciona 99 · Por definir como forma de pago.');
  if(ticket.settlementMethod==='PUE'&&['99','30'].includes(form?.code??''))errors.push('PUE requiere la forma de pago real; no admite 99 ni aplicación de anticipos en este flujo de ingreso.');
 }
 return errors;
}

const source='https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf';
const baseNotes=['La clasificación del perfil no comprueba su inscripción o elegibilidad ante el SAT.','Un CFDI recibido no determina por sí solo la deducción de ISR ni el acreditamiento de IVA.'];
export function fiscalCase(profile:{rfc:string;taxRegime:string;legalForm?:string}){
 const person=personType(profile.rfc),regime=regimeEntry(profile.taxRegime),key=`${person??'pendiente'}-${regime?.code??'pendiente'}`;
 const cases:Record<string,{title:string;notes:string[];basis:string}>={
  'fisica-626':{title:'Persona física · RESICO',basis:'LISR, artículos 113-E y 113-F',notes:['El ISR de esta sección se determina sobre ingresos efectivamente cobrados, sin aplicar deducciones de gastos. No se estima ahorro de ISR a partir de los tickets.','El tratamiento de IVA se revisa por separado según actividad y requisitos; no se aplica automáticamente la misma conclusión del ISR.']},
  'moral-626':{title:'Persona moral · RESICO',basis:'LISR, artículos 206 a 210',notes:['Este caso es distinto del RESICO de personas físicas. Las deducciones requieren revisar su pago y los requisitos aplicables.','La forma jurídica, por ejemplo S.A. de C.V., no acredita por sí sola pertenencia a RESICO.']},
  'moral-601':{title:'Persona moral · Régimen general',basis:'LISR, artículos 25, 27 y 28',notes:['Los gastos requieren revisión de indispensabilidad, documentación y requisitos; no todos los tickets son deducibles.','No se calcula ISR ni IVA aplicando una tasa al total documentado.']},
  'fisica-612':{title:'Persona física · Actividad empresarial o profesional',basis:'LISR, artículos 103 y 105',notes:['Las deducciones de la actividad requieren cumplir los requisitos aplicables; deben separarse de gastos personales.']},
  'fisica-605':{title:'Persona física · Sueldos y salarios',basis:'LISR, artículo 151',notes:['Una compra ordinaria no se convierte automáticamente en deducción personal. Revisa concepto, límites y forma de pago con tu contador.']},
  'fisica-606':{title:'Persona física · Arrendamiento',basis:'LISR, artículo 115',notes:['El tratamiento depende de las opciones y requisitos aplicables al arrendamiento. El sistema conserva documentos sin escoger una opción fiscal por ti.']},
  'fisica-616':{title:'Persona física · Sin obligaciones fiscales',basis:'Catálogo SAT c_UsoCFDI y c_RegimenFiscal',notes:['Solo se ofrecen usos compatibles con este régimen. Conservar una factura no implica un beneficio fiscal.']},
 };
 const valid=Boolean(person&&regime&&currentEntry(regime)&&regime.persons?.includes(person));
 const selected=(valid?cases[key]:undefined)??{title:valid?`Persona ${person==='fisica'?'física':'moral'} · ${regime!.label}`:'Caso fiscal pendiente de confirmar',basis:'Catálogos CFDI 4.0; revisión contable individual',notes:['Este régimen tiene particularidades que requieren revisión contable. Factúrate valida combinaciones del catálogo y no determina impuestos ni beneficios automáticos.']};
 return {id:key,person,regime:regime?.code,legalForm:profile.legalForm??'',title:selected.title,notes:[...selected.notes,...baseNotes],basis:selected.basis,source:selected.basis.startsWith('Catálogo')?catalog.source:source,version:'2026-10-25',catalogVersion:catalog.version};
}
