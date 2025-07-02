import { Utterance } from './types';

export async function translateUtterances(utterances: Utterance[], apiKey: string): Promise<Utterance[]> {
  // Group utterances into batches to optimize API calls
  const BATCH_SIZE = 10;
  const batches: Utterance[][] = [];
  
  for (let i = 0; i < utterances.length; i += BATCH_SIZE) {
    batches.push(utterances.slice(i, i + BATCH_SIZE));
  }
  
  const translatedUtterances: Utterance[] = [];
  
  for (const batch of batches) {
    console.log(`Translating batch of ${batch.length} utterances...`);
    
    const textToTranslate = batch.map((utterance, index) => 
      `${index + 1}. ${utterance.text}`
    ).join('\n');
    
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator. Translate the following numbered text segments to English. Maintain the same numbering format. If the text is already in English, return it as-is. Preserve the natural flow and meaning.'
            },
            {
              role: 'user',
              content: textToTranslate
            }
          ],
          temperature: 0.3,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status}`);
      }
      
      const data = await response.json();
      const translatedText = data.choices[0]?.message?.content || '';
      
      // Parse the numbered translations back
      const translations = translatedText
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim());
      
      // Add translations to utterances
      batch.forEach((utterance, index) => {
        translatedUtterances.push({
          ...utterance,
          translation: translations[index] || utterance.text
        });
      });
      
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback: add utterances without translation
      translatedUtterances.push(...batch);
    }
    
    // Rate limiting - wait between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return translatedUtterances;
}