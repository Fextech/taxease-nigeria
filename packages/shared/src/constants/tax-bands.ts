/**
 * PITA Tax Bands by Year
 *
 * All values in kobo (1 NGN = 100 kobo).
 * Rate is a decimal (0.07 = 7%).
 * Bands are applied sequentially — income fills each band before moving to the next.
 */

export interface TaxBand {
    /** Maximum amount in this band (kobo). Use Number.MAX_SAFE_INTEGER for the final unlimited band. */
    limit: bigint;
    /** Tax rate as a decimal (e.g., 0.07 for 7%) */
    rate: number;
    /** Human-readable label */
    label: string;
}

export interface TaxBandConfig {
    year: number;
    bands: TaxBand[];
    /** CRA: higher of this fixed amount (in kobo) or 1% of gross income, plus 20% of gross */
    craFixedAmount: bigint;
    /** CRA percentage of gross income (the "1% of gross" component) */
    craGrossPercentage: number;
    /** CRA additional percentage of gross income (the "20% of gross" addition) */
    craAdditionalPercentage: number;
    /** Minimum tax rate (e.g., 0.01 for 1%) */
    minimumTaxRate: number;
}

/**
 * PITA 2024 tax bands — these have been stable since 2020.
 * If rates change for a specific year, add a new entry.
 */
const PITA_BANDS: TaxBand[] = [
    { limit: 30000000n, rate: 0.07, label: 'First ₦300,000 @ 7%' },
    { limit: 30000000n, rate: 0.11, label: 'Next ₦300,000 @ 11%' },
    { limit: 50000000n, rate: 0.15, label: 'Next ₦500,000 @ 15%' },
    { limit: 50000000n, rate: 0.19, label: 'Next ₦500,000 @ 19%' },
    { limit: 160000000n, rate: 0.21, label: 'Next ₦1,600,000 @ 21%' },
    { limit: BigInt(Number.MAX_SAFE_INTEGER), rate: 0.24, label: 'Above ₦3,200,000 @ 24%' },
];

/** Tax band configurations by year */
export const TAX_BANDS: Record<number, TaxBandConfig> = {
    2020: {
        year: 2020,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,       // ₦200,000 in kobo
        craGrossPercentage: 0.01,        // 1% of gross
        craAdditionalPercentage: 0.20,   // 20% of gross
        minimumTaxRate: 0.01,            // 1% minimum tax
    },
    2021: {
        year: 2021,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
    2022: {
        year: 2022,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
    2023: {
        year: 2023,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
    2024: {
        year: 2024,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
    2025: {
        year: 2025,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
    2026: {
        year: 2026,
        bands: PITA_BANDS,
        craFixedAmount: 20000000n,
        craGrossPercentage: 0.01,
        craAdditionalPercentage: 0.20,
        minimumTaxRate: 0.01,
    },
};
