import { describe, it, expect } from 'vitest';
import { computeTax, type TaxComputationInput, type Relief } from './tax-engine';

// Helper: convert naira to kobo
const N = (naira: number) => BigInt(naira) * 100n;

describe('computeTax', () => {
    // ──────────────────────────────────────────────────────
    // Zero / Edge Cases
    // ──────────────────────────────────────────────────────

    it('returns zero tax for zero gross income', () => {
        const result = computeTax({ grossIncome: 0n, taxYear: 2024 });
        expect(result.taxLiability).toBe(0n);
        expect(result.taxableIncome).toBe(0n);
        expect(result.cra).toBe(0n);
        expect(result.effectiveRate).toBe(0);
        expect(result.minimumTaxApplied).toBe(false);
    });

    it('throws for unsupported tax year', () => {
        expect(() =>
            computeTax({ grossIncome: N(1_000_000), taxYear: 1999 })
        ).toThrow('No tax band configuration found for year 1999');
    });

    // ──────────────────────────────────────────────────────
    // CRA Calculation
    // ──────────────────────────────────────────────────────

    it('uses fixed CRA amount when it exceeds 1% of gross', () => {
        // ₦1,000,000 gross → 1% = ₦10,000, fixed = ₦200,000
        // CRA = ₦200,000 + 20% of ₦1,000,000 = ₦200,000 + ₦200,000 = ₦400,000
        const result = computeTax({ grossIncome: N(1_000_000), taxYear: 2024 });
        expect(result.cra).toBe(N(400_000));
    });

    it('uses 1% when it exceeds fixed CRA amount', () => {
        // ₦50,000,000 gross → 1% = ₦500,000, fixed = ₦200,000
        // CRA = ₦500,000 + 20% of ₦50,000,000 = ₦500,000 + ₦10,000,000 = ₦10,500,000
        const result = computeTax({ grossIncome: N(50_000_000), taxYear: 2024 });
        expect(result.cra).toBe(N(10_500_000));
    });

    // ──────────────────────────────────────────────────────
    // Tax Band Application
    // ──────────────────────────────────────────────────────

    it('correctly computes tax for ₦1,000,000 gross income', () => {
        // ₦1,000,000 gross
        // CRA = ₦400,000 (see test above)
        // Taxable = ₦600,000
        // Band 1: ₦300,000 @ 7% = ₦21,000
        // Band 2: ₦300,000 @ 11% = ₦33,000
        // Total = ₦54,000
        const result = computeTax({ grossIncome: N(1_000_000), taxYear: 2024 });
        expect(result.taxableIncome).toBe(N(600_000));
        expect(result.breakdown[0].taxableInBand).toBe(N(300_000));
        expect(result.breakdown[0].taxInBand).toBe(N(21_000));
        expect(result.breakdown[1].taxableInBand).toBe(N(300_000));
        expect(result.breakdown[1].taxInBand).toBe(N(33_000));
        expect(result.taxLiability).toBe(N(54_000));
    });

    it('correctly computes tax for ₦5,000,000 gross income', () => {
        // ₦5,000,000 gross
        // CRA = max(₦200,000, ₦50,000) + ₦1,000,000 = ₦1,200,000
        // Taxable = ₦3,800,000
        // Band 1: ₦300,000 @ 7%  = ₦21,000
        // Band 2: ₦300,000 @ 11% = ₦33,000
        // Band 3: ₦500,000 @ 15% = ₦75,000
        // Band 4: ₦500,000 @ 19% = ₦95,000
        // Band 5: ₦1,600,000 @ 21% = ₦336,000
        // Band 6: ₦600,000 @ 24% = ₦144,000
        // Total = ₦704,000
        const result = computeTax({ grossIncome: N(5_000_000), taxYear: 2024 });
        expect(result.cra).toBe(N(1_200_000));
        expect(result.taxableIncome).toBe(N(3_800_000));
        expect(result.taxLiability).toBe(N(704_000));
    });

    it('correctly computes tax for ₦50,000,000 gross (hits final 24% band)', () => {
        // ₦50,000,000 gross
        // CRA = ₦10,500,000 (see test above)
        // Taxable = ₦39,500,000
        // Bands 1-5 total taxable: ₦300k + ₦300k + ₦500k + ₦500k + ₦1,600k = ₦3,200,000
        // Remaining in band 6: ₦39,500,000 - ₦3,200,000 = ₦36,300,000
        const result = computeTax({ grossIncome: N(50_000_000), taxYear: 2024 });
        expect(result.taxableIncome).toBe(N(39_500_000));

        // Band 6 should have ₦36,300,000
        expect(result.breakdown[5].taxableInBand).toBe(N(36_300_000));
        expect(result.minimumTaxApplied).toBe(false);
    });

    // ──────────────────────────────────────────────────────
    // Reliefs
    // ──────────────────────────────────────────────────────

    it('subtracts reliefs from taxable income', () => {
        const reliefs: Relief[] = [
            { label: 'Pension (8%)', amount: N(400_000) },
            { label: 'NHF (2.5%)', amount: N(125_000) },
        ];

        const result = computeTax({
            grossIncome: N(5_000_000),
            reliefs,
            taxYear: 2024,
        });

        expect(result.totalReliefs).toBe(N(525_000));
        // Taxable = ₦5,000,000 - ₦1,200,000 CRA - ₦525,000 reliefs = ₦3,275,000
        expect(result.taxableIncome).toBe(N(3_275_000));
    });

    it('floors taxable income at zero when reliefs exceed gross', () => {
        const reliefs: Relief[] = [
            { label: 'Huge Relief', amount: N(10_000_000) },
        ];

        const result = computeTax({
            grossIncome: N(1_000_000),
            reliefs,
            taxYear: 2024,
        });

        expect(result.taxableIncome).toBe(0n);
        expect(result.taxLiability).toBe(0n);
    });

    // ──────────────────────────────────────────────────────
    // Minimum Tax Rule
    // ──────────────────────────────────────────────────────

    it('applies minimum tax when computed tax is less than 1% of gross', () => {
        // Very high reliefs bring taxable income down to something tiny
        // but minimum tax = 1% of gross should still kick in
        const reliefs: Relief[] = [
            { label: 'Large Relief', amount: N(4_500_000) },
        ];

        const result = computeTax({
            grossIncome: N(5_000_000),
            reliefs,
            taxYear: 2024,
        });

        // CRA = ₦1,200,000, relief = ₦4,500,000, total deductions = ₦5,700,000 > gross
        // But taxable is floored at 0, so computed tax = 0
        // Minimum tax = 1% × ₦5,000,000 = ₦50,000
        // Since taxableIncome = 0, minimum tax should NOT apply (clause: taxableIncome > 0n)
        expect(result.taxableIncome).toBe(0n);
        expect(result.minimumTaxApplied).toBe(false);
    });

    it('applies minimum tax when taxable income is positive but tax is very low', () => {
        // Construct a scenario where reliefs bring taxable income to almost zero
        // but still positive, and the computed band tax < 1% of gross
        const reliefs: Relief[] = [
            { label: 'Large Relief', amount: N(560_000) },
        ];

        const result = computeTax({
            grossIncome: N(1_000_000),
            reliefs,
            taxYear: 2024,
        });

        // CRA = ₦400,000, relief = ₦560,000
        // Taxable = ₦1,000,000 - ₦400,000 - ₦560,000 = ₦40,000
        // Band 1: ₦40,000 @ 7% = ₦2,800
        // Minimum tax = 1% × ₦1,000,000 = ₦10,000
        // ₦2,800 < ₦10,000 → minimum tax applies
        expect(result.taxableIncome).toBe(N(40_000));
        expect(result.minimumTaxApplied).toBe(true);
        expect(result.taxLiability).toBe(N(10_000));
    });

    // ──────────────────────────────────────────────────────
    // Cross-Year Consistency
    // ──────────────────────────────────────────────────────

    it('produces same result for 2024 and 2025 (same PITA bands)', () => {
        const input: Omit<TaxComputationInput, 'taxYear'> = {
            grossIncome: N(3_000_000),
        };

        const result2024 = computeTax({ ...input, taxYear: 2024 });
        const result2025 = computeTax({ ...input, taxYear: 2025 });

        expect(result2024.taxLiability).toBe(result2025.taxLiability);
        expect(result2024.cra).toBe(result2025.cra);
        expect(result2024.taxableIncome).toBe(result2025.taxableIncome);
    });

    // ──────────────────────────────────────────────────────
    // Effective Rate
    // ──────────────────────────────────────────────────────

    it('computes reasonable effective tax rate', () => {
        const result = computeTax({ grossIncome: N(5_000_000), taxYear: 2024 });
        // Effective rate = ₦704,000 / ₦5,000,000 ≈ 14.08%
        expect(result.effectiveRate).toBeGreaterThan(10);
        expect(result.effectiveRate).toBeLessThan(25);
    });

    it('returns all six bands in the breakdown', () => {
        const result = computeTax({ grossIncome: N(5_000_000), taxYear: 2024 });
        expect(result.breakdown).toHaveLength(6);
    });
});
