/**
 * TaxEase Nigeria — PITA Tax Computation Engine
 *
 * Pure function. All monetary values are in kobo (1 NGN = 100 kobo).
 * Uses BigInt arithmetic throughout to avoid floating-point rounding errors.
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
}

export interface TaxComputationResult {
    /** Gross income before any deductions (kobo) */
    grossIncome: bigint;
    /** Consolidated Relief Allowance (kobo) */
    cra: bigint;
    /** Total additional reliefs applied (kobo) */
    totalReliefs: bigint;
    /** Income subject to tax after CRA + reliefs (kobo) */
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
 * For standard PITA (2020–2026):
 *   CRA = max(₦200,000, 1% of gross) + 20% of gross
 */
function computeCRA(grossIncome: bigint, config: TaxBandConfig): bigint {
    const fixedComponent = config.craFixedAmount;
    const percentComponent = applyRate(grossIncome, config.craGrossPercentage);
    const higherOfFixed = fixedComponent > percentComponent ? fixedComponent : percentComponent;
    const additionalComponent = applyRate(grossIncome, config.craAdditionalPercentage);
    return higherOfFixed + additionalComponent;
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
    const { grossIncome, reliefs = [], taxYear } = input;

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

    // 1. Calculate CRA
    const cra = computeCRA(grossIncome, config);

    // 2. Sum additional reliefs
    const totalReliefs = reliefs.reduce((sum, r) => sum + r.amount, 0n);

    // 3. Compute taxable income (gross - CRA - reliefs), floored at 0
    const deductions = cra + totalReliefs;
    const taxableIncome = grossIncome > deductions ? grossIncome - deductions : 0n;

    // 4. Apply graduated bands
    const { breakdown, totalTax } = applyBands(taxableIncome, config.bands);

    // 5. Apply minimum tax rule
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

    // 6. Effective rate = (tax / gross) × 100
    const effectiveRate =
        grossIncome > 0n
            ? Number((taxLiability * 10000n) / grossIncome) / 100
            : 0;

    return {
        grossIncome,
        cra,
        totalReliefs,
        taxableIncome,
        taxLiability,
        effectiveRate,
        breakdown,
        minimumTaxApplied,
    };
}
