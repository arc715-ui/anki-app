import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxekyubzgjlhpdeivgmk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZWt5dWJ6Z2psaHBkZWl2Z21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjE2NjYsImV4cCI6MjA4NTI5NzY2Nn0.8sqJHbZV5GxSiJDFlAjlZtbBty4T7DDFUhBnxN2KxP8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sign in with Google
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://arc715-ui.github.io/anki-app/',
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
