import { downloadLatestMp3 } from '../lib/podcast';
import { transcribeAudioWithGladia } from '../lib/gladia';
import { translateUtterances } from '../lib/openai';
import * as fs from 'fs';
import * as path from 'path';
import { TranscriptionData } from '../lib/types';

async function main() {
  const gladiaApiKey = process.env.GLADIA_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const rssUrl = process.env.RSS_URL || "https://www.omnycontent.com/d/playlist/5978613f-cd11-4352-8f26-adb900fa9a58/3c1222e5-288f-4047-a2f0-ae1b00a91688/a0389eb5-55da-493d-b7bb-ae1b00d0d95a/podcast.rss";
  
  if (!gladiaApiKey) {
    console.error("GLADIA_API_KEY not found in environment variables");
    process.exit(1);
  }
  
  if (!openaiApiKey) {
    console.error("OPENAI_API_KEY not found in environment variables");
    process.exit(1);
  }
  
  // Only run on weekdays
  const today = new Date();
//   const dayOfWeek = today.getDay();
//   if (dayOfWeek === 0 || dayOfWeek === 6) {
//     console.log("Skipping weekend day");
//     return;
//   }
  
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
  
  // Download latest podcast
  console.log("Downloading latest podcast...");
  const mp3Path = await downloadLatestMp3(rssUrl, audioDir);
  
  if (!mp3Path) {
    console.error("Failed to download MP3");
    process.exit(1);
  }
  
  // Check if transcription already exists
  const dateStr = today.toISOString().split('T')[0];
  const transcriptionPath = path.join(transcriptionsDir, `${dateStr}.json`);
  
  let transcriptionResult;
  if (fs.existsSync(transcriptionPath)) {
    console.log("Transcription already exists, loading from file...");
    transcriptionResult = JSON.parse(fs.readFileSync(transcriptionPath, 'utf-8'));
  } else {
    // Transcribe the audio
    console.log("Transcribing audio...");
    transcriptionResult = await transcribeAudioWithGladia(mp3Path, gladiaApiKey);
    
    if (!transcriptionResult) {
      console.error("Failed to transcribe audio");
      process.exit(1);
    }
    
    // Save raw transcription result
    fs.mkdirSync(transcriptionsDir, { recursive: true });
    fs.writeFileSync(transcriptionPath, JSON.stringify(transcriptionResult, null, 2));
    console.log("Raw transcription saved to", transcriptionPath);
  }
  
  // Extract data from transcription result
  const result = transcriptionResult.result || transcriptionResult;
  const metadata = result.metadata || {};
  const transcription = result.transcription || {};
  let utterances = transcription.utterances || [];
  
  // Check if we need to translate utterances
  const hasTranslations = utterances.some((u: any) => u.translation);
  if (!hasTranslations && utterances.length > 0) {
    console.log("Translating utterances to English...");
    utterances = await translateUtterances(utterances, openaiApiKey);
    
    // Update the transcription file with translations
    const updatedResult = {
      ...transcriptionResult,
      result: {
        ...result,
        transcription: {
          ...transcription,
          utterances
        }
      }
    };
    fs.writeFileSync(transcriptionPath, JSON.stringify(updatedResult, null, 2));
    console.log("Updated transcription with translations");
  }
  
  // Read episode metadata
  const metadataPath = path.join(audioDir, `${dateStr}-metadata.json`);
  const episodeMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  
  // Prepare data for the frontend
  const data: TranscriptionData = {
    title: episodeMetadata.title,
    date: dateStr,
    duration: metadata.audio_duration || 0,
    utterances: utterances,
    audioUrl: `/audio/${dateStr}.mp3`
  };
  
  // Save processed data
  fs.mkdirSync(dataDir, { recursive: true });
  const dataPath = path.join(dataDir, 'latest.json');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log("Transcription complete and saved to", dataPath);
}

main().catch(console.error);