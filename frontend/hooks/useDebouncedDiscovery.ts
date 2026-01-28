import { useState, useEffect, useCallback, useRef } from 'react';
import { api, DiscoveredFeed } from '@/services/api';

interface UseDebouncedDiscoveryOptions {
    delay?: number;
    onError?: (error: Error) => void;
    onSuccess?: (discoveries: DiscoveredFeed[]) => void;
}

export const useDebouncedDiscovery = (options: UseDebouncedDiscoveryOptions = {}) => {
    const { delay = 500, onError, onSuccess } = options;
    
    const [input, setInput] = useState('');
    const [discoveries, setDiscoveries] = useState<DiscoveredFeed[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);
    
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Track if discovery was just triggered manually (to skip debounce effect)
    const justTriggeredRef = useRef(false);

    const clearDiscovery = useCallback(() => {
        setDiscoveries([]);
        setHasAttempted(false);
    }, []);

    const triggerDiscovery = useCallback(async (query: string, type?: string) => {
        if (!query.trim()) {
            clearDiscovery();
            return;
        }

        // Mark that we just triggered manually
        justTriggeredRef.current = true;
        
        // Clear any pending auto-discovery
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsDiscovering(true);
        setHasAttempted(true);

        try {
            const result = await api.discover(query, type);
            setDiscoveries(result.discoveries);
            onSuccess?.(result.discoveries);
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                onError?.(err);
            }
            setDiscoveries([]);
        } finally {
            setIsDiscovering(false);
            // Reset the flag after a short delay (longer than the effect cycle)
            setTimeout(() => {
                justTriggeredRef.current = false;
            }, 100);
        }
    }, [clearDiscovery, onError, onSuccess]);

    // Debounced auto-discovery for URL-like inputs
    useEffect(() => {
        // Skip if we just triggered manually
        if (justTriggeredRef.current) {
            return;
        }
        
        // Clear previous timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Don't auto-trigger if empty
        if (!input.trim()) {
            clearDiscovery();
            return;
        }

        // Auto-trigger for URL-like inputs
        const isUrlLike = /^https?:\/\//i.test(input) || 
                          input.includes('.') && input.length > 4;

        if (isUrlLike) {
            timeoutRef.current = setTimeout(() => {
                triggerDiscovery(input);
            }, delay);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [input, delay, triggerDiscovery, clearDiscovery]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        input,
        setInput,
        discoveries,
        setDiscoveries,
        isDiscovering,
        hasAttempted,
        triggerDiscovery,
        clearDiscovery,
    };
};
