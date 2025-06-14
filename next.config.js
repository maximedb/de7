/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/podcast-transcription-app' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/podcast-transcription-app' : '',
}

module.exports = nextConfig