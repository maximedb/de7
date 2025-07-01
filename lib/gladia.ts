import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

export async function transcribeAudioWithGladia(audioPath: string, apiKey: string) {
  try {
    // Verify file exists and has content before attempting upload
    if (!fs.existsSync(audioPath)) {
      console.error(`Error: Audio file does not exist at ${audioPath}`);
      return null;
    }
    
    const fileSize = fs.statSync(audioPath).size;
    if (fileSize === 0) {
      console.error(`Error: Audio file is empty (0 bytes)`);
      return null;
    }
    
    console.log(`File verification successful. Size: ${fileSize} bytes`);
    
    // Step 1: Upload the file
    const uploadUrl = "https://api.gladia.io/v2/upload";
    
    const fileName = path.basename(audioPath);
    const fileStream = fs.createReadStream(audioPath);
    
    const formData = new FormData();
    formData.append('audio', fileStream, {
      filename: fileName,
      contentType: 'audio/mpeg'
    });
    
    console.log(`Uploading file ${fileName} to Gladia API...`);
    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'x-gladia-key': apiKey
      }
    });
    
    if (uploadResponse.status !== 200) {
      console.error(`Error uploading file: ${uploadResponse.data}`);
      return null;
    }
    
    const uploadResult = uploadResponse.data;
    console.log(`File uploaded successfully. Response:`, uploadResult);
    const audioUrl = uploadResult.audio_url;
    
    // Step 2: Request transcription
    const transcriptionUrl = "https://api.gladia.io/v2/pre-recorded";
    const transcriptionHeaders = {
      'Content-Type': 'application/json',
      'x-gladia-key': apiKey
    };
    
    const transcriptionPayload = {
      audio_url: audioUrl,
      diarization: true,
      detect_language: true,
      sentences: true
    };
    
    const transcriptionResponse = await axios.post(
      transcriptionUrl,
      transcriptionPayload,
      { headers: transcriptionHeaders }
    );
    
    console.log(`Transcription request status code: ${transcriptionResponse.status}`);
    
    if (![200, 201, 202].includes(transcriptionResponse.status)) {
      console.error(`Error requesting transcription: ${transcriptionResponse.data}`);
      return null;
    }
    
    const transcriptionResult = transcriptionResponse.data;
    
    if (!transcriptionResult.id || !transcriptionResult.result_url) {
      console.error(`Invalid response format. Missing required fields:`, transcriptionResult);
      return null;
    }
    
    console.log(`Transcription job created successfully. ID: ${transcriptionResult.id}`);
    const resultUrl = transcriptionResult.result_url;
    
    // Step 3: Poll for results
    const maxRetries = 60;
    for (let i = 0; i < maxRetries; i++) {
      console.log(`Polling for results (attempt ${i + 1}/${maxRetries})...`);
      const resultResponse = await axios.get(resultUrl, { headers: { 'x-gladia-key': apiKey } });
      
      if (resultResponse.status === 200) {
        const result = resultResponse.data;
        console.log(`Response status: ${result.status}`);
        
        if (result.status === 'done') {
          // Save raw JSON result for reference
          const transcriptionsDir = path.join(process.cwd(), 'public', 'transcriptions');
          fs.mkdirSync(transcriptionsDir, { recursive: true });
          const today = new Date().toISOString().split('T')[0];
          const jsonPath = path.join(transcriptionsDir, `${today}.json`);
          fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
          
          return result;
        } else if (result.status === 'error') {
          console.error(`Transcription failed with error: ${result.error_code}`);
          console.error(`Error details: ${result.error_message || 'No details provided'}`);
          return null;
        }
      } else {
        console.error(`Error polling for results: Status ${resultResponse.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    console.error("Transcription timed out");
    return null;
    
  } catch (error: any) {
    console.error(`Error transcribing audio: ${error.message}`);
    return null;
  }
}