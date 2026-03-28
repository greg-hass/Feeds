import { runMaintenanceCleanup, runDigestMaintenance } from './scheduler-maintenance.js';
import { runFeedRefreshCycle } from './scheduler-refresh.js';

// Scheduler timing configuration
// These values balance responsiveness with resource usage and external API limits
const CHECK_INTERVAL = 60 * 1000; // 1 minute - frequent enough for responsive UI updates without excessive DB polling
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours - daily cleanup is sufficient for maintenance tasks
const DIGEST_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes - checks digest schedule without missing hourly boundaries

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3;
const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
const BASE_BACKOFF = 1000; // 1 second

// Memory safety limits
const MEMORY_WARNING_MB = 400; // Log warning at 400MB
const MEMORY_CRITICAL_MB = 512; // Pause scheduler at 512MB to prevent crash

interface SchedulerState {
    isRunning: boolean;
    consecutiveFailures: number;
    lastFailureTime: number;
    timeoutHandle: NodeJS.Timeout | null;
    cleanupTimeoutHandle: NodeJS.Timeout | null;
    digestTimeoutHandle: NodeJS.Timeout | null;
    isPaused: boolean;
    isProcessing: boolean;
    lastCleanupAt: number;
    lastDigestCheck: number;
    lastDigestSkipKey: string | null;
}

let state: SchedulerState = {
    isRunning: false,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    timeoutHandle: null,
    cleanupTimeoutHandle: null,
    digestTimeoutHandle: null,
    isPaused: false,
    isProcessing: false,
    lastCleanupAt: 0,
    lastDigestCheck: 0,
    lastDigestSkipKey: null,
};

export function isRefreshing() {
    return state.isProcessing;
}

export function startScheduler() {
    if (state.isRunning) return;
    state.isRunning = true;
    state.consecutiveFailures = 0;
    state.isPaused = false;
    console.log('Starting background feed scheduler...');

    // Schedule first run
    state.timeoutHandle = setTimeout(runSchedulerCycle, 5000);

    // Schedule cleanup to run shortly after startup, then daily
    state.cleanupTimeoutHandle = setTimeout(runCleanupCycle, 60000);

    // Schedule digest check to run after startup, then every 5 minutes
    state.digestTimeoutHandle = setTimeout(runDigestCycle, 30000);
}

export function stopScheduler() {
    state.isRunning = false;
    if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
        state.timeoutHandle = null;
    }
    if (state.cleanupTimeoutHandle) {
        clearTimeout(state.cleanupTimeoutHandle);
        state.cleanupTimeoutHandle = null;
    }
    if (state.digestTimeoutHandle) {
        clearTimeout(state.digestTimeoutHandle);
        state.digestTimeoutHandle = null;
    }
    state.isPaused = false;
    console.log('Stopped background feed scheduler');
}

function calculateBackoff(failures: number): number {
    return Math.min(BASE_BACKOFF * Math.pow(2, failures), MAX_BACKOFF);
}

function checkMemoryUsage(): { ok: boolean; warning: boolean; usedMB: number } {
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    return {
        ok: usedMB < MEMORY_CRITICAL_MB,
        warning: usedMB > MEMORY_WARNING_MB,
        usedMB,
    };
}

async function runSchedulerCycle() {
    if (!state.isRunning || state.isPaused) return;
    
    // Memory safety check - pause if critically high
    const memCheck = checkMemoryUsage();
    if (!memCheck.ok) {
        console.error(`[Scheduler] CRITICAL: Memory usage at ${memCheck.usedMB}MB, pausing scheduler`);
        state.isPaused = true;
        // Try again in 1 minute after GC has had time to run
        state.timeoutHandle = setTimeout(() => {
            state.isPaused = false;
            if (state.isRunning) {
                state.timeoutHandle = setTimeout(runSchedulerCycle, 5000);
            }
        }, 60000);
        return;
    }
    if (memCheck.warning) {
        console.warn(`[Scheduler] WARNING: Memory usage at ${memCheck.usedMB}MB`);
    }
    
    // Prevent concurrent refresh cycles
    if (state.isProcessing) {
        console.log('[Scheduler] Previous cycle still running, skipping this cycle');
        // Reschedule for next interval
        if (state.isRunning && !state.isPaused) {
            state.timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
        }
        return;
    }

    try {
        console.log(`[Scheduler] Running cycle (failures: ${state.consecutiveFailures})`);
        await checkFeeds();
        
        // Check if still running after async operation
        if (!state.isRunning) return;
        
        // Reset failure count on success
        state.consecutiveFailures = 0;
        state.isPaused = false;
        
    } catch (err) {
        // Check if still running before updating state
        if (!state.isRunning) return;
        
        state.consecutiveFailures++;
        state.lastFailureTime = Date.now();
        
        console.error(`[Scheduler] Cycle ${state.consecutiveFailures} failed:`, err);
        
        // Circuit breaker: pause if too many failures
        if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
            state.isPaused = true;
            const backoff = calculateBackoff(state.consecutiveFailures);
            console.log(`[Scheduler] Circuit breaker activated. Pausing for ${Math.round(backoff / 1000)}s`);
            
            if (state.isRunning) {
                state.timeoutHandle = setTimeout(runSchedulerCycle, backoff);
                return;
            }
        }
    }
    
    // Schedule next cycle if not paused and still running
    if (state.isRunning && !state.isPaused) {
        state.timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
    }
}

async function checkFeeds() {
    try {
        state.isProcessing = true;
        await runFeedRefreshCycle(1);
        
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Scheduler] Critical error in checkFeeds: ${errorMessage}`);
        throw err; // Re-throw to trigger circuit breaker
    } finally {
        state.isProcessing = false;
    }
}

async function runCleanupCycle() {
    if (!state.isRunning) return;

    try {
        const userId = 1;
        await runMaintenanceCleanup(userId);

        state.lastCleanupAt = Date.now();

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Cleanup] Error during cleanup: ${errorMessage}`);
    }

    // Schedule next cleanup cycle
    if (state.isRunning) {
        state.cleanupTimeoutHandle = setTimeout(runCleanupCycle, CLEANUP_INTERVAL);
    }
}
async function runDigestCycle() {
    if (!state.isRunning) return;

    try {
        const userId = 1;
        const result = await runDigestMaintenance(userId, state.lastDigestSkipKey);
        state.lastDigestSkipKey = result.lastDigestSkipKey;

        state.lastDigestCheck = Date.now();

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Digest] Error during digest cycle: ${errorMessage}`);
    }

    // Schedule next digest check
    if (state.isRunning) {
        state.digestTimeoutHandle = setTimeout(runDigestCycle, DIGEST_CHECK_INTERVAL);
    }
}
