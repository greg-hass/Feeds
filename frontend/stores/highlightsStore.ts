import { create } from 'zustand';
import { api } from '@/services/api';

// ============================================================================
// TYPES
// ============================================================================

export interface Highlight {
    id: number;
    user_id: number;
    article_id: number;
    text: string;
    start_offset: number;
    end_offset: number;
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
    note: string | null;
    created_at: string;
    updated_at: string;
}

export interface ReadingProgress {
    id: number;
    user_id: number;
    article_id: number;
    scroll_position: number;
    scroll_percentage: number;
    last_read_at: string;
}

export interface TocItem {
    level: number;
    text: string;
    id: string;
}

export interface CreateHighlightParams {
    article_id: number;
    text: string;
    start_offset: number;
    end_offset: number;
    color?: Highlight['color'];
    note?: string;
}

export interface UpdateHighlightParams {
    color?: Highlight['color'];
    note?: string;
}

export interface UpdateProgressParams {
    article_id: number;
    scroll_position: number;
    scroll_percentage: number;
}

// ============================================================================
// STORE
// ============================================================================

interface HighlightsState {
    // State
    highlights: Highlight[];
    readingProgress: ReadingProgress | null;
    tableOfContents: TocItem[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchHighlights: (articleId: number) => Promise<void>;
    createHighlight: (params: CreateHighlightParams) => Promise<Highlight>;
    updateHighlight: (id: number, params: UpdateHighlightParams) => Promise<void>;
    deleteHighlight: (id: number) => Promise<void>;

    fetchReadingProgress: (articleId: number) => Promise<void>;
    updateReadingProgress: (params: UpdateProgressParams) => Promise<void>;
    deleteReadingProgress: (articleId: number) => Promise<void>;

    generateTableOfContents: (htmlContent: string) => Promise<TocItem[]>;

    reset: () => void;
}

export const useHighlightsStore = create<HighlightsState>((set, get) => ({
    // Initial state
    highlights: [],
    readingProgress: null,
    tableOfContents: [],
    isLoading: false,
    error: null,

    // Fetch all highlights for an article
    fetchHighlights: async (articleId: number) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/highlights/article/${articleId}`);
            set({ highlights: response.highlights, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    // Create a new highlight
    createHighlight: async (params: CreateHighlightParams) => {
        set({ error: null });
        try {
            const response = await api.post('/highlights/', params);

            // Optimistic update
            set((state) => ({
                highlights: [...state.highlights, response.highlight].sort(
                    (a, b) => a.start_offset - b.start_offset
                ),
            }));

            return response.highlight;
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Update highlight color or note
    updateHighlight: async (id: number, params: UpdateHighlightParams) => {
        set({ error: null });
        try {
            await api.patch(`/highlights/${id}`, params);

            // Optimistic update
            set((state) => ({
                highlights: state.highlights.map((h) =>
                    h.id === id
                        ? {
                              ...h,
                              ...params,
                              updated_at: new Date().toISOString(),
                          }
                        : h
                ),
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Delete a highlight
    deleteHighlight: async (id: number) => {
        set({ error: null });
        try {
            await api.delete(`/highlights/${id}`);

            // Optimistic update
            set((state) => ({
                highlights: state.highlights.filter((h) => h.id !== id),
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Fetch reading progress
    fetchReadingProgress: async (articleId: number) => {
        set({ error: null });
        try {
            const response = await api.get(`/highlights/progress/${articleId}`);
            set({ readingProgress: response.progress });
        } catch (error: any) {
            // 404 is expected if no progress exists
            if (error.statusCode !== 404) {
                set({ error: error.message });
            }
        }
    },

    // Update reading progress
    updateReadingProgress: async (params: UpdateProgressParams) => {
        set({ error: null });
        try {
            await api.post('/highlights/progress', params);

            // Optimistic update
            set({
                readingProgress: {
                    id: get().readingProgress?.id || 0,
                    user_id: 1, // Will be set by backend
                    article_id: params.article_id,
                    scroll_position: params.scroll_position,
                    scroll_percentage: params.scroll_percentage,
                    last_read_at: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Delete reading progress
    deleteReadingProgress: async (articleId: number) => {
        set({ error: null });
        try {
            await api.delete(`/highlights/progress/${articleId}`);
            set({ readingProgress: null });
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Generate table of contents
    generateTableOfContents: async (htmlContent: string) => {
        set({ error: null });
        try {
            const response = await api.post('/highlights/toc/generate', {
                html_content: htmlContent,
            });
            set({ tableOfContents: response.toc });
            return response.toc;
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Reset state
    reset: () => {
        set({
            highlights: [],
            readingProgress: null,
            tableOfContents: [],
            isLoading: false,
            error: null,
        });
    },
}));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get color for highlight based on color name
 */
export function getHighlightColor(color: Highlight['color']): string {
    const colors: Record<Highlight['color'], string> = {
        yellow: '#FFF59D',
        green: '#A5D6A7',
        blue: '#90CAF9',
        pink: '#F48FB1',
        purple: '#CE93D8',
    };
    return colors[color];
}

/**
 * Get darker variant for highlight borders/accents
 */
export function getHighlightAccentColor(color: Highlight['color']): string {
    const colors: Record<Highlight['color'], string> = {
        yellow: '#FBC02D',
        green: '#66BB6A',
        blue: '#42A5F5',
        pink: '#EC407A',
        purple: '#AB47BC',
    };
    return colors[color];
}

/**
 * Format highlight count
 */
export function formatHighlightCount(count: number): string {
    if (count === 0) return 'No highlights';
    if (count === 1) return '1 highlight';
    return `${count} highlights`;
}

/**
 * Get TOC depth indicator
 */
export function getTocIndent(level: number): number {
    return (level - 1) * 16; // 16px per level
}
