import { PAYMENT_FORM_CATALOG, catalogValue, currentEntry } from './fiscal-rules';
// Persisted paymentMethod is the legacy field name for SAT FormaPago.
export const PAYMENT_FORMS = PAYMENT_FORM_CATALOG.filter(row=>currentEntry(row)).map(row=>({...row,value:catalogValue(row)}));
export const PAYMENT_METHODS = PAYMENT_FORMS;
export function paymentMethod(value:string) {
 const normalized=value.normalize('NFC').trim();
 const entry=PAYMENT_FORM_CATALOG.find(form=>currentEntry(form) && (normalized===form.code || normalized===catalogValue(form).normalize('NFC')));
 return entry ? catalogValue(entry) : '';
}
