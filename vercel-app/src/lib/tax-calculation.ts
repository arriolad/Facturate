import tariffs from './data/tax-tariffs.json';
import {fiscalErrors,personType,regimeEntry,fiscalCase} from './fiscal-rules';
import {archiveActive,TAX_CHECKS,TAX_FIELDS,TAX_RULE_VERSION,type TaxInput,type TaxSnapshot,type TaxResult,type TaxValues,type ArchiveDocument} from './tax-workspace';
import {moneyCents,decimalMoney,ratio} from './tax-money';
const LISR='https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',LIVA='https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf';
export const RMF_SOURCE='https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/rmf/RMF_2026-DOF-28122025.pdf';
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
type Key=keyof TaxValues;
export function requiredTaxFields(profile:TaxSnapshot['profile'],input:Pick<TaxInput,'kind'|'taxRegime'>):Key[]{
 const person=personType(profile.rfc),code=regimeEntry(input.taxRegime||profile.taxRegime)?.code;
 if(person==='fisica'&&code==='626')return input.kind==='annual'?['income','incomeAdjustments','withheldIsr']:['income','incomeAdjustments','withheldIsr','annualRevenue','vatOutput','vatCredit','vatWithheld','vatPriorCredit'];
 const fields:Key[]=['income','incomeAdjustments','deductions','deductionAdjustments','ptu','losses','priorIsr','withheldIsr'];
 if(person==='moral'&&code==='601'&&input.kind==='monthly'){fields.splice(fields.indexOf('deductions'),2);fields.push('coefficient');}
 if(person==='fisica'&&code==='612'&&input.kind==='annual')fields.push('personalDeductions');
 if(input.kind==='monthly')fields.push('vatOutput','vatCredit','vatWithheld','vatPriorCredit');return fields;
}
export function periodEnd(input:Pick<TaxInput,'year'|'month'|'kind'>){return input.kind==='annual'?`${input.year}-12-31`:`${input.year}-${String(input.month).padStart(2,'0')}-${new Date(Date.UTC(input.year,input.month,0)).getUTCDate()}`;}
export function documentRelevant(doc:ArchiveDocument,input:Pick<TaxInput,'year'|'month'|'kind'>){
 const dates=[doc.metadata.issuedAt?.slice(0,10),doc.review.cashDate,doc.review.recognitionDate].filter(Boolean) as string[];
 return !dates.length||dates.some(d=>d>=`${input.year}-01-01`&&d<=periodEnd(input));
}
export function progressiveTax(base:number,table:Array<{lower:number;upper:number|null;fixed:number;rate:number}>){
 if(base<=0)return 0;const row=table.find(r=>base>=r.lower&&(r.upper===null||base<=r.upper));if(!row)throw new Error('La tarifa no cubre esta base');return row.fixed+ratio(base-row.lower,row.rate);
}
export const capturePesos=(cents:number)=>Math.floor(cents/100)+(cents%100>50?1:0);
export function calculateTax(snapshot:TaxSnapshot,input:TaxInput,today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'})):TaxResult{
 const profile={...snapshot.profile,taxRegime:input.taxRegime||snapshot.profile.taxRegime},person=personType(profile.rfc),regime=regimeEntry(profile.taxRegime)?.code??'',key=`${person}-${regime}`;
 const supported=['moral-601','moral-626','fisica-612','fisica-626'].includes(key),annual=input.kind==='annual',pfResico=key==='fisica-626',result:TaxResult={version:TAX_RULE_VERSION,regime,caseName:fiscalCase(profile).title,state:'incomplete',blockers:[],warnings:[],lines:[],sources:[{title:'LISR: artículos 9, 14, 106, 113-E, 152 y 211-212 según el caso',url:LISR},{title:'LIVA: artículos 5, 5-D y 6',url:LIVA},{title:'CFF, artículo 20: ajuste del pago a pesos',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf'},{title:input.year===2025?'SAT: declaración anual PF 2025 y facilidad RESICO':'RMF 2026, regla 3.13.7 y 3.13.8',url:input.year===2025?'https://www.sat.gob.mx/minisitio/DeclaracionAnual/Personas/documentos/PreguntasFrecuentes_AnualPF2025.pdf':RMF_SOURCE},{title:`SAT, Anexo 8: tarifas exactas del ejercicio ${input.year}`,url:(tariffs.sources as Record<string,{url:string}>)[input.year]?.url??'https://www.sat.gob.mx/'}],period:annual?`Anual ${input.year}`:`${MONTHS[input.month-1]} ${input.year}`,closed:periodEnd(input)<today};
 result.blockers.push(...fiscalErrors(profile));
 if(!supported)result.blockers.push(`El cálculo automático para ${result.caseName} requiere un módulo especializado; puedes conservar su expediente y preparar el borrador sin importes determinados.`);
 if(![2025,2026].includes(input.year))result.blockers.push('No hay tarifas verificadas para este ejercicio.');
 if(!result.closed)result.blockers.push('El periodo aún no ha cerrado. Este cálculo es una proyección.');
 for(const check of TAX_CHECKS)if(!input.checks[check.key])result.blockers.push(check.label);
 const keys=requiredTaxFields(profile,input),values:Partial<Record<Key,number>>={};
 for(const key of keys){const raw=input.values[key]??'';
  if(raw===''){result.blockers.push(`Falta confirmar ${TAX_FIELDS.find(f=>f.key===key)?.label??key}; 0 debe indicarse expresamente.`);continue;}
  try{if(key==='coefficient'){if(!/^\d{1,2}(\.\d{1,4})?$/.test(raw)||Number(raw)>1)throw Error();values[key]=Math.round(Number(raw)*10000);}else values[key]=moneyCents(raw);}catch{result.blockers.push(`El valor de ${TAX_FIELDS.find(f=>f.key===key)?.label??key} no tiene un formato válido.`);}
 }
 const allValues=keys.every(k=>values[k]!==undefined),number=(key:Key)=>values[key]??0;
 const docs=snapshot.documents.filter(d=>!d.review.excluded&&documentRelevant(d,input));
 for(const doc of docs){
  if(['replaced','reported_cancelled'].includes(doc.lifecycle)||doc.satStatus==='cancelled'){result.warnings.push(`${doc.uuid??doc.metadata.label}: excluida por cancelación o sustitución.`);continue;}
  if(!doc.xmlFileId){result.blockers.push(`${doc.metadata.label??doc.id}: falta XML o su exclusión justificada como referencia.`);continue;}
  if((doc.role==='issued'?doc.metadata.issuer:doc.metadata.receiver)!==profile.rfc)result.blockers.push(`${doc.uuid}: el RFC del documento no corresponde a este perfil; revisa el expediente histórico.`);
  if(!doc.review.reviewed)result.blockers.push(`${doc.uuid}: falta revisar cobros, pagos y procedencia fiscal.`);
  if(doc.satStatus!=='valid'||!doc.satCheckedAt||new Date(today).getTime()-Date.parse(doc.satCheckedAt)>7*86400000)result.blockers.push(`${doc.uuid}: consulta vigencia SAT y concilia su resultado antes de cerrar (máximo 7 días).`);
  try{if(doc.satResult&&JSON.parse(doc.satResult).status==='unknown')result.blockers.push(`${doc.uuid}: la última consulta SAT no fue concluyente.`);}catch{result.blockers.push(`${doc.uuid}: el resultado SAT no es verificable.`);}
  const xmlRegime=doc.role==='issued'?doc.metadata.issuerRegime:doc.metadata.taxRegime;if(!xmlRegime||xmlRegime!==regime)result.blockers.push(`${doc.uuid}: el régimen del XML difiere del elegido para este periodo.`);
  if(doc.metadata.settlementMethod==='PPD')result.warnings.push(`${doc.uuid}: las parcialidades no se trasladan automáticamente; concilia complementos y cobros/pagos con los importes capturados.`);
  for(const warning of doc.metadata.taxWarnings??[])result.blockers.push(`${doc.uuid}: ${warning} Requiere tratamiento especializado o exclusión justificada antes de cerrar.`);
 }
 result.warnings.push('La consulta de vigencia SAT no valida por sí sola el sello criptográfico del XML ni su tratamiento contable; conserva y revisa el original.','Papel de trabajo para revisión y captura manual. No es un archivo oficial importable al SAT ni acredita presentación o pago.','No incluye nómina, DIOT, IEPS, retenciones que debas enterar por terceros, complementarias, estímulos, recargos ni casos especiales sin determinar. Si aplican, el borrador debe revisarse fuera del cálculo ordinario.');
 const line=(label:string,cents:number,detail?:string)=>result.lines.push({label,value:decimalMoney(cents),detail});
 if(supported&&allValues&&[2025,2026].includes(input.year)){
  const income=number('income')+number('incomeAdjustments'),deductions=number('deductions')+number('deductionAdjustments');let base=income,caused=0;
  if(key==='moral-626'&&income>3500000000)result.blockers.push('Los ingresos exceden $35,000,000: revisa la permanencia de la persona moral en RESICO.');
  if(pfResico&&annual&&income>350000000)result.blockers.push('Los ingresos exceden $3,500,000: determina el régimen y la obligación anual aplicables.');
  line('Ingresos fiscales sin IVA y ajustes',income,annual?'Ejercicio completo':pfResico?'Solo el mes':'Acumulados de enero al mes');
  if(pfResico&&annual){
   result.warnings.push('RESICO persona física: los pagos mensuales son definitivos y la RMF releva de la anual únicamente por esos ingresos. Otros ingresos y las opciones especiales requieren determinar su obligación por separado. No calculamos una anual RESICO por defecto.');
   line('ISR retenido informado del ejercicio',number('withheldIsr'));
  }else{
   if(pfResico){
    if(number('annualRevenue')<income)result.blockers.push('El ingreso acumulado anual no puede ser menor al ingreso de este mes.');
    if(number('annualRevenue')>350000000)result.blockers.push('Los ingresos acumulados exceden $3,500,000: revisa la permanencia y el cambio de régimen antes de usar este cálculo.');
    const rate=income<=2500000?100:income<=5000000?110:income<=8333333?150:income<=20833333?200:250;
    caused=ratio(income,rate);result.lines.push({label:'Tasa RESICO aplicable al ingreso completo',value:(rate/100).toFixed(2)+'%',detail:'Sin deducciones de gastos para ISR de esta sección.'});
   }else{
    if(key==='moral-601'&&!annual){base=ratio(income,number('coefficient'));result.lines.push({label:'Coeficiente confirmado',value:(number('coefficient')/10000).toFixed(4)});}
    else {base-=deductions;line('Deducciones autorizadas y ajustes',deductions);}
    base=Math.max(0,base-number('ptu')-number('losses')-(annual&&key==='fisica-612'?number('personalDeductions'):0));
    line('PTU disminuible confirmada',number('ptu'));line('Pérdidas fiscales aplicadas',number('losses'));if(annual&&key==='fisica-612')line('Deducciones personales procedentes ya limitadas',number('personalDeductions'));
    const tables=(tariffs.years as unknown as Record<string,{annual:Array<{lower:number;upper:number|null;fixed:number;rate:number}>;monthly:Record<string,Array<{lower:number;upper:number|null;fixed:number;rate:number}>>}>)[input.year];
    caused=person==='moral'?ratio(base,3000):progressiveTax(base,annual?tables.annual:tables.monthly[input.month]);
   }
   line('Base gravable de ISR',base);line('ISR causado antes de acreditamientos',caused);line('ISR acreditable retenido',number('withheldIsr'));if(!pfResico)line('Pagos provisionales anteriores acreditables',number('priorIsr'));
   const difference=caused-number('withheldIsr')-(pfResico?0:number('priorIsr'));
   result.isrDue=decimalMoney(Math.max(0,difference));result.isrCredit=decimalMoney(Math.max(0,-difference));
   line('ISR a cargo calculado',Math.max(0,difference));result.lines.push({label:'ISR para captura en pesos (ajuste CFF 20)',value:String(capturePesos(Math.max(0,difference)))});
   if(difference<0)line(annual?'ISR a favor estimado, sujeto a revisión':'Acreditamientos excedentes por conciliar; no devolución automática',-difference);
  }
  if(!annual){
   const balance=number('vatOutput')-number('vatCredit')-number('vatWithheld'),previous=number('vatPriorCredit'),due=Math.max(0,balance-previous),credit=Math.max(0,-balance)+Math.max(0,previous-Math.max(0,balance));
   line('IVA causado efectivamente cobrado en el mes',number('vatOutput'));line('IVA acreditable procedente',number('vatCredit'));line('IVA retenido por clientes',number('vatWithheld'));line('Saldo anterior disponible confirmado',previous);
   result.vatDue=decimalMoney(due);result.vatCredit=decimalMoney(credit);line('IVA a cargo calculado',due);line('Saldo de IVA disponible estimado',credit);result.lines.push({label:'IVA para captura en pesos (ajuste CFF 20)',value:String(capturePesos(due))});
  }else result.warnings.push('El IVA ordinario se determina por mes: no generamos un supuesto IVA anual a pagar sumando el ejercicio.');
 }
 result.blockers=[...new Set(result.blockers)];result.warnings=[...new Set(result.warnings)];result.state=result.blockers.length?'incomplete':pfResico&&annual?'not_applicable':'review';return result;
}
export function taxSuggestions(documents:ArchiveDocument[],profile:TaxSnapshot['profile'],input:TaxInput){
 const pfResico=personType(profile.rfc)==='fisica'&&regimeEntry(input.taxRegime||profile.taxRegime)?.code==='626',general=personType(profile.rfc)==='moral'&&regimeEntry(input.taxRegime||profile.taxRegime)?.code==='601';
 const values:Partial<Record<Key,number>>={income:0,deductions:0,withheldIsr:0,vatOutput:0,vatCredit:0,vatWithheld:0};let used=0;const excluded:string[]=[];
 const from=`${input.year}-01-01`,end=periodEnd(input),monthFrom=`${input.year}-${String(input.month).padStart(2,'0')}-01`;
 for(const doc of documents){
  if(!archiveActive(doc)||doc.review.excluded||!documentRelevant(doc,input))continue;
  if(!doc.xmlFileId||!doc.review.reviewed||doc.satStatus!=='valid'||!doc.satCheckedAt||Date.now()-Date.parse(doc.satCheckedAt)>7*86400000||Boolean(doc.metadata.taxWarnings?.length)||doc.metadata.settlementMethod==='PPD'){excluded.push(doc.uuid??doc.metadata.label??doc.id);continue;}
  const recognition=general?doc.review.recognitionDate:doc.review.cashDate,fromIsr=input.kind==='monthly'&&pfResico?monthFrom:from;
  try{
   const delta:Partial<Record<Key,number>>={};let included=false;
   if(recognition&&recognition>=fromIsr&&recognition<=end){
    if(doc.role==='issued'){delta.income=moneyCents(doc.review.incomeBase??'');delta.withheldIsr=moneyCents(doc.metadata.withheldIsr??'0');}else delta.deductions=moneyCents(doc.review.deductibleBase??'');included=true;
   }
   const cash=doc.review.cashDate;
   if(input.kind==='monthly'&&cash&&cash>=monthFrom&&cash<=end){if(doc.role==='issued'){delta.vatOutput=moneyCents(doc.metadata.vat??'0');delta.vatWithheld=moneyCents(doc.metadata.withheldVat??'0');}else delta.vatCredit=moneyCents(doc.review.creditableVat??'');included=true;}
   for(const [key,value] of Object.entries(delta))values[key as Key]=(values[key as Key]??0)+value!;
   if(included)used++;
  }catch{excluded.push(doc.uuid??doc.id);}
 }
 return {values:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,decimalMoney(v!)])),used,excluded,note:'Propuesta solo de XML revisados, vigentes y sin parcialidades. No prueba que tu contabilidad esté completa; confirma bancos, otros ingresos, límites y ajustes.'};
}
