import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://bonsascvgccjisjbqnfn.supabase.co';
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ankra3eNwkEWpbngQ5WVCQ_EMAD8f_I';
if (!url || !publicKey || (!publicKey.startsWith('sb_publishable_') && !publicKey.startsWith('eyJ'))) {
  throw new Error('Configura la URL y la publishable key de Supabase. No uses una secret key.');
}
export const supabase = createClient(url, publicKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'facturate.supabase.auth' },
});
