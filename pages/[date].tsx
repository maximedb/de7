import { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import TranscriptionPlayer from '@/components/TranscriptionPlayer';
import { TranscriptionData } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

interface DatePageProps {
  data: TranscriptionData | null;
  date: string;
  availableDates: string[];
}

export default function DatePage({ data, date, availableDates }: DatePageProps) {
  if (!data) {
    return (
      <div className="h-screen bg-gradient-to-b from-teal-900 to-teal-700 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Transcription Available</h1>
          <p className="text-gray-300">No transcription found for {date}</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>{data.title} - {date} - Daily Podcast Transcription</title>
        <meta name="description" content={`Daily podcast transcription for ${date} with Spotify-style interface`} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#134e4a" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <TranscriptionPlayer data={data} currentDate={date} availableDates={availableDates} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
  
  let paths: { params: { date: string } }[] = [];
  
  try {
    if (fs.existsSync(transcriptionsDir)) {
      const files = fs.readdirSync(transcriptionsDir);
      paths = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          params: { date: file.replace('.json', '') }
        }));
    }
  } catch (error) {
    console.error('Error reading transcriptions directory:', error);
  }
  
  return {
    paths,
    fallback: false
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const date = params?.date as string;
  
  try {
    // Get available dates for dropdown
    const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
    let availableDates: string[] = [];
    
    if (fs.existsSync(transcriptionsDir)) {
      const files = fs.readdirSync(transcriptionsDir);
      availableDates = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort by date desc
    }
    
    // Load raw transcription data
    const transcriptionPath = path.join(process.cwd(), 'public', 'transcriptions', `${date}.json`);
    if (fs.existsSync(transcriptionPath)) {
      const rawData = JSON.parse(fs.readFileSync(transcriptionPath, 'utf-8'));
      
      // Handle Gladia API response format
      const transcriptionResult = rawData.result || rawData;
      const utterances = transcriptionResult.transcription?.utterances || [];
      const duration = rawData.file?.audio_duration || transcriptionResult.metadata?.audio_duration || 0;
      
      // Convert raw transcription to TranscriptionData format
      const data: TranscriptionData = {
        title: rawData.title || `Podcast - ${date}`,
        date,
        audioUrl: rawData.audioUrl || `/audio/${date}.mp3`, // Use audioUrl from data, fallback to local path
        duration,
        utterances
      };
      
      return {
        props: {
          data,
          date,
          availableDates
        }
      };
    }
  } catch (error) {
    console.error(`Error loading transcription data for ${date}:`, error);
  }
  
  return {
    props: {
      data: null,
      date,
      availableDates: []
    }
  };
};