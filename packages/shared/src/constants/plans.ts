/**
 * Subscription Plans
 * Paystack plan codes will be filled in after creating plans in the Paystack dashboard.
 */

export interface PlanConfig {
    id: string;
    name: string;
    /** Price in kobo per year */
    priceKobo: bigint;
    /** Display price in NGN */
    displayPrice: string;
    /** Maximum number of tax years */
    maxTaxYears: number;
    /** Maximum statement uploads per tax year */
    maxStatementsPerYear: number;
    /** Paystack plan code (filled after dashboard setup) */
    paystackPlanCode: string;
    features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
    FREE: {
        id: 'free',
        name: 'Free',
        priceKobo: 0n,
        displayPrice: '₦0',
        maxTaxYears: 1,
        maxStatementsPerYear: 3,
        paystackPlanCode: '',
        features: [
            '1 tax year',
            'Up to 3 months of statements',
            'Basic tax computation',
            'PDF report download',
        ],
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        priceKobo: 1500000n, // ₦15,000
        displayPrice: '₦15,000/year',
        maxTaxYears: 5,
        maxStatementsPerYear: 12,
        paystackPlanCode: '', // Fill from Paystack dashboard
        features: [
            'Up to 5 tax years',
            'All 12 months per year',
            'AI-assisted annotations',
            'Excel workbook export',
            'Priority support',
        ],
    },
    BUSINESS: {
        id: 'business',
        name: 'Business',
        priceKobo: 4500000n, // ₦45,000
        displayPrice: '₦45,000/year',
        maxTaxYears: 10,
        maxStatementsPerYear: 12,
        paystackPlanCode: '', // Fill from Paystack dashboard
        features: [
            'Up to 10 tax years',
            'All 12 months per year',
            'AI-assisted annotations',
            'Accountant delegation',
            'Audit trail reports',
            'Dedicated support',
        ],
    },
};
