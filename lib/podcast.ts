import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';

export async function downloadLatestMp3(rssUrl: string, outputDirectory: string): Promise<string | null> {
  try {
    const response = await axios.get(rssUrl);
    if (response.status !== 200) {
      console.error(`Failed to fetch RSS feed. Status code: ${response.status}`);
      return null;
    }
    
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(response.data);
    const channel = parsed.rss?.channel?.[0];
    
    if (!channel) {
      console.error("No channel found in RSS feed");
      return null;
    }
    
    const item = channel.item?.[0];
    if (!item) {
      console.error("No items found in RSS feed");
      return null;
    }
    
    // Get title for metadata
    const title = item.title?.[0] || "Untitled Episode";
    
    // Extract MP3 URL from media:content
    const mediaContent = item['media:content']?.find((content: any) => 
      content.$?.type === 'audio/mpeg'
    );
    
    if (!mediaContent) {
      console.error("No media:content with audio/mpeg type found");
      return null;
    }
    
    const mp3Url = mediaContent.$.url;
    if (!mp3Url) {
      console.error("No URL found in media:content");
      return null;
    }
    
    // Create output directory if it doesn't exist
    fs.mkdirSync(outputDirectory, { recursive: true });
    
    // Generate filename based on date
    const today = new Date().toISOString().split('T')[0];
    const filename = `${today}.mp3`;
    const filepath = path.join(outputDirectory, filename);
    
    // Download the MP3 file
    console.log(`Downloading MP3 from ${mp3Url}...`);
    const mp3Response = await axios.get(mp3Url, { responseType: 'arraybuffer' });
    
    if (mp3Response.status === 200) {
      fs.writeFileSync(filepath, mp3Response.data);
      console.log(`Downloaded MP3 to ${filepath}`);
      
      // Save metadata
      const metadataPath = path.join(outputDirectory, `${today}-metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({ title, date: today }, null, 2));
      
      return filepath;
    } else {
      console.error(`Failed to download MP3. Status code: ${mp3Response.status}`);
      return null;
    }
  } catch (error: any) {
    console.error(`Error downloading MP3: ${error.message}`);
    return null;
  }
}