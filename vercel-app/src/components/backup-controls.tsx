"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { encryptedBackup } from '@/lib/backup-format.mjs';

export function BackupControls({disabled=false}:{disabled?:boolean}) {
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [working,setWorking]=useState(false),[message,setMessage]=useState('');
  function changeOpen(next:boolean){if(working)return;setOpen(next);setPassword('');setConfirmation('');setMessage('');}
  async function download(){
    setWorking(true);setMessage('Preparando y cifrando tus datos guardados…');
    try{
      const response=await fetch('/api/backup',{method:'POST',headers:{'X-Facturate-Request':'1'},cache:'no-store'});
      if(!response.ok){const error=await response.json();throw new Error(error.message??'No se pudo crear el respaldo.');}
      if(!response.body)throw new Error('No se recibieron los datos.');
      const blob=await encryptedBackup(response.body,password);
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`facturate-${new Date().toISOString().slice(0,10)}.facturate-backup`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      setMessage('Copia cifrada preparada. Comprueba que se descargó y guárdala junto con tu contraseña en lugares separados.');
    }catch(error){setMessage(error instanceof Error?error.message:'No se pudo completar el respaldo.');}
    finally{setWorking(false);setPassword('');setConfirmation('');}
  }
  return <>
    <Button disabled={disabled} variant="outline" size="sm" onClick={()=>changeOpen(true)}>Descargar respaldo</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Respaldo cifrado de tu cuenta</DialogTitle><DialogDescription>Incluye todos tus perfiles, registros y archivos guardados. Los cambios sin guardar no se incluyen. Es una copia manual; no activa respaldos automáticos.</DialogDescription></DialogHeader>
        <p className="text-sm leading-6">El cifrado ocurre en este navegador. No enviamos ni guardamos tu contraseña: sin ella no podrás recuperar la copia. La restauración disponible se verifica en un entorno local separado; no reemplaza tus datos en la aplicación.</p>
        <label htmlFor="backup-password" className="text-sm font-medium">Contraseña de al menos 20 caracteres</label>
        <Input id="backup-password" type="password" autoComplete="new-password" maxLength={1024} disabled={working} value={password} onChange={e=>setPassword(e.target.value)}/>
        <label htmlFor="backup-confirmation" className="text-sm font-medium">Repite la contraseña</label>
        <Input id="backup-confirmation" type="password" autoComplete="new-password" maxLength={1024} disabled={working} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
        {message?<p role="status" className="text-sm leading-6">{message}</p>:null}
        <DialogFooter><Button variant="ghost" disabled={working} onClick={()=>changeOpen(false)}>Cerrar</Button><Button disabled={working||password.length<20||password!==confirmation} onClick={()=>void download()}>{working?'Cifrando…':'Crear copia cifrada'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
