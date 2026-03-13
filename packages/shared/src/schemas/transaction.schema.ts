import { z } from 'zod';

// ─── Transaction Schema (parsed data from bank statement) ─
export const transactionSchema = z.object({
    transactionDate: z.coerce.date(),
    valueDate: z.coerce.date().optional(),
    description: z.string().min(1, 'Description is required'),
    debitAmount: z.bigint().nonnegative().default(0n),
    creditAmount: z.bigint().nonnegative().default(0n),
    balance: z.bigint().optional(),
    reference: z.string().optional(),
    channel: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
});

export type TransactionData = z.infer<typeof transactionSchema>;

// ─── Create Transaction (manual entry) ───────────────────
export const createTransactionSchema = z.object({
    statementId: z.string().cuid(),
    transactionDate: z.coerce.date(),
    valueDate: z.coerce.date().optional(),
    description: z.string().min(1, 'Description is required'),
    debitAmount: z.bigint().nonnegative().default(0n),
    creditAmount: z.bigint().nonnegative().default(0n),
    balance: z.bigint().optional(),
    reference: z.string().optional(),
    channel: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// ─── Bulk Insert (from parser output) ────────────────────
export const bulkInsertTransactionsSchema = z.object({
    statementId: z.string().cuid(),
    transactions: z.array(transactionSchema).min(1, 'At least one transaction required'),
});

export type BulkInsertTransactionsInput = z.infer<typeof bulkInsertTransactionsSchema>;
