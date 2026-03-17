/**
 * Banklens Nigeria — PITA Tax Computation Engine
 *
 * Pure function. All monetary values are in kobo (1 NGN = 100 kobo).
 * Uses BigInt arithmetic throughout to avoid floating-point rounding errors.
 *
 * Supports:
 *  - Pre-2026 years: CRA (Consolidated Relief Allowance) + old 6-band structure.
 *  - 2026+ (2025 Tax Act): No CRA, ₦800k tax-free threshold, new 6-band
 *    progressive structure, and optional Rent Relief (20% of rent, max ₦500k).
 */

import { TAX_BANDS, type TaxBand, type TaxBandConfig } from './constants/tax-bands';

// ─── Types ───────────────────────────────────────────────

export interface Relief {
    /** Human-readable label, e.g. "Pension Contribution" */
    label: string;
    /** Amount in kobo */
    amount: bigint;
}

export interface TaxBandResult {
    label: string;
    rate: number;
    /** Portion of taxable income that falls in this band (kobo) */
    taxableInBand: bigint;
    /** Tax owed for this band (kobo) */
    taxInBand: bigint;
}

export interface TaxComputationInput {
    /** Total gross income in kobo */
    grossIncome: bigint;
    /** Optional list of reliefs (pension, NHF, life insurance, etc.) */
    reliefs?: Relief[];
    /** Tax year — must exist in TAX_BANDS */
    taxYear: number;
    /**
     * Annual rent paid in kobo (2026+ only).
     * Used to compute Rent Relief = 20% of this value, capped at ₦500,000.
     */
    annualRentPaid?: bigint;
}

export interface TaxComputationResult {
    /** Gross income before any deductions (kobo) */
    grossIncome: bigint;
    /** Consolidated Relief Allowance (kobo). 0 for 2026+. */
    cra: bigint;
    /** Rent Relief applied (kobo). 0 for pre-2026 years. */
    rentRelief: bigint;
    /** Total additional reliefs applied — pension, NHF, etc. (kobo) */
    totalReliefs: bigint;
    /** Income subject to tax after all deductions (kobo) */
    taxableIncome: bigint;
    /** Total tax liability (kobo) */
    taxLiability: bigint;
    /** Effective tax rate as a percentage (e.g. 14.8) */
    effectiveRate: number;
    /** Breakdown by tax band */
    breakdown: TaxBandResult[];
    /** Whether minimum tax rule was applied */
    minimumTaxApplied: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Multiply a bigint by a decimal rate.
 * We scale the rate by 1_000_000 to preserve precision, then divide back.
 */
function applyRate(amount: bigint, rate: number): bigint {
    const SCALE = 1_000_000n;
    const scaledRate = BigInt(Math.round(rate * Number(SCALE)));
    return (amount * scaledRate) / SCALE;
}

/**
 * Calculate CRA (Consolidated Relief Allowance).
 *
 * CRA = higher of (fixedAmount OR craGrossPercentage × gross) + craAdditionalPercentage × gross
 *
 * For standard PITA (2020–2025):
 *   CRA = max(₦200,000, 1% of gross) + 20% of gross
 *
 * For 2026+: returns 0 (all CRA config values are 0).
 */
function computeCRA(grossIncome: bigint, config: TaxBandConfig): bigint {
    // If CRA is disabled (2026+), skip computation
    if (config.craFixedAmount === 0n && config.craGrossPercentage === 0 && config.craAdditionalPercentage === 0) {
        return 0n;
    }
    const fixedComponent = config.craFixedAmount;
    const percentComponent = applyRate(grossIncome, config.craGrossPercentage);
    const higherOfFixed = fixedComponent > percentComponent ? fixedComponent : percentComponent;
    const additionalComponent = applyRate(grossIncome, config.craAdditionalPercentage);
    return higherOfFixed + additionalComponent;
}

/**
 * Calculate Rent Relief (2026+ only).
 *
 * Rent Relief = 20% of annual rent paid, capped at config.maxRentRelief.
 * Returns 0 if rent relief is not enabled for the year.
 */
function computeRentRelief(annualRentPaid: bigint, config: TaxBandConfig): bigint {
    if (!config.rentReliefEnabled || annualRentPaid <= 0n) {
        return 0n;
    }
    const twentyPercent = applyRate(annualRentPaid, 0.20);
    return twentyPercent > config.maxRentRelief ? config.maxRentRelief : twentyPercent;
}

/**
 * Apply PITA graduated tax bands to taxable income.
 */
function applyBands(taxableIncome: bigint, bands: TaxBand[]): { breakdown: TaxBandResult[]; totalTax: bigint } {
    const breakdown: TaxBandResult[] = [];
    let remaining = taxableIncome;
    let totalTax = 0n;

    for (const band of bands) {
        if (remaining <= 0n) {
            breakdown.push({
                label: band.label,
                rate: band.rate,
                taxableInBand: 0n,
                taxInBand: 0n,
            });
            continue;
        }

        const taxableInBand = remaining < band.limit ? remaining : band.limit;
        const taxInBand = applyRate(taxableInBand, band.rate);

        breakdown.push({
            label: band.label,
            rate: band.rate,
            taxableInBand,
            taxInBand,
        });

        totalTax += taxInBand;
        remaining -= taxableInBand;
    }

    return { breakdown, totalTax };
}

// ─── Main Function ───────────────────────────────────────

export function computeTax(input: TaxComputationInput): TaxComputationResult {
    const { grossIncome, reliefs = [], taxYear, annualRentPaid = 0n } = input;

    // Look up the tax band config for the year
    const config = TAX_BANDS[taxYear];
    if (!config) {
        throw new Error(
            `No tax band configuration found for year ${taxYear}. Supported years: ${Object.keys(TAX_BANDS).join(', ')}`
        );
    }

    // Handle zero or negative income
    if (grossIncome <= 0n) {
        return {
            grossIncome,
            cra: 0n,
            rentRelief: 0n,
            totalReliefs: 0n,
            taxableIncome: 0n,
            taxLiability: 0n,
            effectiveRate: 0,
            breakdown: config.bands.map((b) => ({
                label: b.label,
                rate: b.rate,
                taxableInBand: 0n,
                taxInBand: 0n,
            })),
            minimumTaxApplied: false,
        };
    }

    // 1. Calculate CRA (0 for 2026+)
    const cra = computeCRA(grossIncome, config);

    // 2. Calculate Rent Relief (2026+ only)
    const rentRelief = computeRentRelief(annualRentPaid, config);

    // 3. Sum additional reliefs (pension, NHF, etc.)
    const totalReliefs = reliefs.reduce((sum, r) => sum + r.amount, 0n);

    // 4. Compute taxable income (gross - CRA - rentRelief - reliefs), floored at 0
    const deductions = cra + rentRelief + totalReliefs;
    const taxableIncome = grossIncome > deductions ? grossIncome - deductions : 0n;

    // 5. Apply graduated bands
    const { breakdown, totalTax } = applyBands(taxableIncome, config.bands);

    // 6. Apply minimum tax rule
    //    If the computed tax is less than minimumTaxRate × gross, use the minimum instead
    const minimumTax = applyRate(grossIncome, config.minimumTaxRate);
    let taxLiability: bigint;
    let minimumTaxApplied = false;

    if (totalTax < minimumTax && taxableIncome > 0n) {
        taxLiability = minimumTax;
        minimumTaxApplied = true;
    } else {
        taxLiability = totalTax;
    }

    // 7. Effective rate = (tax / gross) × 100
    const effectiveRate =
        grossIncome > 0n
            ? Number((taxLiability * 10000n) / grossIncome) / 100
            : 0;

    return {
        grossIncome,
        cra,
        rentRelief,
        totalReliefs,
        taxableIncome,
        taxLiability,
        effectiveRate,
        breakdown,
        minimumTaxApplied,
    };
}
