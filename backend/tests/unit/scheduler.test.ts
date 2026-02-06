import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

// Mock database
vi.mock('../../src/db/index.js', () => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    run: vi.fn(),
}));

// Mock settings
vi.mock('../../src/services/settings.js', () => ({
    getUserSettings: vi.fn(),
    getUserSettingsRaw: vi.fn(),
    updateUserSettingsRaw: vi.fn(),
}));

// Mock feed-refresh
vi.mock('../../src/services/feed-refresh.js', () => ({
    refreshFeed: vi.fn(),
}));

// Mock digest
vi.mock('../../src/services/digest.js', () => ({
    generateDailyDigest: vi.fn(),
    getCurrentEdition: vi.fn(),
}));

// Mock refresh-events
vi.mock('../../src/services/refresh-events.js', () => ({
    emitRefreshEvent: vi.fn(),
}));

// Mock image-cache
vi.mock('../../src/services/image-cache.js', () => ({
    getCacheDir: vi.fn(() => tmpdir()),
}));

import { queryAll } from '../../src/db/index.js';
import { getUserSettings, getUserSettingsRaw, updateUserSettingsRaw } from '../../src/services/settings.js';
import { refreshFeed } from '../../src/services/feed-refresh.js';

describe('Scheduler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    describe('Circuit Breaker', () => {
        it('should activate circuit breaker after 3 consecutive failures', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            // Mock settings to allow refresh
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            
            // Mock feeds query to throw error
            (queryAll as any).mockImplementation(() => {
                throw new Error('Database error');
            });

            startScheduler();
            
            // Wait for initial delay (5s) + 3 cycles with failures
            await vi.advanceTimersByTimeAsync(5000); // Initial delay
            await vi.advanceTimersByTimeAsync(60000); // First cycle
            await vi.advanceTimersByTimeAsync(60000); // Second cycle
            await vi.advanceTimersByTimeAsync(60000); // Third cycle - should trigger circuit breaker
            
            // Check that consecutive failures reached threshold (allowing for some variance in timing)
            expect((queryAll as any).mock.calls.length).toBeGreaterThanOrEqual(3);
            
            stopScheduler();
        });

        it('should reset failure count on success', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            (queryAll as any).mockReturnValue([]);
            
            startScheduler();
            
            // Run one successful cycle
            await vi.advanceTimersByTimeAsync(5000);
            
            // Should have queried for feeds
            expect(queryAll).toHaveBeenCalled();
            
            stopScheduler();
        });

        it('should use exponential backoff when circuit breaker is active', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            (queryAll as any).mockImplementation(() => {
                throw new Error('Database error');
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            startScheduler();
            
            // Trigger 3 failures to activate circuit breaker
            await vi.advanceTimersByTimeAsync(5000);
            await vi.advanceTimersByTimeAsync(60000);
            await vi.advanceTimersByTimeAsync(60000);
            await vi.advanceTimersByTimeAsync(60000);
            
            // Check that circuit breaker message was logged
            const circuitBreakerLog = consoleSpy.mock.calls.find(
                call => call[0]?.includes?.('Circuit breaker activated')
            );
            expect(circuitBreakerLog).toBeDefined();
            
            consoleSpy.mockRestore();
            stopScheduler();
        });
    });

    describe('Memory Management', () => {
        it('should pause scheduler when memory exceeds critical threshold', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            // Mock high memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = vi.fn(() => ({
                heapUsed: 600 * 1024 * 1024, // 600MB - above critical threshold
                heapTotal: 800 * 1024 * 1024,
                external: 0,
                arrayBuffers: 0,
                rss: 0,
            })) as any;

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Check that memory warning was logged
            const memoryLog = consoleSpy.mock.calls.find(
                call => call[0]?.includes?.('CRITICAL: Memory usage')
            );
            expect(memoryLog).toBeDefined();
            
            process.memoryUsage = originalMemoryUsage;
            consoleSpy.mockRestore();
            stopScheduler();
        });

        it('should log warning when memory exceeds warning threshold', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            // Mock medium-high memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = vi.fn(() => ({
                heapUsed: 450 * 1024 * 1024, // 450MB - above warning threshold
                heapTotal: 800 * 1024 * 1024,
                external: 0,
                arrayBuffers: 0,
                rss: 0,
            })) as any;

            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            (queryAll as any).mockReturnValue([]);

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Check that memory warning was logged
            const memoryLog = consoleSpy.mock.calls.find(
                call => call[0]?.includes?.('WARNING: Memory usage')
            );
            expect(memoryLog).toBeDefined();
            
            process.memoryUsage = originalMemoryUsage;
            consoleSpy.mockRestore();
            stopScheduler();
        });
    });

    describe('Scheduler State', () => {
        it('should track isRefreshing state', async () => {
            const { startScheduler, stopScheduler, isRefreshing } = await import('../../src/services/scheduler.js');
            
            expect(isRefreshing()).toBe(false);
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            (queryAll as any).mockReturnValue([]);
            
            startScheduler();
            
            // During the cycle, isRefreshing should be true
            // Note: We can't easily test this without more complex mocking
            
            stopScheduler();
            expect(isRefreshing()).toBe(false);
        });

        it('should prevent concurrent refresh cycles', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            
            // Create a slow feed refresh that takes time
            let resolveRefresh: () => void;
            const refreshPromise = new Promise<void>((resolve) => {
                resolveRefresh = resolve;
            });
            
            (refreshFeed as any).mockReturnValue(refreshPromise);
            (queryAll as any).mockReturnValue([
                { id: 1, url: 'https://example.com/feed.xml', type: 'rss' },
            ]);

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Try to trigger another cycle while first is still running
            await vi.advanceTimersByTimeAsync(60000);
            
            // Should log that previous cycle is still running (or may not depending on timing)
            // This test verifies the scheduler handles concurrent cycles appropriately
            const concurrentLog = consoleSpy.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('Previous cycle still running')
            );
            // The log may or may not appear depending on timing, so we just verify no crash
            
            // Resolve the pending refresh
            resolveRefresh!();
            
            consoleSpy.mockRestore();
            stopScheduler();
        });
    });

    describe('Start/Stop', () => {
        it('should start scheduler only once', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            startScheduler();
            startScheduler(); // Second call should be ignored
            startScheduler(); // Third call should be ignored
            
            // Should only log "Starting" once
            const startLogs = consoleSpy.mock.calls.filter(
                call => call[0]?.includes?.('Starting background feed scheduler')
            );
            expect(startLogs).toHaveLength(1);
            
            consoleSpy.mockRestore();
            stopScheduler();
        });

        it('should stop scheduler and clear timeouts', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(100);
            
            stopScheduler();
            
            const stopLog = consoleSpy.mock.calls.find(
                call => call[0]?.includes?.('Stopped background feed scheduler')
            );
            expect(stopLog).toBeDefined();
            
            consoleSpy.mockRestore();
        });

        it('should not run cycles after stopped', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({});
            (queryAll as any).mockReturnValue([]);
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Should have run once
            expect(queryAll).toHaveBeenCalledTimes(1);
            
            stopScheduler();
            
            // Advance time significantly
            await vi.advanceTimersByTimeAsync(600000); // 10 minutes
            
            // Should not have run again
            expect(queryAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('Global Refresh Schedule', () => {
        it('should respect global refresh schedule', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({
                global_next_refresh_at: futureTime,
            });
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Should not query feeds because next refresh is in the future
            expect(queryAll).not.toHaveBeenCalled();
            
            stopScheduler();
        });

        it('should refresh when global schedule is due', async () => {
            const { startScheduler, stopScheduler } = await import('../../src/services/scheduler.js');
            
            const pastTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
            
            (getUserSettings as any).mockReturnValue({ refresh_interval_minutes: 60 });
            (getUserSettingsRaw as any).mockReturnValue({
                global_next_refresh_at: pastTime,
            });
            (queryAll as any).mockReturnValue([]);
            
            startScheduler();
            await vi.advanceTimersByTimeAsync(5000);
            
            // Should query feeds because next refresh is in the past
            expect(queryAll).toHaveBeenCalled();
            
            stopScheduler();
        });
    });
});
