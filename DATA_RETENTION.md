# Data Retention & Database Cleanup

## Problem
The Feeds application was accumulating articles indefinitely, causing the database to grow to **160GB+**. The `articles` table stores full article content (including `content` and `readability_content` TEXT fields), which can consume massive amounts of disk space over time.

## Solution
Implemented a comprehensive data retention system with:
- Configurable retention policies
- Automatic cleanup of old articles
- Database optimization and VACUUM support
- Preview before cleanup
- Protection for bookmarked and unread articles

## API Endpoints

### Get Database Statistics
```bash
GET /api/v1/maintenance/stats
```
Returns database size, article count, table sizes, and other metrics.

### Check Maintenance Status
```bash
GET /api/v1/maintenance/check
```
Returns fragmentation ratio and recommendations for optimization.

### Get Retention Settings
```bash
GET /api/v1/maintenance/retention
```
Returns current retention policy settings.

### Update Retention Settings
```bash
PUT /api/v1/maintenance/retention
Content-Type: application/json

{
  "enabled": true,
  "maxArticleAgeDays": 90,        // Keep articles for 90 days
  "maxArticlesPerFeed": 500,      // Keep max 500 articles per feed
  "keepStarred": true,            // Don't delete bookmarked articles
  "keepUnread": true              // Don't delete unread articles
}
```

### Preview Cleanup
```bash
GET /api/v1/maintenance/cleanup/preview
```
Shows how many articles would be deleted and estimated space savings without actually deleting anything.

### Run Cleanup
```bash
POST /api/v1/maintenance/cleanup
```
Executes the cleanup based on current retention settings. Returns:
```json
{
  "articlesDeleted": 125000,
  "bytesReclaimed": 85000000000,
  "durationMs": 45000
}
```

### Optimize Database
```bash
POST /api/v1/maintenance/optimize
```
Runs ANALYZE and REINDEX to optimize query performance.

### VACUUM Database
```bash
POST /api/v1/maintenance/vacuum
```
Runs VACUUM to defragment the database and reclaim disk space. **Warning**: This requires an exclusive lock and can take significant time on large databases.

## Default Settings
- **Enabled**: Yes
- **Max Article Age**: 90 days
- **Max Articles Per Feed**: 500
- **Keep Bookmarked**: Yes
- **Keep Unread**: Yes

## Recommended Usage

### Initial Cleanup (for 160GB database)
1. **Check current stats**:
   ```bash
   curl http://your-server/api/v1/maintenance/stats
   ```

2. **Preview what will be deleted**:
   ```bash
   curl http://your-server/api/v1/maintenance/cleanup/preview
   ```

3. **Adjust retention settings if needed** (e.g., keep only 30 days):
   ```bash
   curl -X PUT http://your-server/api/v1/maintenance/retention \
     -H "Content-Type: application/json" \
     -d '{"enabled":true,"maxArticleAgeDays":30,"maxArticlesPerFeed":200,"keepStarred":true,"keepUnread":true}'
   ```

4. **Run cleanup**:
   ```bash
   curl -X POST http://your-server/api/v1/maintenance/cleanup
   ```

5. **VACUUM to reclaim space**:
   ```bash
   curl -X POST http://your-server/api/v1/maintenance/vacuum
   ```

### Ongoing Maintenance
Consider setting up a cron job to run cleanup weekly:
```bash
# Every Sunday at 3 AM
0 3 * * 0 curl -X POST http://your-server/api/v1/maintenance/cleanup
```

## Important Notes
- **VACUUM requires exclusive database lock** - run during low-traffic periods
- **Bookmarked articles are always protected** (if keepStarred is true)
- **Unread articles are protected** (if keepUnread is true)
- **Cleanup is permanent** - preview first!
- **Space is not reclaimed until VACUUM runs**

## Monitoring
Check database health regularly:
```bash
curl http://your-server/api/v1/maintenance/check
```

If fragmentation > 20%, run VACUUM during a maintenance window.
