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
    // Track if next input change should skip debounce (for programmatic sets)
    const skipNextDebounceRef = useRef(false);

    const clearDiscovery = useCallback(() => {
        setDiscoveries([]);
        setHasAttempted(false);
    }, []);

    // Wrap setInput to allow skipping debounce
    const setInputWithSkip = useCallback((value: string, skipDebounce = false) => {
        if (skipDebounce) {
            skipNextDebounceRef.current = true;
            // Clear any pending auto-discovery
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
        setInput(value);
    }, []);

    const triggerDiscovery = useCallback(async (query: string, type?: string) => {
        if (!query.trim()) {
            clearDiscovery();
            return;
        }
        
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
        }
    }, [clearDiscovery, onError, onSuccess]);

    // Debounced auto-discovery for URL-like inputs
    useEffect(() => {
        // Skip if this input change was programmatic (from setInputWithSkip)
        if (skipNextDebounceRef.current) {
            skipNextDebounceRef.current = false;
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
        setInput: setInputWithSkip,
        discoveries,
        setDiscoveries,
        isDiscovering,
        hasAttempted,
        triggerDiscovery,
        clearDiscovery,
    };
};
