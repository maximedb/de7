import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface WordClick {
  id?: number;
  user_id: string;
  transcript_id: string;
  utterance_id: number;
  utterance: string;
  word: string;
  translation?: string;
  timestamp?: Date;
}

function generateRandomUsername(): string {
  const adjectives = ['happy', 'clever', 'brave', 'quiet', 'swift', 'bright', 'calm', 'eager', 'gentle', 'kind'];
  const nouns = ['cat', 'dog', 'bird', 'fish', 'lion', 'bear', 'wolf', 'deer', 'fox', 'owl'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}_${noun}_${num}`;
}

export async function ensureUserAuthenticated(): Promise<string> {
  // Check if user is already authenticated
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    return user.id;
  }
  
  // Check if we have stored auth credentials
  const storedUsername = localStorage.getItem('supabase_username');
  const storedPassword = localStorage.getItem('supabase_password');
  
  if (storedUsername && storedPassword) {
    // Try to sign in with stored credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${storedUsername}@example.com`,
      password: storedPassword
    });
    
    if (data.user && !error) {
      return data.user.id;
    }
  }
  
  // Generate new user credentials
  const username = generateRandomUsername();
  const password = username; // Use username as password for simplicity
  const email = `${username}@example.com`;
  
  // Create new user
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username
      }
    }
  });
  
  if (error) {
    throw error;
  }
  
  if (!data.user) {
    throw new Error('Failed to create user');
  }
  
  // Store credentials for future use
  localStorage.setItem('supabase_username', username);
  localStorage.setItem('supabase_password', password);
  
  return data.user.id;
}

export async function insertWordClick(data: Omit<WordClick, 'id' | 'timestamp' | 'user_id'>): Promise<WordClick> {
  // Ensure user is authenticated
  const userId = await ensureUserAuthenticated();
  
  const { data: result, error } = await supabase
    .from('word_clicks')
    .insert({
      user_id: userId,
      transcript_id: data.transcript_id,
      utterance_id: data.utterance_id,
      utterance: data.utterance,
      word: data.word,
      translation: data.translation
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return result;
}

export async function getWordClicksByDate(transcriptId: string): Promise<WordClick[]> {
  // Ensure user is authenticated
  const userId = await ensureUserAuthenticated();
  
  const { data: clicks, error } = await supabase
    .from('word_clicks')
    .select('*')
    .eq('transcript_id', transcriptId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return clicks || [];
}