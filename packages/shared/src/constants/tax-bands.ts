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
    /**
     * Tax-free threshold (kobo). Income up to this amount is taxed at 0%.
     * Used by 2026+ bands where the first band has a 0% rate.
     * For pre-2026 years this is 0 (the CRA effectively serves as the relief).
     */
    taxFreeThreshold: bigint;
    /**
     * Whether the Rent Relief deduction is available for this year.
     * 2026+: 20% of annual rent paid, capped at ₦500,000.
     */
    rentReliefEnabled: boolean;
    /** Maximum Rent Relief in kobo (e.g. ₦500,000 = 50_000_000n) */
    maxRentRelief: bigint;
}

/**
 * PITA 2020-2025 tax bands — the old structure with CRA.
 */
const PITA_BANDS_LEGACY: TaxBand[] = [
    { limit: 30000000n, rate: 0.07, label: 'First ₦300,000 @ 7%' },
    { limit: 30000000n, rate: 0.11, label: 'Next ₦300,000 @ 11%' },
    { limit: 50000000n, rate: 0.15, label: 'Next ₦500,000 @ 15%' },
    { limit: 50000000n, rate: 0.19, label: 'Next ₦500,000 @ 19%' },
    { limit: 160000000n, rate: 0.21, label: 'Next ₦1,600,000 @ 21%' },
    { limit: BigInt(Number.MAX_SAFE_INTEGER), rate: 0.24, label: 'Above ₦3,200,000 @ 24%' },
];

/**
 * PITA 2026+ tax bands — 2025 Tax Act.
 * The ₦800,000 tax-free threshold is encoded as the first 0% band.
 */
const PITA_BANDS_2026: TaxBand[] = [
    { limit: 80000000n, rate: 0.00, label: 'First ₦800,000 @ 0%' },
    { limit: 220000000n, rate: 0.15, label: 'Next ₦2,200,000 @ 15%' },
    { limit: 900000000n, rate: 0.18, label: 'Next ₦9,000,000 @ 18%' },
    { limit: 1300000000n, rate: 0.21, label: 'Next ₦13,000,000 @ 21%' },
    { limit: 2500000000n, rate: 0.23, label: 'Next ₦25,000,000 @ 23%' },
    { limit: BigInt(Number.MAX_SAFE_INTEGER), rate: 0.25, label: 'Above ₦50,000,000 @ 25%' },
];

/** Shared defaults for legacy years (2020-2025) */
const LEGACY_DEFAULTS = {
    craFixedAmount: 20000000n,       // ₦200,000 in kobo
    craGrossPercentage: 0.01,        // 1% of gross
    craAdditionalPercentage: 0.20,   // 20% of gross
    minimumTaxRate: 0.01,            // 1% minimum tax
    taxFreeThreshold: 0n,
    rentReliefEnabled: false,
    maxRentRelief: 0n,
} as const;

/** Tax band configurations by year */
export const TAX_BANDS: Record<number, TaxBandConfig> = {
    2020: { year: 2020, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2021: { year: 2021, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2022: { year: 2022, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2023: { year: 2023, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2024: { year: 2024, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2025: { year: 2025, bands: PITA_BANDS_LEGACY, ...LEGACY_DEFAULTS },
    2026: {
        year: 2026,
        bands: PITA_BANDS_2026,
        craFixedAmount: 0n,              // CRA eliminated in 2026
        craGrossPercentage: 0,
        craAdditionalPercentage: 0,
        minimumTaxRate: 0.00,            // Minimum tax eliminated in 2026
        taxFreeThreshold: 80000000n,     // ₦800,000 in kobo
        rentReliefEnabled: true,
        maxRentRelief: 50000000n,        // ₦500,000 in kobo
    },
};
