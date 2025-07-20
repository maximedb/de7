import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as xml2js from 'xml2js';

interface RSSItem {
  title: string;
  pubDate: string;
  'media:content': Array<{
    $: {
      url: string;
      type: string;
    };
  }>;
  guid: Array<{ _: string }>;
}

interface TranscriptionData {
  title: string;
  date: string;
  audioUrl?: string;
  [key: string]: any;
}

const RSS_URL = process.env.RSS_URL || "https://www.omnycontent.com/d/playlist/5978613f-cd11-4352-8f26-adb900fa9a58/3c1222e5-288f-4047-a2f0-ae1b00a91688/a0389eb5-55da-493d-b7bb-ae1b00d0d95a/podcast.rss";

async function fetchAllRSSItems(): Promise<RSSItem[]> {
  const allItems: RSSItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`Fetching RSS page ${page}...`);
      const response = await axios.get(`${RSS_URL}?page=${page}`);
      
      if (response.status !== 200) {
        console.error(`Failed to fetch RSS page ${page}. Status: ${response.status}`);
        break;
      }

      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(response.data);
      const channel = parsed.rss?.channel?.[0];
      
      if (!channel?.item || channel.item.length === 0) {
        console.log(`No items found on page ${page}. Stopping.`);
        hasMore = false;
        break;
      }

      allItems.push(...channel.item);
      
      // Check if there's a next page link
      const atomLinks = channel['atom:link'] || [];
      const nextLink = atomLinks.find((link: any) => link.$.rel === 'next');
      
      if (!nextLink) {
        console.log(`No next page found after page ${page}. Stopping.`);
        hasMore = false;
      } else {
        page++;
        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`Error fetching RSS page ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`Fetched ${allItems.length} total RSS items from ${page - 1} pages`);
  return allItems;
}

function parseDate(dateString: string): string {
  // Parse RSS pubDate format (e.g., "Thu, 17 Jul 2025 04:57:48 +0000")
  // and convert to YYYY-MM-DD format
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function findAudioUrl(item: RSSItem): string | null {
  // Look for audio/mpeg media content
  const mediaContent = item['media:content']?.find(content => 
    content.$.type === 'audio/mpeg'
  );
  
  return mediaContent?.$.url || null;
}

async function backfillAudioUrls(): Promise<void> {
  console.log('Starting audio URL backfill process...');
  
  // Fetch all RSS items
  const rssItems = await fetchAllRSSItems();
  
  // Create a map of date -> { audioUrl, title }
  const episodeDataMap = new Map<string, { audioUrl: string; title: string }>();
  
  for (const item of rssItems) {
    const date = parseDate(item.pubDate[0]);
    const audioUrl = findAudioUrl(item);
    const title = item.title?.[0] || item.title || '';
    
    if (audioUrl && title) {
      episodeDataMap.set(date, { audioUrl, title });
      console.log(`Found episode data for ${date}: ${title} - ${audioUrl}`);
    }
  }
  
  console.log(`Created episode data map for ${episodeDataMap.size} dates`);
  
  // Find all transcription files that need updating
  const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
  const dataDir = path.join(process.cwd(), 'public', 'data');
  
  if (!fs.existsSync(transcriptionsDir)) {
    console.error('Transcriptions directory not found:', transcriptionsDir);
    return;
  }
  
  const transcriptionFiles = fs.readdirSync(transcriptionsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(transcriptionsDir, file));
  
  console.log(`Found ${transcriptionFiles.length} transcription files to check`);
  
  let updatedCount = 0;
  
  // Process each transcription file
  for (const filePath of transcriptionFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: TranscriptionData = JSON.parse(content);
      
      // Skip if already has both audioUrl and title
      if (data.audioUrl && data.title) {
        console.log(`Skipping ${path.basename(filePath)} - already has audioUrl and title`);
        continue;
      }
      
      // Extract date from filename or data
      const dateFromFile = path.basename(filePath, '.json');
      const dateToMatch = data.date || dateFromFile;
      
      // Find matching episode data
      const episodeData = episodeDataMap.get(dateToMatch);
      
      if (episodeData) {
        let updated = false;
        if (!data.audioUrl) {
          data.audioUrl = episodeData.audioUrl;
          updated = true;
        }
        if (!data.title) {
          data.title = episodeData.title;
          updated = true;
        }
        
        if (updated) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log(`✅ Updated ${path.basename(filePath)} with title: ${episodeData.title} and audioUrl: ${episodeData.audioUrl}`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️  No episode data found for ${path.basename(filePath)} (date: ${dateToMatch})`);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message);
    }
  }
  
  // Also check and update data files
  const dataFiles = ['latest.json', 'full-transcription.json'];
  
  for (const dataFile of dataFiles) {
    const dataFilePath = path.join(dataDir, dataFile);
    
    if (fs.existsSync(dataFilePath)) {
      try {
        const content = fs.readFileSync(dataFilePath, 'utf-8');
        const data: TranscriptionData = JSON.parse(content);
        
        if ((!data.audioUrl || !data.title) && data.date) {
          const episodeData = episodeDataMap.get(data.date);
          if (episodeData) {
            let updated = false;
            if (!data.audioUrl) {
              data.audioUrl = episodeData.audioUrl;
              updated = true;
            }
            if (!data.title) {
              data.title = episodeData.title;
              updated = true;
            }
            
            if (updated) {
              fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
              console.log(`✅ Updated ${dataFile} with title: ${episodeData.title} and audioUrl: ${episodeData.audioUrl}`);
              updatedCount++;
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${dataFile}:`, error.message);
      }
    }
  }
  
  console.log(`\n🎉 Backfill complete! Updated ${updatedCount} files with titles and audio URLs.`);
}

// Run the script
if (require.main === module) {
  backfillAudioUrls().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { backfillAudioUrls };