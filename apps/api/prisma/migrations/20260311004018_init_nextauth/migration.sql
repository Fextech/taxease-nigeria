-- CreateEnum
CREATE TYPE "TaxYearStatus" AS ENUM ('ACTIVE', 'LOCKED', 'FILED');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'ANNOTATED', 'ERROR');

-- CreateEnum
CREATE TYPE "TaxableStatus" AS ENUM ('YES', 'NO', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TaxCategory" AS ENUM ('EMPLOYMENT', 'BUSINESS', 'RENTAL', 'INVESTMENT', 'FOREIGN', 'EXEMPT', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "AnnotationStatus" AS ENUM ('UNANNOTATED', 'IN_PROGRESS', 'COMPLETE', 'FLAGGED');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "DelegationRole" AS ENUM ('ACCOUNTANT', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "image" TEXT,
    "phone" TEXT,
    "professionalCategory" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "TaxYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalIncome" BIGINT NOT NULL DEFAULT 0,
    "totalTaxableIncome" BIGINT NOT NULL DEFAULT 0,
    "totalTaxLiability" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "bankName" TEXT,
    "originalFilename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileHash" TEXT,
    "parseStatus" "StatementStatus" NOT NULL DEFAULT 'UPLOADED',
    "confidenceScore" DOUBLE PRECISION,
    "rowCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "debitAmount" BIGINT NOT NULL DEFAULT 0,
    "creditAmount" BIGINT NOT NULL DEFAULT 0,
    "balance" BIGINT,
    "reference" TEXT,
    "channel" TEXT,
    "confidence" DOUBLE PRECISION,
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "taxableStatus" "TaxableStatus" NOT NULL DEFAULT 'NO',
    "taxableAmount" BIGINT,
    "taxCategory" "TaxCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "reason" TEXT,
    "reliefType" TEXT,
    "computedLiability" BIGINT NOT NULL DEFAULT 0,
    "status" "AnnotationStatus" NOT NULL DEFAULT 'UNANNOTATED',
    "notes" TEXT,
    "supportDocS3Key" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION,
    "annotatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "role" "DelegationRole" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "UserPlan" NOT NULL,
    "status" TEXT NOT NULL,
    "paystackCustomerCode" TEXT,
    "paystackSubscriptionCode" TEXT,
    "billingCycleStart" TIMESTAMP(3),
    "billingCycleEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_userId_taxYear_key" ON "Workspace"("userId", "taxYear");

-- CreateIndex
CREATE INDEX "Statement_workspaceId_idx" ON "Statement"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_workspaceId_month_key" ON "Statement"("workspaceId", "month");

-- CreateIndex
CREATE INDEX "Transaction_statementId_idx" ON "Transaction"("statementId");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Annotation_transactionId_key" ON "Annotation"("transactionId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
