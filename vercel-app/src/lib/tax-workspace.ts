import type { FiscalProfile } from './facturate-workspace';
export type ArchiveReview={reviewed?:boolean;excluded?:boolean;note?:string;recognitionDate?:string;cashDate?:string;incomeBase?:string;deductibleBase?:string;creditableVat?:string};
export type ArchiveMetadata={uuid?:string;issuer?:string;issuerName?:string;receiver?:string;receiverName?:string;issuedAt?:string;total?:string;subtotal?:string;discount?:string;net?:string;vat?:string;withheldVat?:string;withheldIsr?:string;settlementMethod?:string;paymentForm?:string;taxRegime?:string;issuerRegime?:string;label?:string;concepts?:string[];taxWarnings?:string[];xmlHash?:string};
export type ArchiveDocument={id:string;profileId:string;sourceInvoiceId?:string;xmlFileId?:string;visualFileId?:string;visualMime?:string;uuid?:string;role:'received'|'issued'|'reference';metadata:ArchiveMetadata;review:ArchiveReview;lifecycle:string;satStatus:string;satCheckedAt?:string;satResult?:string;revision:number;createdAt:string;updatedAt:string;sourceRevision?:number};
export type TaxKind='monthly'|'annual';
export const TAX_RULE_VERSION='2026-10-25-v1';
export const TAX_FIELDS=[
 {key:'income',label:'Ingresos fiscales sin IVA',help:'Del mes para RESICO persona física; acumulados de enero al periodo para los demás cálculos.'},
 {key:'incomeAdjustments',label:'Otros ingresos y ajustes acumulables',help:'Ingresos fuera del XML y ajustes fiscales ya determinados. Escribe 0 si confirmaste que no hay.'},
 {key:'deductions',label:'Deducciones autorizadas de la actividad',help:'Importe fiscal procedente; no equivale al total de los tickets.'},
 {key:'deductionAdjustments',label:'Otras deducciones y ajustes autorizados',help:'Incluye los ajustes procedentes no recogidos en las facturas, con soporte contable.'},
 {key:'ptu',label:'PTU disminuible del periodo',help:'Importe fiscal procedente. En régimen general mensual, confirma el importe disminuible conforme al artículo 14.'},
 {key:'losses',label:'Pérdidas fiscales pendientes aplicables',help:'Importe actualizado y procedente ya revisado; no se calcula a partir de tickets.'},
 {key:'priorIsr',label:'Pagos provisionales de ISR anteriores',help:'Del mismo ejercicio, sin incluir el pago mensual que estás preparando.'},
 {key:'withheldIsr',label:'ISR que te retuvieron y es acreditable',help:'Solo retenciones procedentes de este periodo acumulado o ejercicio; no las que tú retuviste a proveedores.'},
 {key:'coefficient',label:'Coeficiente de utilidad',help:'Solo régimen general de persona moral mensual; máximo cuatro decimales, obtenido de la declaración aplicable.'},
 {key:'personalDeductions',label:'Deducciones personales procedentes y limitadas',help:'Solo anual de persona física 612; importe después de revisar requisitos, límites y estímulos.'},
 {key:'annualRevenue',label:'Ingresos totales acumulados del año',help:'Control del límite de RESICO persona física. Incluye los ingresos adicionales que afecten su elegibilidad.'},
 {key:'vatOutput',label:'IVA causado por actividades efectivamente cobradas en el mes',help:'No uses el total del CFDI ni el IVA de todo el año.'},
 {key:'vatCredit',label:'IVA acreditable procedente del mes',help:'Requiere pago, procedencia, proporción y requisitos. No todo IVA de compras es acreditable.'},
 {key:'vatWithheld',label:'IVA que tus clientes te retuvieron en el mes',help:'No incluye las retenciones que tú debes enterar por cuenta de proveedores.'},
 {key:'vatPriorCredit',label:'Saldo a favor de IVA anterior disponible',help:'Solo saldo conciliado, no aplicado antes ni solicitado en devolución.'},
] as const;
export type TaxValues=Record<(typeof TAX_FIELDS)[number]['key'],string>;
export const emptyTaxValues=()=>Object.fromEntries(TAX_FIELDS.map(f=>[f.key,''])) as TaxValues;
export const TAX_CHECKS=[
 {key:'regimeConfirmed',label:'Confirmé que el RFC y el régimen corresponden al periodo que preparo.'},
 {key:'completeRecords',label:'Concilié todos los ingresos, gastos, bancos y documentos, incluidos los que no están en Factúrate.'},
 {key:'paymentsReconciled',label:'Revisé fechas de cobro y pago, parcialidades, retenciones, pagos anteriores y saldos disponibles.'},
 {key:'eligibilityReviewed',label:'Revisé la procedencia y los límites de deducciones, IVA, pérdidas y demás ajustes fiscales.'},
 {key:'ordinaryScope',label:'La operación corresponde al régimen indicado, sin otros regímenes, complementarias, retenciones a terceros ni supuestos especiales sin resolver.'},
] as const;
export type TaxChecks=Record<(typeof TAX_CHECKS)[number]['key'],boolean>;
export type TaxInput={kind:TaxKind;year:number;month:number;taxRegime:string;values:TaxValues;checks:TaxChecks;notes:string};
export type TaxLine={label:string;value:string;detail?:string};
export type TaxResult={version:string;regime:string;caseName:string;state:'incomplete'|'review'|'not_applicable';blockers:string[];warnings:string[];lines:TaxLine[];isrDue?:string;isrCredit?:string;vatDue?:string;vatCredit?:string;sources:Array<{title:string;url:string}>;period:string;closed:boolean};
export type TaxSnapshot={profile:FiscalProfile;documents:ArchiveDocument[];createdAt:string;profileRevision:number};
export type TaxDraft={id:string;profileId:string;kind:TaxKind;year:number;month?:number;input:TaxInput;snapshot:TaxSnapshot;result:TaxResult;state:string;revision:number;stale:boolean;reviewer?:string;reviewedAt?:string;createdAt:string};
export const archiveActive=(doc:ArchiveDocument)=>!['replaced','reported_cancelled'].includes(doc.lifecycle)&&!['cancelled','not_found'].includes(doc.satStatus);
export const archiveStatus=(doc:ArchiveDocument)=>doc.lifecycle==='replaced'?'Sustituida':doc.satStatus==='cancelled'?'Cancelada según SAT':doc.lifecycle==='reported_cancelled'?'Cancelación reportada':doc.satStatus==='valid'?'Vigente en última consulta SAT':doc.satStatus==='not_found'?'No encontrada en SAT':doc.xmlFileId?'Vigencia SAT sin comprobar':'Copia visual sin XML';

export type TaxDraftSummary=Omit<TaxDraft,"snapshot">;
