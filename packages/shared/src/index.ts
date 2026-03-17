// @banklens/shared — Shared types, schemas, and utilities
// This package is imported by both the frontend (apps/web) and backend (apps/api)

// Constants
export { TAX_BANDS, type TaxBandConfig, type TaxBand } from './constants/tax-bands';
export { SUPPORTED_BANKS, type BankConfig } from './constants/banks';
export {
    WORKSPACE_UNLOCK_PRICE,
    ADDITIONAL_BANK_PRICE,
    CREDIT_PACKAGES,
    FREE_TIER_UNLOCKED_MONTHS,
    FREE_TIER_MAX_BANKS,
    FREE_TIER_STATEMENT_CREDITS,
    STANDARD_STATEMENT_CREDITS,
    type WorkspacePricing,
    type CreditPackage,
} from './constants/plans';

// Schemas (Zod)
export {
    createWorkspaceSchema,
    lockWorkspaceSchema,
    workspaceStatusSchema,
    type CreateWorkspaceInput,
    type LockWorkspaceInput,
    type WorkspaceStatus,
} from './schemas/workspace.schema';

export {
    transactionSchema,
    createTransactionSchema,
    bulkInsertTransactionsSchema,
    type TransactionData,
    type CreateTransactionInput,
    type BulkInsertTransactionsInput,
} from './schemas/transaction.schema';

export {
    taxableStatusSchema,
    taxCategorySchema,
    annotationStatusSchema,
    createAnnotationSchema,
    updateAnnotationSchema,
    bulkAnnotationSchema,
    type TaxableStatus,
    type TaxCategory,
    type AnnotationStatus,
    type CreateAnnotationInput,
    type UpdateAnnotationInput,
    type BulkAnnotationInput,
} from './schemas/annotation.schema';

// Tax Engine
export {
    computeTax,
    type TaxComputationInput,
    type TaxComputationResult,
    type TaxBandResult,
    type Relief,
} from './tax-engine';

// Utils
export { formatNGN, koboToNaira } from './utils/format-currency';
