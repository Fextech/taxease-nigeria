CREATE INDEX "Statement_workspaceId_deletedAt_month_idx"
ON "Statement"("workspaceId", "deletedAt", "month");

CREATE INDEX "Transaction_statementId_deletedAt_transactionDate_idx"
ON "Transaction"("statementId", "deletedAt", "transactionDate");

CREATE INDEX "Annotation_status_deletedAt_idx"
ON "Annotation"("status", "deletedAt");

CREATE INDEX "Annotation_taxableStatus_status_deletedAt_idx"
ON "Annotation"("taxableStatus", "status", "deletedAt");
