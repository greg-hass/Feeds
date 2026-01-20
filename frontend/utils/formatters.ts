/**
 * Utility functions for formatting data for display
 */

/**
 * Formats large numbers for badge display
 * - Numbers > 9999 show as "9999+"
 * - Numbers > 999 show as "X.Xk" (e.g., "2.8k")
 * - Numbers <= 999 show as-is
 * 
 * @param count - The number to format
 * @returns Formatted string
 * 
 * @example
 * formatCount(18632) // "9999+"
 * formatCount(2871)  // "2.8k"
 * formatCount(150)   // "150"
 */
export const formatCount = (count: number): string => {
  if (count > 9999) return '9999+';
  if (count > 999) {
    const k = count / 1000;
    // Remove decimal if it's a whole number
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return count.toString();
};
