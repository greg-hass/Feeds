# Feeds

A fast, reliable, private self-hosted feed reader supporting RSS/Atom, YouTube, Reddit*, and Podcasts.

![Feeds](https://img.shields.io/badge/Self--Hosted-Private-green) ![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## Features

- 📰 **RSS/Atom feeds** - Standard web feed support
- 📺 **YouTube channels & playlists** - Subscribe to YouTube content via RSS
- 🎙️ **Podcasts** - Full podcast support with audio player
- 🔍 **Full-text search** - Search across all articles
- 📁 **Folders & Smart Folders** - Organize feeds by folder or type
- 📱 **PWA** - Install as an app on mobile
- 🔄 **Background sync** - Automatic feed updates
- 📖 **Reader mode** - Clean article view using Mozilla Readability
- 🌙 **Dark theme** - Easy on the eyes
- 📤 **OPML import/export** - Migrate from other readers

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/greg-hass/Feeds.git
cd Feeds

# Create environment file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# Start with Docker Compose
docker-compose up -d
```

Access at `http://localhost:3000`

### Using Pre-built Image

```bash
docker run -d \
  --name feeds \
  -p 3000:80 \
  -v feeds_data:/data \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/greg-hass/feeds:latest
```

## First Run

1. Open the app in your browser
2. Create your admin account
3. Start adding feeds!

## Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run web
```

## API Documentation

See [API.md](API.md) for full API documentation.

## Tech Stack

- **Backend**: Node.js, Fastify, SQLite, feedparser
- **Frontend**: React Native Web, Expo, Zustand
- **Deployment**: Docker, nginx

## License

MIT

---

*Reddit support coming in v2
