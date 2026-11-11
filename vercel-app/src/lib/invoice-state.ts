import type { InvoiceFile, Ticket } from './facturate-workspace';
export function invoiceIncluded(invoice:InvoiceFile){return !['replaced','reported_cancelled'].includes(invoice.lifecycle??'registered')&&!['cancelled','not_found'].includes(invoice.satStatus??'unverified');}
export function invoiceNeedsReview(ticket:Ticket){return Boolean(ticket.invoices?.length&&!ticket.invoices.some(invoiceIncluded));}
export function documentedAmount(ticket:Ticket){return (ticket.invoices??[]).filter(invoiceIncluded).reduce((sum,invoice)=>sum+Number(invoice.allocatedTotal??invoice.total),0);}
export function invoiceStatusLabel(invoice:InvoiceFile){
 if(invoice.lifecycle==='replaced')return 'Sustituida · original conservado';
 if(invoice.satStatus==='cancelled')return 'Cancelada según SAT';
 if(invoice.lifecycle==='reported_cancelled')return 'Cancelación reportada · por comprobar ante SAT';
 if(invoice.satStatus==='valid')return 'Vigente en la última consulta SAT';
 if(invoice.satStatus==='not_found')return 'No encontrada en SAT';
 return 'XML registrado · vigencia sin comprobar';
}
