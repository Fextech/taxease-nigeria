/**
 * Banklens Billing Model — Workspace + Credits
 *
 * Pricing:
 *  - Free tier: 3 months unlocked, 1 bank account, no payment required
 *  - Standard unlock (₦5,000/year): Full 12 months, 1 bank account, 15 statement uploads
 *  - Multi-account add-on (₦3,000 per additional account)
 *  - Statement credits: 10 credits = ₦2,500 (each statement = 1 credit)
 */

// ─── Workspace Billing ──────────────────────────────────

export interface WorkspacePricing {
    /** Price in kobo */
    priceKobo: bigint;
    /** Display price */
    displayPrice: string;
    /** Description */
    description: string;
}

/** Full workspace unlock — 12 months, 1 bank account, 15 uploads */
export const WORKSPACE_UNLOCK_PRICE: WorkspacePricing = {
    priceKobo: 500000n,       // ₦5,000
    displayPrice: '₦5,000',
    description: 'Full 12-month access (1 bank account, up to 15 statement uploads)',
};

/** Additional bank account for the same workspace */
export const ADDITIONAL_BANK_PRICE: WorkspacePricing = {
    priceKobo: 300000n,       // ₦3,000
    displayPrice: '₦3,000',
    description: 'Add another bank account to this tax year',
};

// ─── Statement Credits ──────────────────────────────────

export interface CreditPackage {
    /** Number of credits in this package */
    credits: number;
    /** Price in kobo */
    priceKobo: bigint;
    /** Display price */
    displayPrice: string;
    /** Price per credit in kobo */
    perCreditKobo: bigint;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        credits: 10,
        priceKobo: 250000n,    // ₦2,500
        displayPrice: '₦2,500',
        perCreditKobo: 25000n, // ₦250 each
    },
    {
        credits: 25,
        priceKobo: 500000n,    // ₦5,000
        displayPrice: '₦5,000',
        perCreditKobo: 20000n, // ₦200 each
    },
    {
        credits: 50,
        priceKobo: 875000n,    // ₦8,750
        displayPrice: '₦8,750',
        perCreditKobo: 17500n, // ₦175 each
    },
];

// ─── Free Tier Defaults ─────────────────────────────────

/** Months unlocked for free users (January, February, March) */
export const FREE_TIER_UNLOCKED_MONTHS = [1, 2, 3] as const;

/** Default bank account limit for free users */
export const FREE_TIER_MAX_BANKS = 1;

/** Default statement credits for free users */
export const FREE_TIER_STATEMENT_CREDITS = 3;

/** Default statement credits for Standard unlock */
export const STANDARD_STATEMENT_CREDITS = 15;
