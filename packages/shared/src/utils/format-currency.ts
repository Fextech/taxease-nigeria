/**
 * Currency formatting utilities
 * All internal values are stored in kobo (BigInt). These helpers convert to display format.
 *
 * RULE: Never use floats for money. Convert to NGN ONLY at the display layer.
 */

/**
 * Convert kobo (BigInt) to Naira (number) — ONLY for display purposes.
 * @param kobo Amount in kobo as BigInt
 * @returns Amount in Naira as a number (for Intl.NumberFormat)
 */
export function koboToNaira(kobo: bigint): number {
    return Number(kobo) / 100;
}

/**
 * Format a kobo amount as a Nigerian Naira currency string.
 * @param kobo Amount in kobo as BigInt
 * @returns Formatted string like "₦50,000.00"
 *
 * @example
 * formatNGN(5000000n) // "₦50,000.00"
 * formatNGN(0n)       // "₦0.00"
 * formatNGN(150n)     // "₦1.50"
 */
export function formatNGN(kobo: bigint): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(koboToNaira(kobo));
}

/**
 * Parse a Naira string or number input into kobo (BigInt).
 * Useful for form inputs where users type in Naira.
 * @param naira Amount in Naira (number or string like "50000" or "50,000.00")
 * @returns Amount in kobo as BigInt
 */
export function nairaToKobo(naira: number | string): bigint {
    const num = typeof naira === 'string'
        ? parseFloat(naira.replace(/[₦,\s]/g, ''))
        : naira;

    if (isNaN(num)) return 0n;

    // Multiply by 100 and round to avoid floating point issues
    return BigInt(Math.round(num * 100));
}
