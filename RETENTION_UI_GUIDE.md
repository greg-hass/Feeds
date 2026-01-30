# Accessing Data Retention Settings

## Frontend UI

The data retention settings are now available in the frontend app at:

```
/data-retention
```

Navigate to this route to:
- View current database statistics (size, article count, feed count)
- Configure retention policies
- Preview cleanup impact before running it
- Manually trigger cleanup

## Features

### Database Statistics
- Total database size in GB
- Total article count
- Number of active feeds

### Retention Policy Configuration
- **Enable/Disable automatic cleanup**
- **Maximum Article Age**: Set how many days to keep articles (default: 14 days)
- **Maximum Articles Per Feed**: Set max articles to keep per feed (default: 500)
- **Keep Bookmarked Articles**: Toggle to protect bookmarks (default: ON - bookmarks kept indefinitely)
- **Keep Unread Articles**: Toggle to protect unread articles (default: ON)

### Cleanup Preview
Before running cleanup, see:
- Number of articles that will be deleted
- Estimated space savings in GB
- Date of oldest article to be deleted

### Manual Cleanup
- One-click cleanup execution
- Real-time progress feedback
- Results showing articles deleted and space reclaimed

## Integration

To add a link to this screen in your app navigation, add:

```tsx
<Link href="/data-retention">Data Retention</Link>
```

Or navigate programmatically:

```tsx
router.push('/data-retention');
```

## Default Behavior

With the default settings (14 days, keep bookmarks, keep unread):
- Articles older than 14 days will be deleted
- Bookmarked articles are NEVER deleted (kept indefinitely)
- Unread articles are NEVER deleted
- Only the 500 most recent articles per feed are kept

This should dramatically reduce your database size from 160GB while preserving all important content!
