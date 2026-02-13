import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cgnrttgyjtjjzwkygvas.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbnJ0dGd5anRqanp3a3lndmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5Mjk1NzgsImV4cCI6MjA4NjUwNTU3OH0.6D0Sm0HUibuGU4IWxmNd-iX9zDcElGan75CvBAARt6w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sign in with Google
export async function signInWithGoogle() {
  const redirectTo = window.location.hostname === 'localhost'
    ? `${window.location.origin}/anki-app/`
    : 'https://arc715-ui.github.io/anki-app/';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });
  return { data, error };
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

// Get current session
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}
