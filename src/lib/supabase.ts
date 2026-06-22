import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas no arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
