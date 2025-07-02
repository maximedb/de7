import { Utterance } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface BatchRequest {
  custom_id: string;
  body: {
    model: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
    temperature: number;
    max_tokens: number;
  };
}

interface BatchResponse {
  custom_id: string;
  response: {
    body: {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };
  };
}

async function uploadBatchFile(filePath: string, apiKey: string): Promise<string> {
  // Verify file exists and read content
  if (!fs.existsSync(filePath)) {
    throw new Error(`Batch file does not exist: ${filePath}`);
  }
  
  console.log(`File size: ${fs.statSync(filePath).size} bytes`);
  
  const axios = require('axios');
  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('purpose', 'batch');
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: 'application/x-ndjson'
  });
  
  try {
    const response = await axios.post('https://api.mistral.ai/v1/files', form, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
    });
    
    console.log('Upload successful, file ID:', response.data.id);
    return response.data.id;
  } catch (error: any) {
    if (error.response) {
      console.error('Upload error response:', error.response.data);
      throw new Error(`Failed to upload batch file: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error('Upload error:', error.message);
      throw error;
    }
  }
}

async function createBatchJob(fileId: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.mistral.ai/v1/batch/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_files: [fileId],
      model: 'mistral-small-latest',
      endpoint: '/v1/chat/completions',
      metadata: {
        description: 'Podcast transcription translation batch'
      }
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create batch job: ${response.status}`);
  }
  
  const data = await response.json();
  return data.id;
}

async function pollBatchJob(jobId: string, apiKey: string): Promise<any> {
  console.log(`Polling batch job ${jobId}...`);
  
  while (true) {
    const response = await fetch(`https://api.mistral.ai/v1/batch/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to poll batch job: ${response.status}`);
    }
    
    const job = await response.json();
    console.log(`Batch job status: ${job.status}`);
    
    if (job.status === 'SUCCESS' || job.status === 'completed') {
      return job;
    } else if (job.status === 'FAILED' || job.status === 'failed' || job.status === 'EXPIRED' || job.status === 'expired') {
      throw new Error(`Batch job ${job.status}: ${job.error_message || 'Unknown error'}`);
    }
    
    // Wait 30 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

async function downloadBatchResults(fileId: string, apiKey: string): Promise<BatchResponse[]> {
  const response = await fetch(`https://api.mistral.ai/v1/files/${fileId}/content`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download batch results: ${response.status}`);
  }
  
  const content = await response.text();
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function createBatchRequests(utterances: Utterance[], language: 'English' | 'French'): BatchRequest[] {
  return utterances.map((utterance, index) => ({
    custom_id: `${language.toLowerCase()}_${index}`,
    body: {
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text to ${language}. If the text is already in ${language}, return it as-is. Preserve the natural flow and meaning. Return only the translation without any additional text or formatting.`
        },
        {
          role: 'user',
          content: utterance.text
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    }
  }));
}

export async function translateUtterances(utterances: Utterance[], apiKey: string): Promise<Utterance[]> {
  console.log(`Starting batch translation for ${utterances.length} utterances...`);
  
  // Create temporary batch file in OS temp directory
  const tempDir = os.tmpdir();
  const batchFilePath = path.join(tempDir, `mistral_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jsonl`);
  
  try {
    // Create batch requests for both languages
    const englishRequests = createBatchRequests(utterances, 'English');
    const frenchRequests = createBatchRequests(utterances, 'French');
    const allRequests = [...englishRequests, ...frenchRequests];
    const batchContent = allRequests
      .map(request => JSON.stringify(request))
      .join('\n');
    
    fs.writeFileSync(batchFilePath, batchContent);
    console.log(`Created batch file with ${allRequests.length} requests`);
    console.log(`Batch file path: ${batchFilePath}`);
    console.log(`First few lines of batch file:`, batchContent.split('\n').slice(0, 2).join('\n'));
    
    // Upload batch file
    console.log('Uploading batch file...');
    const fileId = await uploadBatchFile(batchFilePath, apiKey);
    console.log(`Uploaded batch file: ${fileId}`);
    
    // Create batch job
    console.log('Creating batch job...');
    const jobId = await createBatchJob(fileId, apiKey);
    console.log(`Created batch job: ${jobId}`);
    
    // Poll for completion
    const completedJob = await pollBatchJob(jobId, apiKey);
    console.log('Batch job completed!');
    
    // Download results
    console.log('Downloading results...');
    const results = await downloadBatchResults(completedJob.output_file, apiKey);
    console.log(`Downloaded ${results.length} results`);
    
    // Process results
    const translationMap = new Map<string, string>();
    results.forEach(result => {
      const translation = result.response.body.choices[0]?.message?.content || '';
      translationMap.set(result.custom_id, translation);
    });
    
    // Apply translations to utterances
    const translatedUtterances = utterances.map((utterance, index) => {
      const englishKey = `english_${index}`;
      const frenchKey = `french_${index}`;
      
      return {
        ...utterance,
        translations: {
          en: translationMap.get(englishKey) || utterance.text,
          fr: translationMap.get(frenchKey) || utterance.text
        }
      };
    });
    
    // Cleanup
    try {
      fs.unlinkSync(batchFilePath);
      console.log('Cleaned up temporary batch file');
    } catch (cleanupError) {
      console.warn('Failed to cleanup batch file:', cleanupError);
    }
    console.log('Translation batch processing completed successfully');
    
    return translatedUtterances;
    
  } catch (error) {
    console.error('Batch translation error:', error);
    
    // Cleanup on error
    try {
      if (fs.existsSync(batchFilePath)) {
        fs.unlinkSync(batchFilePath);
        console.log('Cleaned up temporary batch file after error');
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup batch file after error:', cleanupError);
    }
    
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