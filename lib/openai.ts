import { Utterance } from './types';

async function translateToLanguage(utterances: Utterance[], targetLanguage: 'English' | 'French', apiKey: string): Promise<string[]> {
  console.log(`Translating ${utterances.length} utterances to ${targetLanguage}...`);
  
  // Process in concurrent batches for speed
  const BATCH_SIZE = 20; // Larger batch for fewer API calls
  const CONCURRENT_BATCHES = 5; // Process multiple batches concurrently
  
  const results: string[] = new Array(utterances.length);
  
  for (let i = 0; i < utterances.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
    const batchPromises: Promise<void>[] = [];
    
    for (let j = 0; j < CONCURRENT_BATCHES; j++) {
      const startIdx = i + (j * BATCH_SIZE);
      const endIdx = Math.min(startIdx + BATCH_SIZE, utterances.length);
      
      if (startIdx >= utterances.length) break;
      
      const batch = utterances.slice(startIdx, endIdx);
      const batchPromise = translateBatch(batch, targetLanguage, apiKey, startIdx)
        .then(translations => {
          // Store results in correct positions
          translations.forEach((translation, idx) => {
            results[startIdx + idx] = translation;
          });
        });
      
      batchPromises.push(batchPromise);
    }
    
    // Wait for all concurrent batches to complete
    await Promise.all(batchPromises);
    
    // Small delay to avoid rate limits
    if (i + BATCH_SIZE * CONCURRENT_BATCHES < utterances.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

async function translateBatch(utterances: Utterance[], targetLanguage: 'English' | 'French', apiKey: string, batchStartIdx: number): Promise<string[]> {
  const textToTranslate = utterances
    .map((utterance, index) => `${index + 1}. ${utterance.text}`)
    .join('\n');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following numbered text segments to ${targetLanguage}. Maintain the same numbering format. If the text is already in ${targetLanguage}, return it as-is. Preserve the natural flow and meaning.`
          },
          {
            role: 'user',
            content: textToTranslate
          }
        ],
        temperature: 0.3,
        max_tokens: utterances.length * 50, // Dynamic based on batch size
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Translation error for batch ${batchStartIdx}:`, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content || '';
    
    // Parse the numbered translations back
    const translations = translatedText
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim());
    
    // Ensure we have the right number of translations
    const result = utterances.map((utterance, index) => 
      translations[index] || utterance.text
    );
    
    return result;
    
  } catch (error) {
    console.error(`Translation error for batch ${batchStartIdx}:`, error);
    // Fallback: return original text
    return utterances.map(utterance => utterance.text);
  }
}

export async function translateUtterances(utterances: Utterance[], apiKey: string): Promise<Utterance[]> {
  console.log(`Starting fast concurrent translation for ${utterances.length} utterances...`);
  const startTime = Date.now();
  
  try {
    // Get both English and French translations concurrently
    const [englishTranslations, frenchTranslations] = await Promise.all([
      translateToLanguage(utterances, 'English', apiKey),
      translateToLanguage(utterances, 'French', apiKey)
    ]);
    
    // Apply translations to utterances
    const translatedUtterances = utterances.map((utterance, index) => ({
      ...utterance,
      translations: {
        en: englishTranslations[index] || utterance.text,
        fr: frenchTranslations[index] || utterance.text
      }
    }));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Translation completed in ${duration}s`);
    
    return translatedUtterances;
    
  } catch (error) {
    console.error('Translation error:', error);
    
    // Fallback: return utterances without translations
    return utterances.map(utterance => ({
      ...utterance,
      translations: {
        en: utterance.text,
        fr: utterance.text
      }
    }));
  }
}