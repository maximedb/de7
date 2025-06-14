import { GetStaticProps } from 'next';
import Head from 'next/head';
import TranscriptionPlayer from '@/components/TranscriptionPlayer';
import { TranscriptionData } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

interface HomeProps {
  data: TranscriptionData | null;
}

export default function Home({ data }: HomeProps) {
  if (!data) {
    return (
      <div className="h-screen bg-gradient-to-b from-teal-900 to-teal-700 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Transcription Available</h1>
          <p className="text-gray-300">Please check back later</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>{data.title} - Daily Podcast Transcription</title>
        <meta name="description" content="Daily podcast transcription with Spotify-style interface" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <TranscriptionPlayer data={data} />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'latest.json');
    
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      return {
        props: {
          data
        },
        revalidate: 3600 // Revalidate every hour
      };
    }
  } catch (error) {
    console.error('Error loading transcription data:', error);
  }
  
  return {
    props: {
      data: null
    }
  };
};