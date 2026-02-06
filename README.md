# Feeds

A fast, reliable, private self-hosted feed reader supporting RSS/Atom, YouTube, Reddit, and Podcasts.

![Feeds](https://img.shields.io/badge/Self--Hosted-Private-green) ![Docker](https://img.shields.io/badge/Docker-Ready-blue) ![Tests](https://img.shields.io/badge/Tests-161%20passing-success) ![Coverage](https://img.shields.io/badge/Coverage-35.75%25-yellow)

## Features

- 📰 **RSS/Atom feeds** - Standard web feed support
- 📺 **YouTube channels** - Subscribe to YouTube content via RSS
- 🎙️ **Podcasts** - Full podcast support with audio player
- 🔍 **Full-text search** - Search across all articles (FTS5)
- 📁 **Folders** - Organize feeds by folder
- 📱 **PWA** - Install as an app on mobile
- 🔄 **Background sync** - Automatic feed updates
- 📖 **Reader mode** - Clean article view using Mozilla Readability
- 🌙 **Dark theme** - Easy on the eyes
- 📤 **OPML import/export** - Migrate from other readers
- 🔐 **Password protection** - Secure your instance with JWT auth

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/greg-hass/Feeds.git
cd Feeds

# Create environment file
cp .env.example .env

# Edit .env and set required variables (see Configuration section below)
nano .env

# Start with Docker Compose
docker-compose up -d
```

Access at `http://localhost:3080`

### Using Pre-built Image

```bash
docker run -d \
  --name feeds \
  -p 3080:80 \
  -v feeds_data:/data \
  -e JWT_SECRET=your-secret-key-min-32-characters \
  -e APP_PASSWORD=your-admin-password \
  ghcr.io/greg-hass/feeds:latest
```

## Configuration

Create a `.env` file with these variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret key for authentication (min 32 chars) |
| `APP_PASSWORD` | **Yes** | Password for first-time setup |
| `CORS_ORIGIN` | Production | Your domain (e.g., `https://feeds.yourdomain.com`) |
| `GEMINI_API_KEY` | No | Google AI key for feed discovery |
| `YOUTUBE_API_KEY` | No | YouTube Data API key (improves channel info) |
| `LOG_LEVEL` | No | debug, info, warn, error (default: info) |

### Generating JWT_SECRET

```bash
# Option 1: OpenSSL
openssl rand -base64 64

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## First Run

1. **Set environment variables** (see Configuration above)
2. **Start the app**: `docker-compose up -d`
3. **Open** `http://localhost:3080`
4. **Create password**: On first visit, you'll see a setup screen
5. **Login**: Use the password you just created

**Note:** The `APP_PASSWORD` env var is only needed for initial setup. After that, authentication uses the password you created.

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

## Data Persistence

Data is stored in a Docker volume:
- **Database**: `/data/feeds.db`
- **Icons**: `/data/icons/`
- **Thumbnails**: `/data/thumbnails/`
- **Backups**: `/data/backups/` (auto-created daily, 7 days retention)

### Backup & Restore

**Manual Backup:**
```bash
# Create backup
docker exec feeds cp /data/feeds.db /data/backups/feeds-manual-$(date +%Y%m%d).db

# Copy to host
docker cp feeds:/data/backups/feeds-manual-YYYYMMDD.db ./
```

**Restore from Backup:**
```bash
# Stop container
docker-compose down

# Restore database (replace YYYYMMDD with backup date)
docker cp ./feeds-backup-YYYYMMDD.db feeds:/data/feeds.db

# Start container
docker-compose up -d
```

**Automated Backups:**
The container automatically creates daily backups at `/data/backups/` with 7-day retention. To persist backups outside the container:
```yaml
# docker-compose.yml
volumes:
  - feeds_data:/data
  - ./backups:/data/backups  # Mount backups to host
```

## Troubleshooting

### "Authentication not configured" error
- Make sure `APP_PASSWORD` is set in your `.env`
- Restart container: `docker-compose restart`

### Cannot login / "Invalid password"
- Check that `JWT_SECRET` is set and hasn't changed
- If you changed JWT_SECRET, you'll need to login again (tokens are invalidated)

### Rate limited (429 error)
- Login is rate-limited: 5 attempts per 15 minutes per IP
- Wait 15 minutes or restart container to reset

### Port already in use
- Change the port in `docker-compose.yml`: `- "3081:80"`
- Access at `http://localhost:3081`

### Reset everything (⚠️ deletes all data)
```bash
docker-compose down -v  # Removes volume
docker-compose up -d    # Fresh start
```

## Security Features

- **Password hashing**: bcrypt with 12 rounds
- **JWT tokens**: 30-day sliding expiration (extends with use)
- **Rate limiting**: 5 login attempts per 15 minutes
- **Path traversal protection**: Validated file paths
- **SQL injection prevention**: Parameterized queries
- **XXE protection**: Disabled XML entity processing

## API Documentation

See [API.md](API.md) for full API documentation.

## Tech Stack

- **Backend**: Node.js, Fastify, SQLite (better-sqlite3)
- **Frontend**: React Native Web, Expo, Zustand
- **Deployment**: Docker, nginx
- **Search**: SQLite FTS5

## License

MIT
