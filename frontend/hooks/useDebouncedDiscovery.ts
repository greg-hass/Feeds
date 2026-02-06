import { useState, useEffect, useRef } from 'react';
import { api, DiscoveredFeed } from '@/services/api';

interface UseDebouncedDiscoveryOptions {
    delay?: number;
    onError?: (error: Error) => void;
    onSuccess?: (discoveries: DiscoveredFeed[]) => void;
    type?: string;
}

export const useDebouncedDiscovery = (options: UseDebouncedDiscoveryOptions = {}) => {
    const { delay = 500 } = options;
    
    const [input, setInputState] = useState('');
    const [discoveries, setDiscoveries] = useState<DiscoveredFeed[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);
    
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const optionsRef = useRef(options);
    const skipNextDebounceRef = useRef(false);
    const isDiscoveringRef = useRef(false);
    
    optionsRef.current = options;
    isDiscoveringRef.current = isDiscovering;

    const setInput = (value: string, skipDebounce = false) => {
        if (skipDebounce) {
            skipNextDebounceRef.current = true;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
        setInputState(value);
    };

    const clearDiscovery = () => {
        setDiscoveries([]);
        setHasAttempted(false);
    };

    const triggerDiscovery = async (query: string, type?: string) => {
        if (!query.trim()) {
            clearDiscovery();
            return;
        }
        
        // Prevent concurrent discoveries
        if (isDiscoveringRef.current) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        }
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        
        abortControllerRef.current = new AbortController();

        setIsDiscovering(true);
        setHasAttempted(true);

        try {
            const result = await api.discover(query, type, abortControllerRef.current?.signal);
            setDiscoveries(result.discoveries);
            optionsRef.current.onSuccess?.(result.discoveries);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Request was cancelled, don't treat as error
                return;
            }
            optionsRef.current.onError?.(err instanceof Error ? err : new Error('Discovery failed'));
            setDiscoveries([]);
        } finally {
            setIsDiscovering(false);
        }
    };

    // Debounced auto-discovery for URL-like inputs
    useEffect(() => {
        if (skipNextDebounceRef.current) {
            skipNextDebounceRef.current = false;
            return;
        }
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (!input.trim()) {
            setDiscoveries([]);
            setHasAttempted(false);
            return;
        }

        const isUrlLike = /^https?:\/\//i.test(input) || 
                          input.includes('.') && input.length > 4;

        if (isUrlLike) {
            timeoutRef.current = setTimeout(() => {
                triggerDiscovery(input, optionsRef.current.type);
            }, delay);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            // Cancel any in-flight request when input changes
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input, delay]);

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
