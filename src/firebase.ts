import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

let cachedAccessToken: string | null = localStorage.getItem('provider_token');

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const isDev = import.meta.env.DEV;
  const isBypassEnabled = import.meta.env.VITE_ENABLE_AUTH_BYPASS === 'true';
  const hasBypassParam = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).get('bypass_auth') === 'true' || 
     localStorage.getItem('bypass_auth') === 'true');

  if (isDev && isBypassEnabled && hasBypassParam) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bypass_auth', 'true');
    }
    const mockUser: any = {
      id: 'mock-user-id-dr-agnaldo',
      email: 'dr.agnaldo@example.com',
      user_metadata: { full_name: 'Dr. Agnaldo Ferreira (Mock)' },
      aud: 'authenticated',
      role: 'authenticated'
    };
    setTimeout(() => {
      if (onAuthSuccess) onAuthSuccess(mockUser, 'mock-access-token');
    }, 100);
    return () => {};
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      if (session.provider_token) {
        cachedAccessToken = session.provider_token;
        localStorage.setItem('provider_token', session.provider_token);
      }
      if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken || '');
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (session) {
        if (session.provider_token) {
          cachedAccessToken = session.provider_token;
          localStorage.setItem('provider_token', session.provider_token);
        }
        if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken || '');
      } else {
        cachedAccessToken = null;
        localStorage.removeItem('provider_token');
        if (onAuthFailure) onAuthFailure();
      }
    }
  );

  return () => subscription.unsubscribe();
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;
    // signInWithOAuth redirects, so this won't actually be reached in most flows
    return null;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await supabase.auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('provider_token');
  localStorage.removeItem('bypass_auth');
};

