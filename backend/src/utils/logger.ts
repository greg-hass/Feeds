/**
 * Structured logging utility
 * Wraps console methods with better formatting and log levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const CURRENT_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: string;
    metadata?: Record<string, unknown>;
}

function formatLog(entry: LogEntry): string {
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    const ctx = entry.context ? `[${entry.context}] ` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${ctx}${entry.message}${meta}`;
}

function log(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        metadata,
    };

    const formatted = formatLog(entry);

    switch (level) {
        case 'debug':
            console.debug(formatted);
            break;
        case 'info':
            console.info(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        case 'error':
            console.error(formatted);
            break;
    }
}

export const logger = {
    debug: (msg: string, ctx?: string, meta?: Record<string, unknown>) => log('debug', msg, ctx, meta),
    info: (msg: string, ctx?: string, meta?: Record<string, unknown>) => log('info', msg, ctx, meta),
    warn: (msg: string, ctx?: string, meta?: Record<string, unknown>) => log('warn', msg, ctx, meta),
    error: (msg: string, ctx?: string, meta?: Record<string, unknown>) => log('error', msg, ctx, meta),
};

export default logger;
