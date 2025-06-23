import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is not set');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export interface WordClick {
  id?: number;
  user_id: string;
  transcript_id: string;
  utterance_id: number;
  utterance: string;
  word: string;
  timestamp: Date;
}

export async function initDatabase() {
  // Table creation should be handled through Supabase dashboard or migrations
  // This function can be used to verify the table exists
  const { error } = await supabase
    .from('word_clicks')
    .select('id')
    .limit(1);
  
  if (error && error.code === 'PGRST116') {
    console.error('Table word_clicks does not exist. Please create it in Supabase dashboard with schema: id, user_id, transcript_id, utterance_id, utterance, word, timestamp');
    throw new Error('Table word_clicks not found');
  }
}

export async function insertWordClick(data: Omit<WordClick, 'id' | 'timestamp'>) {
  const { data: result, error } = await supabase
    .from('word_clicks')
    .insert({
      user_id: data.user_id,
      transcript_id: data.transcript_id,
      utterance_id: data.utterance_id,
      utterance: data.utterance,
      word: data.word
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return result;
}