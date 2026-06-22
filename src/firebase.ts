import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Verifica a sessão inicial imediatamente para processar o hash do OAuth
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      if (session.provider_token) cachedAccessToken = session.provider_token;
      if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken || '');
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (session) {
        if (session.provider_token) cachedAccessToken = session.provider_token;
        if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken || '');
      } else {
        cachedAccessToken = null;
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
        scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
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
};

