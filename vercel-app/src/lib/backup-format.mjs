// Versioned, authenticated records. The password stays in the browser or local verifier.
export const BACKUP_FORMAT='facturate-encrypted-v1';
export const BACKUP_ITERATIONS=600000;
const encoder=new TextEncoder();
export function base64(bytes) {
  let text='';
  for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(text);
}
export function unbase64(value) {
  if(typeof value!=='string'||value.length>12*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Respaldo inválido');
  return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
export async function backupKey(password,salt) {
  if(typeof password!=='string'||password.length<20||password.length>1024)throw new Error('Usa una contraseña de entre 20 y 1024 caracteres.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:BACKUP_ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function backupHeader() {return {format:BACKUP_FORMAT,iterations:BACKUP_ITERATIONS,salt:base64(crypto.getRandomValues(new Uint8Array(16)))};}
export async function openBackup(password,header) {
  if(header?.format!==BACKUP_FORMAT||header.iterations!==BACKUP_ITERATIONS)throw new Error('Formato de respaldo no compatible');
  const salt=unbase64(header.salt);
  if(salt.length!==16)throw new Error('Respaldo inválido');
  return backupKey(password,salt);
}
function context(header,index) {return encoder.encode(`${BACKUP_FORMAT}:${header.salt}:${index}`);}
export async function encryptRecord(key,header,index,record) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(header,index)},key,encoder.encode(JSON.stringify(record)));
  return {index,iv:base64(iv),data:base64(new Uint8Array(data))};
}
export async function decryptRecord(key,header,index,record) {
  if(record?.index!==index)throw new Error('Orden del respaldo inválido');
  const iv=unbase64(record.iv);
  if(iv.length!==12)throw new Error('Respaldo inválido');
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:context(header,index)},key,unbase64(record.data));
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
}
export async function* readLines(stream) {
  const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let pending='',total=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done){pending+=decoder.decode();break;}
      total+=value.byteLength;
      if(total>200*1024*1024)throw new Error('El respaldo excede el límite de 200 MB');
      pending+=decoder.decode(value,{stream:true});
      let newline;
      while((newline=pending.indexOf('\n'))>=0){
        const line=pending.slice(0,newline);pending=pending.slice(newline+1);
        if(line.length>12*1024*1024)throw new Error('Registro demasiado grande');
        if(line)yield JSON.parse(line);
      }
      if(pending.length>12*1024*1024)throw new Error('Registro demasiado grande');
    }
    if(pending.trim())throw new Error('El respaldo está incompleto');
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function encryptedBackup(stream,password) {
  const header=backupHeader(),key=await openBackup(password,header),parts=[JSON.stringify(header)+'\n'];
  let index=0,ended=false,files=0;
  for await(const record of readLines(stream)){
    if(ended||(index===0&&record.type!=='manifest'))throw new Error('Respaldo inválido');
    if(record.type==='file')files++;
    if(record.type==='complete'){if(record.files!==files)throw new Error('Respaldo incompleto');ended=true;}
    parts.push(JSON.stringify(await encryptRecord(key,header,index++,record))+'\n');
  }
  if(!ended)throw new Error('No se completó el respaldo. Intenta de nuevo.');
  return new Blob(parts,{type:'application/octet-stream'});
}
