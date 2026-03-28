export function getRefreshBatchSize(feedCount: number): number {
    if (feedCount <= 4) {
        return Math.max(feedCount, 1);
    }

    if (feedCount <= 10) {
        return 6;
    }

    if (feedCount <= 20) {
        return 8;
    }

    return 10;
}
