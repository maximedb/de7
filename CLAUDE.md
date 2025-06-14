# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Generate transcription and build Next.js app
- `npm run generate-transcription` - Run transcription script only
- `npm start` - Start production server

## Architecture Overview

This is a Next.js podcast transcription app that automatically downloads daily podcasts, transcribes them using Gladia API, and displays them in a Spotify-style interface.

### Core Components
- **TranscriptionPlayer**: Main UI component with audio player and synchronized lyrics display
- **Transcription Pipeline**: `scripts/generate-transcription.ts` orchestrates download → transcription → data processing
- **Gladia Integration**: `lib/gladia.ts` handles API upload, transcription requests, and result polling
- **Podcast Download**: `lib/podcast.ts` downloads MP3s from RSS feeds

### Data Flow
1. RSS feed → download MP3 + metadata → `public/audio/`
2. MP3 → Gladia API → transcription results → `public/transcriptions/`
3. Processed data → `public/data/latest.json` (consumed by frontend)
4. Next.js static generation reads latest.json for homepage

### File Structure
- Transcriptions saved as raw JSON in `public/transcriptions/YYYY-MM-DD.json`
- Audio files and metadata in `public/audio/`
- Frontend data in `public/data/latest.json`
- Types defined in `lib/types.ts` (Word, Utterance, TranscriptionData)

### Environment Variables
- `GLADIA_API_KEY` - Required for transcription API
- `RSS_URL` - Optional podcast RSS feed (defaults to specific feed)

### Deployment
GitHub Actions runs weekdays at 8 AM UTC to auto-generate transcriptions and deploy to GitHub Pages.