import { downloadLatestMp3 } from '../lib/podcast';
import { transcribeAudioWithGladia } from '../lib/gladia';
import * as fs from 'fs';
import * as path from 'path';
import { TranscriptionData } from '../lib/types';

async function main() {
  const apiKey = process.env.GLADIA_API_KEY;
  const rssUrl = process.env.RSS_URL || "https://www.omnycontent.com/d/playlist/5978613f-cd11-4352-8f26-adb900fa9a58/3c1222e5-288f-4047-a2f0-ae1b00a91688/a0389eb5-55da-493d-b7bb-ae1b00d0d95a/podcast.rss";
  
  if (!apiKey) {
    console.error("GLADIA_API_KEY not found in environment variables");
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
  
  // Download latest podcast
  console.log("Downloading latest podcast...");
  const mp3Path = await downloadLatestMp3(rssUrl, audioDir);
  
  if (!mp3Path) {
    console.error("Failed to download MP3");
    process.exit(1);
  }
  
  // Transcribe the audio
  console.log("Transcribing audio...");
  const transcriptionResult = await transcribeAudioWithGladia(mp3Path, apiKey);
  
  if (!transcriptionResult) {
    console.error("Failed to transcribe audio");
    process.exit(1);
  }
  
  // Extract data from transcription result
  const result = transcriptionResult.result || transcriptionResult;
  const metadata = result.metadata || {};
  const transcription = result.transcription || {};
  const utterances = transcription.utterances || [];
  
  // Read episode metadata
  const dateStr = today.toISOString().split('T')[0];
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