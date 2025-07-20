import { GetServerSideProps } from 'next';
import * as fs from 'fs';
import * as path from 'path';

export default function Home() {
  return null; // This page will never render due to redirect
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Find the latest available date
    const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
    
    if (fs.existsSync(transcriptionsDir)) {
      const files = fs.readdirSync(transcriptionsDir);
      const dates = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (dates.length > 0) {
        const latestDate = dates[0];
        return {
          redirect: {
            destination: `/${latestDate}`,
            permanent: false
          }
        };
      }
    }
  } catch (error) {
    console.error('Error finding latest transcription:', error);
  }
  
  // If no transcriptions found, redirect to a 404-like page
  return {
    redirect: {
      destination: '/404',
      permanent: false
    }
  };
};