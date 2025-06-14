# Podcast Transcription App

A Next.js application that automatically transcribes daily podcasts and displays them in a Spotify-style interface.

## Features

- Automatic daily podcast download (weekdays only)
- Transcription using Gladia API
- Spotify-style lyrics display interface
- Static site generation with GitHub Pages deployment
- Real-time word highlighting during playback

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your Gladia API key
4. Run locally: `npm run dev`

## GitHub Actions Setup

1. Go to your repository settings
2. Add the following secrets:
   - `GLADIA_API_KEY`: Your Gladia API key
   - `RSS_URL`: The podcast RSS feed URL (optional, defaults to provided URL)
3. Enable GitHub Pages in repository settings
4. The workflow will run automatically every weekday at 8 AM UTC

## Manual Build

To manually generate a transcription and build the site:

```bash
npm run build

test