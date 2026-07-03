import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder-project');

if (isDemoMode) {
  console.warn('Aviso: Rodando em modo de demonstração local offline (sem Supabase).');
}

export const supabase = !isDemoMode
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: async () => ({ 
          data: { 
            session: { 
              user: { id: 'demo-user-id', email: 'contato@dragnaldo.com.br' }, 
              provider_token: 'demo-token' 
            } 
          }, 
          error: null 
        }),
        onAuthStateChange: (callback: any) => {
          // Simula login automático do usuário para demonstração local instantânea
          setTimeout(() => {
            callback('SIGNED_IN', { 
              user: { id: 'demo-user-id', email: 'contato@dragnaldo.com.br' }, 
              provider_token: 'demo-token' 
            });
          }, 100);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithOAuth: async () => {
          window.location.reload();
          return { data: {}, error: null };
        },
        signOut: async () => {
          return { error: null };
        }
      },
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: any) => ({
            single: async () => {
              // Retorna dados vazios simulando sucesso do banco
              return { data: { crm_data: null }, error: null };
            }
          })
        }),
        upsert: async (data: any, options: any) => {
          return { error: null };
        }
      }),
      storage: {
        from: (bucket: string) => ({
          upload: async () => ({ data: { path: 'demo-path' }, error: null }),
          list: async () => ({ data: [], error: null }),
          remove: async () => ({ data: [], error: null }),
          download: async () => ({ data: new Blob(), error: null })
        })
      }
    } as any;


