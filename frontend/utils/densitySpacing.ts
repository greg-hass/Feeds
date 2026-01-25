import { spacing } from '@/theme';

export type ViewDensity = 'compact' | 'comfortable' | 'spacious';

/**
 * Get spacing values scaled by view density
 */
export function getDensitySpacing(density: ViewDensity = 'comfortable') {
    const multipliers = {
        compact: 0.75,
        comfortable: 1,
        spacious: 1.5,
    };

    const m = multipliers[density];

    return {
        xs: spacing.xs * m,
        sm: spacing.sm * m,
        md: spacing.md * m,
        lg: spacing.lg * m,
        xl: spacing.xl * m,
        xxl: spacing.xxl * m,
    };
}

/**
 * Get thumbnail size based on density
 */
export function getThumbnailSize(density: ViewDensity = 'comfortable') {
    switch (density) {
        case 'compact':
            return { width: 70, height: 70 };
        case 'spacious':
            return { width: 120, height: 120 };
        default:
            return { width: 90, height: 90 };
    }
}

/**
 * Get font sizes based on density
 */
export function getDensityFontSizes(density: ViewDensity = 'comfortable') {
    const multipliers = {
        compact: 0.85,
        comfortable: 1,
        spacious: 1.15,
    };

    const m = multipliers[density];

    return {
        title: 16 * m,
        feedName: 11 * m,
        meta: 12 * m,
        summary: 14 * m,
    };
}

/**
 * Get featured thumbnail height based on density
 */
export function getFeaturedThumbnailHeight(density: ViewDensity = 'comfortable') {
    switch (density) {
        case 'compact':
            return 160;
        case 'spacious':
            return 240;
        default:
            return 200;
    }
}
