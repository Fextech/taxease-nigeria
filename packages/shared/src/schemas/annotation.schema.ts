import { z } from 'zod';

// ─── Enums (mirroring Prisma enums) ──────────────────────
export const taxableStatusSchema = z.enum(['YES', 'NO', 'PARTIAL']);
export type TaxableStatus = z.infer<typeof taxableStatusSchema>;

export const taxCategorySchema = z.enum([
    'EMPLOYMENT',
    'BUSINESS',
    'RENTAL',
    'INVESTMENT',
    'FOREIGN',
    'EXEMPT',
    'UNCLASSIFIED',
]);
export type TaxCategory = z.infer<typeof taxCategorySchema>;

export const annotationStatusSchema = z.enum([
    'UNANNOTATED',
    'IN_PROGRESS',
    'COMPLETE',
    'FLAGGED',
]);
export type AnnotationStatus = z.infer<typeof annotationStatusSchema>;

// ─── Create / Update Annotation ──────────────────────────
const annotationBaseSchema = z.object({
    transactionId: z.string().cuid(),
    taxableStatus: taxableStatusSchema,
    taxableAmount: z.bigint().nonnegative().optional(),
    taxCategory: taxCategorySchema.default('UNCLASSIFIED'),
    reason: z.string().max(500).optional(),
    reliefType: z.string().max(100).optional(),
    notes: z.string().max(2000).optional(),
});

export const createAnnotationSchema = annotationBaseSchema.refine(
    (data) => {
        // If PARTIAL, taxableAmount must be provided
        if (data.taxableStatus === 'PARTIAL' && data.taxableAmount === undefined) {
            return false;
        }
        return true;
    },
    {
        message: 'Taxable amount is required when status is PARTIAL',
        path: ['taxableAmount'],
    }
);

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;

export const updateAnnotationSchema = annotationBaseSchema
    .omit({ transactionId: true })
    .partial();

export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;

// ─── Bulk Annotation ─────────────────────────────────────
export const bulkAnnotationSchema = z.object({
    transactionIds: z.array(z.string().cuid()).min(1, 'Select at least one transaction'),
    taxableStatus: taxableStatusSchema,
    taxCategory: taxCategorySchema.optional(),
    reason: z.string().max(500).optional(),
});

export type BulkAnnotationInput = z.infer<typeof bulkAnnotationSchema>;
