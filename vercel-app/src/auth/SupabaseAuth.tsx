import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';
import { resetDemoWorkspace } from '../demo-api';

type Profile = { id: string; nombre: string; creado_en: string };
function visibleError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  if (/already registered|already exists|user_already_exists/i.test(message)) return 'Este correo ya está registrado. Inicia sesión.';
  if (/invalid login credentials|invalid_credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/password.*(least|short|weak)|weak_password/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|too many requests|security purposes/i.test(message)) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
  if (/invalid.*email|email.*invalid/i.test(message)) return 'Escribe un correo válido.';
  if (/failed to fetch|network/i.test(message)) return 'No pudimos conectar. Revisa tu conexión e intenta otra vez.';
  return 'No pudimos completar la operación. '+message;
}
export function SupabaseAuth({ children }: { children: (onSignOut:()=>void)=>ReactNode }) {
  const [session,setSession] = useState<Session|null>(null);
  const [initialized,setInitialized] = useState(false);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [profilePending,setProfilePending] = useState(false);
  const [profileError,setProfileError] = useState('');
  const [mode,setMode] = useState<'login'|'signup'>('signup');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [retry,setRetry] = useState(0);
  const activeUser = useRef<string|null>(null);

  useEffect(() => {
    let active = true;
    // No await or further Supabase requests inside onAuthStateChange.
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      if (!active) return;
      if (activeUser.current !== (next?.user.id??null)) {
        activeUser.current = next?.user.id??null;
        resetDemoWorkspace(next?.user.email);
        setProfile(null);
        setProfileError('');
      }
      setSession(next);
      setInitialized(true);
    });
    void supabase.auth.getSession().then(({data,error}) => {
      if (!active) return;
      if (error) setError(visibleError(error));
      setSession(data.session);setInitialized(true);
    }).catch(error=>{if(active){setError(visibleError(error));setInitialized(true);}});
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  const userId=session?.user.id;
  useEffect(() => {
    if (!session || busy) return;
    let active=true;
    setProfilePending(true);setProfileError('');
    void (async()=>{
      const {data,error}=await supabase.from('perfiles').select('id,nombre,creado_en').eq('id',session.user.id).maybeSingle();
      if(error)throw error;
      let result=data as Profile|null;
      // Recover only the authenticated user's own profile after an interrupted signup.
      if(!result){
        const ownName=session.user.user_metadata?.nombre;
        if(typeof ownName!=='string'||!ownName.trim())throw new Error('Tu cuenta no tiene un nombre de perfil.');
        const inserted=await supabase.from('perfiles').insert({id:session.user.id,nombre:ownName.trim()}).select('id,nombre,creado_en').single();
        if(inserted.error)throw inserted.error;
        result=inserted.data as Profile;
      }
      if(active)setProfile(result);
    })().catch(error=>{if(active)setProfileError(visibleError(error));}).finally(()=>{if(active)setProfilePending(false);});
    return()=>{active=false;};
  },[userId,busy,retry]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setError('');setNotice('');
    const cleanEmail=email.trim().toLowerCase();
    if(mode==='signup'&&(!name.trim()||name.trim().length>80)){setError('Escribe tu nombre, de 1 a 80 caracteres.');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)){setError('Escribe un correo válido.');return;}
    if(password.length<6){setError('La contraseña debe tener al menos 6 caracteres.');return;}
    setBusy(true);
    try{
      if(mode==='signup'){
        const {data,error}=await supabase.auth.signUp({email:cleanEmail,password,options:{data:{nombre:name.trim()}}});
        if(error)throw error;
        if(!data.user||!data.session){
          if(data.user?.identities?.length===0)throw new Error('User already registered');
          setNotice('Revisa tu correo para confirmar la cuenta antes de iniciar sesión.');return;
        }
        const result=await supabase.from('perfiles').insert({id:data.user.id,nombre:name.trim()}).select('id,nombre,creado_en').single();
        if(result.error)throw result.error;
        setProfile(result.data as Profile);setSession(data.session);
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email:cleanEmail,password});
        if(error)throw error;
        setSession(data.session);
      }
      setPassword('');
    }catch(error){setError(visibleError(error));}
    finally{setBusy(false);}
  }
  async function signOut(){
    if(busy)return;setBusy(true);setError('');
    try{
      const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;
      setSession(null);setProfile(null);setPassword('');setName('');resetDemoWorkspace();setNotice('Sesión cerrada.');
    }catch(error){setError(visibleError(error));}finally{setBusy(false);}
  }
  const inputClass='mt-2 w-full rounded-xl border border-[#cbdbe6] bg-white px-4 py-3 text-[#10233f] focus:outline-none focus:ring-2 focus:ring-[#2b9da8]';
  if(!initialized)return <main className="grid min-h-screen place-items-center bg-[#f4f7fb]"><p role="status">Comprobando tu sesión…</p></main>;
  if(session){
    if(profilePending||busy||!profile||profile.id!==session.user.id)return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6"><section className="max-w-lg rounded-3xl border bg-white p-8"><h1 className="text-2xl font-semibold">Factúrate</h1><p role={profileError?'alert':'status'} className="mt-4">{profileError||'Cargando tu perfil…'}</p>{error?<p role="alert" className="mt-3 text-red-700">{error}</p>:null}<div className="mt-5 flex gap-4">{profileError?<button type="button" onClick={()=>setRetry(v=>v+1)}>Reintentar</button>:null}<button type="button" disabled={busy} onClick={()=>void signOut()} className="text-[#237f89] underline">Cerrar sesión</button></div></section></main>;
    return <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce7f0] bg-white px-5 py-4 text-[#10233f]"><p className="text-lg font-semibold" role="status">Hola, {profile.nombre}</p><button type="button" onClick={()=>void signOut()} className="rounded-xl border border-[#b8d6dc] px-4 py-2 text-sm font-semibold text-[#17636b]">Cerrar sesión</button></div><div role="note" className="border-b border-[#b8dde1] bg-[#e8f5f6] px-5 py-3 text-xs leading-6 text-[#17636b]">Tu cuenta y nombre se guardan en Supabase. El espacio fiscal de esta versión sigue siendo una demostración con datos ficticios; se reinicia al salir o recargar.</div><div key={session.user.id}>{children(()=>void signOut())}</div></>;
  }
  return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10 text-[#10233f]"><section className="w-full max-w-md rounded-[28px] border border-[#dce7f0] bg-white p-7 shadow-xl sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-[#2b9da8]">Factúrate</p><h1 className="mt-3 text-3xl font-semibold">{mode==='signup'?'Crea tu cuenta':'Bienvenido de nuevo'}</h1><p className="mt-3 text-sm leading-6 text-[#64758a]">{mode==='signup'?'Regístrate para acceder a tu espacio en Factúrate.':'Inicia sesión para volver a tu espacio.'}</p><div className="mt-6 grid grid-cols-2 gap-2" aria-label="Opciones de acceso">{(['signup','login'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setError('');setNotice('');setPassword('');}} className={'rounded-xl px-3 py-3 text-sm font-semibold '+(mode===value?'bg-[#0b1f3a] text-white':'bg-[#edf4f8] text-[#496479]')}>{value==='signup'?'Crear cuenta':'Iniciar sesión'}</button>)}</div><form noValidate onSubmit={event=>void submit(event)} className="mt-6 space-y-5"><fieldset disabled={busy} className="space-y-5">{mode==='signup'?<label className="block text-sm font-semibold" htmlFor="auth-name">Nombre<input id="auth-name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className={inputClass}/></label>:null}<label className="block text-sm font-semibold" htmlFor="auth-email">Correo electrónico<input id="auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className={inputClass}/></label><label className="block text-sm font-semibold" htmlFor="auth-password">Contraseña<input id="auth-password" name="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} className={inputClass}/><span className="mt-2 block text-xs font-normal text-[#64758a]">Al menos 6 caracteres.</span></label></fieldset>{error?<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>:null}{notice?<p role="status" className="rounded-xl bg-[#e8f5f6] p-3 text-sm leading-6 text-[#17636b]">{notice}</p>:null}<button type="submit" disabled={busy} className="w-full rounded-xl bg-[#2b9da8] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Conectando…':mode==='signup'?'Registrarme':'Entrar'}</button></form><p className="mt-6 text-xs leading-6 text-[#64758a]">Versión de clase: utiliza datos de prueba. No cargues tickets, RFC ni constancias reales.</p></section></main>;
}
