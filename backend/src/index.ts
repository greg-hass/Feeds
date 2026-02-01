import 'dotenv/config';
import { startServer } from './app.js';

// Prevent crashes from unhandled promise rejections
// This is critical with parallel feed processing where race conditions can occur
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Log but don't exit - let the server continue running
    // In production, you might want to exit after logging for a clean restart
});

// Handle uncaught exceptions - don't crash on known error types
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
    
    // Only exit on truly fatal errors (memory, syntax)
    // Feed processing errors should not crash the server
    const isFatal = err instanceof Error && (
        err.message.includes('out of memory') ||
        err.message.includes('Cannot find module') ||
        err.name === 'SyntaxError'
    );
    
    if (isFatal) {
        console.error('[FATAL] Fatal error detected, exiting...');
        process.exit(1);
    }
    // Otherwise, log and continue - the scheduler has circuit breaker protection
});

startServer();
