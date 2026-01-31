import { Article } from '@/services/api';

/**
 * Compares two articles by published date (descending) and then by ID (descending)
 * Used for consistent article list sorting across the app
 */
export function compareArticlesByDateAndId(articleA: Article, articleB: Article): number {
    const dateA = new Date(articleA.published_at || 0).getTime();
    const dateB = new Date(articleB.published_at || 0).getTime();
    
    if (dateA !== dateB) {
        return dateB - dateA; // Newest first
    }
    
    return articleB.id - articleA.id; // Higher ID first if same date
}

/**
 * Sorts an array of articles in place by date and ID
 */
export function sortArticlesByDateAndId(articles: Article[]): Article[] {
    return articles.sort(compareArticlesByDateAndId);
}
