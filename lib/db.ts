import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

export interface WordClick {
  id?: number;
  user_id: string;
  utterance: string;
  word: string;
  timestamp: Date;
}

export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS word_clicks (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      utterance TEXT NOT NULL,
      word TEXT NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

export async function insertWordClick(data: Omit<WordClick, 'id' | 'timestamp'>) {
  return await sql`
    INSERT INTO word_clicks (user_id, utterance, word)
    VALUES (${data.user_id}, ${data.utterance}, ${data.word})
    RETURNING *
  `;
}