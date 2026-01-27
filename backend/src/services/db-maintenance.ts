import { queryOne, queryAll } from '../db/index.js';

export interface DatabaseStats {
    totalSizeBytes: number;
    tableSizes: TableSize[];
    indexSizes: IndexSize[];
    articleCount: number;
    feedCount: number;
    oldestArticleDate: string | null;
    ftsSizeBytes: number;
}

interface TableSize {
    name: string;
    rowCount: number;
    sizeBytes: number;
}

interface IndexSize {
    name: string;
    tableName: string;
    sizeBytes: number;
}

/**
 * Get comprehensive database statistics for monitoring
 */
export function getDatabaseStats(): DatabaseStats {
    // Get page size and page count to calculate total size
    const pageSizeResult = queryOne<{ page_size: number }>('PRAGMA page_size');
    const pageCountResult = queryOne<{ page_count: number }>('PRAGMA page_count');

    const pageSize = pageSizeResult?.page_size ?? 4096;
    const pageCount = pageCountResult?.page_count ?? 0;
    const totalSizeBytes = pageSize * pageCount;

    // Get table statistics
    const tables = queryAll<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'articles_fts%'"
    );

    const tableSizes: TableSize[] = tables.map(table => {
        const count = queryOne<{ count: number }>(
            `SELECT COUNT(*) as count FROM "${table.name}"`
        );

        // Estimate size based on sample (SQLite doesn't provide per-table sizes easily)
        const sample = queryOne<{ avg_row_size: number }>(
            `SELECT AVG(LENGTH(CAST(rowid AS TEXT))) as avg_row_size FROM "${table.name}" LIMIT 1000`
        );

        return {
            name: table.name,
            rowCount: count?.count || 0,
            sizeBytes: (count?.count || 0) * (sample?.avg_row_size || 100),
        };
    });

    // Get index statistics
    const indexes = queryAll<{ name: string; tbl_name: string }>(
        "SELECT name, tbl_name FROM sqlite_master WHERE type='index'"
    );

    const indexSizes: IndexSize[] = indexes.map(idx => ({
        name: idx.name,
        tableName: idx.tbl_name,
        sizeBytes: 0, // SQLite doesn't expose index sizes directly
    }));

    // Get article and feed counts
    const articleCount = queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM articles'
    )?.count || 0;

    const feedCount = queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM feeds WHERE deleted_at IS NULL'
    )?.count || 0;

    // Get oldest article date
    const oldestArticle = queryOne<{ published_at: string }>(
        'SELECT published_at FROM articles ORDER BY published_at ASC LIMIT 1'
    );

    // Estimate FTS size based on row count (SQLite doesn't expose per-table page counts)
    let ftsSizeBytes = 0;
    try {
        const ftsRowCount = queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM articles_fts"
        );
        // Rough estimate: FTS typically uses ~1.5x the text size, assume ~200 bytes avg per article
        ftsSizeBytes = (ftsRowCount?.count || 0) * 300;
    } catch {
        // FTS table may not exist yet
        ftsSizeBytes = 0;
    }

    return {
        totalSizeBytes,
        tableSizes,
        indexSizes,
        articleCount,
        feedCount,
        oldestArticleDate: oldestArticle?.published_at || null,
        ftsSizeBytes,
    };
}

/**
 * Check if database maintenance is needed
 */
export function checkMaintenanceNeeded(): {
    needsVacuum: boolean;
    needsOptimize: boolean;
    fragmentationRatio: number;
    recommendations: string[];
} {
    const recommendations: string[] = [];

    // Check freelist pages (fragmentation indicator)
    const freelistResult = queryOne<{ freelist_count: number }>('PRAGMA freelist_count');
    const pageCountResult = queryOne<{ page_count: number }>('PRAGMA page_count');

    const freelistInfo = {
        freelist_count: freelistResult?.freelist_count ?? 0,
        page_count: pageCountResult?.page_count ?? 1
    };

    const fragmentationRatio = freelistInfo
        ? freelistInfo.freelist_count / Math.max(freelistInfo.page_count, 1)
        : 0;

    const needsVacuum = fragmentationRatio > 0.2; // >20% fragmentation
    const needsOptimize = fragmentationRatio > 0.1; // >10% fragmentation

    if (needsVacuum) {
        recommendations.push(`Database fragmentation is ${(fragmentationRatio * 100).toFixed(1)}%. Run VACUUM to reclaim space.`);
    } else if (needsOptimize) {
        recommendations.push(`Database fragmentation is ${(fragmentationRatio * 100).toFixed(1)}%. Consider running VACUUM during low-traffic period.`);
    }

    // Note: SQLite doesn't have built-in slow query logging
    // This would require application-level tracking

    return {
        needsVacuum,
        needsOptimize,
        fragmentationRatio,
        recommendations,
    };
}

/**
 * Run database optimization (VACUUM, ANALYZE, REINDEX)
 * WARNING: VACUUM requires exclusive database lock and can take time on large databases
 */
export async function optimizeDatabase(): Promise<{
    success: boolean;
    message: string;
    durationMs: number;
}> {
    const startTime = Date.now();

    try {
        // Run ANALYZE to update statistics for query planner
        queryOne('ANALYZE');

        // Run REINDEX to rebuild indexes
        queryOne('REINDEX');

        // Note: VACUUM is not run automatically as it requires exclusive lock
        // It should be scheduled during maintenance windows

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            message: 'Database optimized successfully (ANALYZE + REINDEX)',
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            message: `Optimization failed: ${errorMessage}`,
            durationMs,
        };
    }
}

/**
 * Run VACUUM to defragment database and reclaim space
 * WARNING: This requires exclusive lock and can take significant time
 */
export async function vacuumDatabase(): Promise<{
    success: boolean;
    message: string;
    durationMs: number;
    bytesReclaimed: number;
}> {
    const startTime = Date.now();
    const statsBefore = getDatabaseStats();

    try {
        // VACUUM requires exclusive database access
        // This will fail if there are any open transactions
        queryOne('VACUUM');

        const statsAfter = getDatabaseStats();
        const durationMs = Date.now() - startTime;
        const bytesReclaimed = statsBefore.totalSizeBytes - statsAfter.totalSizeBytes;

        return {
            success: true,
            message: `Database vacuumed successfully. Reclaimed ${(bytesReclaimed / 1024 / 1024).toFixed(2)} MB`,
            durationMs,
            bytesReclaimed,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            message: `VACUUM failed: ${errorMessage}`,
            durationMs,
            bytesReclaimed: 0,
        };
    }
}
