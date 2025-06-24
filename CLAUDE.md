# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build Next.js app only (no transcription generation)
- `npm run build:full` - Generate transcription AND build Next.js app
- `npm run generate-transcription` - Run transcription script only
- `npm start` - Start production server

## Architecture Overview

This is a Next.js podcast transcription app that automatically downloads daily podcasts, transcribes them using Gladia API, displays them in a Spotify-style interface, and tracks user word interactions via Supabase.

### Core Components
- **TranscriptionPlayer**: Main UI component with audio player, synchronized lyrics display, and word click tracking
- **Transcription Pipeline**: `scripts/generate-transcription.ts` orchestrates download → transcription → translation → data processing
- **Gladia Integration**: `lib/gladia.ts` handles API upload, transcription requests, and result polling
- **OpenAI Integration**: `lib/openai.ts` translates Dutch utterances to English
- **Podcast Download**: `lib/podcast.ts` downloads MP3s from RSS feeds
- **Database Layer**: `lib/db.ts` manages Supabase word click tracking
- **User Identification**: `lib/userId.ts` generates and persists anonymous user IDs

### Data Flow
1. RSS feed → download MP3 + metadata → `public/audio/`
2. MP3 → Gladia API → raw transcription → `public/transcriptions/YYYY-MM-DD.json`
3. Raw transcription → OpenAI translation → processed data → `public/data/latest.json`
4. Next.js static generation reads latest.json for homepage
5. User word clicks → API endpoint → Supabase database storage

### Database Integration
- **Database**: Supabase PostgreSQL with `word_clicks` table
- **Word Tracking**: Anonymous users, tracks clicked words with context (transcript_id, utterance_id, full utterance)
- **User IDs**: Browser-generated persistent IDs stored in localStorage
- **API**: POST `/api/word-clicks` endpoint for fire-and-forget tracking

### File Structure
- Raw transcriptions: `public/transcriptions/YYYY-MM-DD.json`
- Audio files and metadata: `public/audio/YYYY-MM-DD.*`
- Processed frontend data: `public/data/latest.json`
- Types: `lib/types.ts` (Word, Utterance, TranscriptionData)
- Database: `lib/db.ts` (WordClick interface, Supabase client)

### Environment Variables
- `GLADIA_API_KEY` - Required for transcription API
- `OPENAI_API_KEY` - Required for translation service
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for server-side operations
- `RSS_URL` - Optional podcast RSS feed (has default)

### Database Setup
Create `word_clicks` table in Supabase with schema:
```sql
CREATE TABLE word_clicks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  transcript_id TEXT NOT NULL,
  utterance_id INTEGER NOT NULL,
  utterance TEXT NOT NULL,
  word TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Deployment
GitHub Actions runs weekdays at 8 AM UTC to auto-generate transcriptions and deploy to GitHub Pages.