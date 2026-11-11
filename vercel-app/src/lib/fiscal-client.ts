export async function fiscalRequest<T>(path:string,init:RequestInit={}){
 const response=await fetch(path,{...init,credentials:'same-origin',headers:{'x-facturate-request':'1',...(init.body&&!(init.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...init.headers}});
 const value=await response.json().catch(()=>({message:'No se pudo leer la respuesta del servidor.'}));
 if(!response.ok)throw new Error(value.message??'No se completó la operación.');return value as T;
}
export const fiscalPath=(section:string,profileId:string)=>`/api/fiscal/${section}?profileId=${encodeURIComponent(profileId)}`;
