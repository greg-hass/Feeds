/**
 * Validation utilities for route parameters
 */

/**
 * Validate and parse an ID parameter from URL
 * Returns null if invalid, otherwise returns the parsed integer
 */
export function validateId(id: string): number | null {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

/**
 * Validate and parse an optional ID parameter
 * Returns null if empty/undefined, parsed number if valid, -1 if invalid
 */
export function validateOptionalId(id: string | undefined): number | null | -1 {
    if (id === undefined || id === '') {
        return null;
    }
    return validateId(id) ?? -1;
}
