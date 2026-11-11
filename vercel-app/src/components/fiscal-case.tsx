'use client';
import type { FiscalProfile } from '@/lib/facturate-workspace';
import { fiscalCase, fiscalErrors } from '@/lib/fiscal-rules';
export function FiscalCasePanel({profile}:{profile:FiscalProfile}){
 const item=fiscalCase(profile),errors=fiscalErrors(profile);
 return <section className="mt-5 rounded-2xl border border-[#cfe4e6] bg-[#eef8f8] p-4 text-sm">
  <h3 className="font-semibold">Caso fiscal · {item.title}</h3>
  {item.legalForm?<p className="mt-2">Forma jurídica: {item.legalForm}. El régimen se confirma por separado.</p>:null}
  {errors.length?<p role="status" className="mt-2 text-amber-900">{errors.join(' ')}</p>:null}
  <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6 text-[#365b68]">{item.notes.map(note=><li key={note}>{note}</li>)}</ul>
  <p className="mt-3 text-xs leading-5">Referencia: <a className="underline" href={item.source} target="_blank" rel="noopener noreferrer">{item.basis}</a>. Catálogos SAT: {item.catalogVersion}. Revisión del caso: {item.version}.</p>
 </section>;
}
