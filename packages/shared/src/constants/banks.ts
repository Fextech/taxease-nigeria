/**
 * Supported Nigerian Banks
 * Each bank has a parser identifier and metadata for the parsing engine.
 */

export interface BankConfig {
    /** Internal parser ID */
    id: string;
    /** Display name */
    name: string;
    /** Whether a dedicated parser exists (vs generic fallback) */
    hasDedicatedParser: boolean;
    /** Common statement file patterns */
    filePatterns: string[];
}

export const SUPPORTED_BANKS: BankConfig[] = [
    {
        id: 'gtbank',
        name: 'Guaranty Trust Bank (GTBank)',
        hasDedicatedParser: true,
        filePatterns: ['gtbank', 'guaranty', 'gtb'],
    },
    {
        id: 'access',
        name: 'Access Bank',
        hasDedicatedParser: true,
        filePatterns: ['access', 'accessbank'],
    },
    {
        id: 'firstbank',
        name: 'First Bank of Nigeria',
        hasDedicatedParser: true,
        filePatterns: ['firstbank', 'first bank', 'fbn'],
    },
    {
        id: 'zenith',
        name: 'Zenith Bank',
        hasDedicatedParser: false,
        filePatterns: ['zenith'],
    },
    {
        id: 'uba',
        name: 'United Bank for Africa (UBA)',
        hasDedicatedParser: false,
        filePatterns: ['uba', 'united bank'],
    },
    {
        id: 'fcmb',
        name: 'First City Monument Bank (FCMB)',
        hasDedicatedParser: false,
        filePatterns: ['fcmb', 'first city'],
    },
    {
        id: 'stanbic',
        name: 'Stanbic IBTC',
        hasDedicatedParser: false,
        filePatterns: ['stanbic', 'ibtc'],
    },
    {
        id: 'sterling',
        name: 'Sterling Bank',
        hasDedicatedParser: false,
        filePatterns: ['sterling'],
    },
    {
        id: 'polaris',
        name: 'Polaris Bank',
        hasDedicatedParser: false,
        filePatterns: ['polaris', 'skye'],
    },
    {
        id: 'opay',
        name: 'OPay',
        hasDedicatedParser: false,
        filePatterns: ['opay'],
    },
    {
        id: 'moniepoint',
        name: 'Moniepoint',
        hasDedicatedParser: false,
        filePatterns: ['moniepoint'],
    },
    {
        id: 'kuda',
        name: 'Kuda Bank',
        hasDedicatedParser: false,
        filePatterns: ['kuda'],
    },
];
