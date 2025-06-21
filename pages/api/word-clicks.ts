import { NextApiRequest, NextApiResponse } from 'next';
import { initDatabase, insertWordClick } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize database table if it doesn't exist
    await initDatabase();

    const { user_id, utterance, word }: { user_id: string; utterance: string; word: string } = req.body;

    if (!user_id || !utterance || !word) {
      return res.status(400).json({ error: 'Missing required fields: user_id, utterance, word' });
    }

    // Insert word click into database
    const result = await insertWordClick({
      user_id,
      utterance,
      word
    });

    res.status(200).json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error storing word click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}