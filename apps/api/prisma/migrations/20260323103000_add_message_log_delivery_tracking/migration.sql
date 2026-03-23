-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'DELIVERY_DELAYED',
    'OPENED',
    'CLICKED',
    'BOUNCED',
    'COMPLAINED',
    'FAILED',
    'SUPPRESSED',
    'NOT_APPLICABLE'
);

-- AlterTable
ALTER TABLE "BroadcastRecipient"
ADD COLUMN     "resendEmailId" TEXT,
ADD COLUMN     "deliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "lastEventType" TEXT,
ADD COLUMN     "lastEventAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "deliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "lastEventType" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_resendEmailId_key" ON "BroadcastRecipient"("resendEmailId");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_resendEmailId_idx" ON "BroadcastRecipient"("resendEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_resendEmailId_key" ON "DirectMessage"("resendEmailId");

-- CreateIndex
CREATE INDEX "DirectMessage_userId_createdAt_idx" ON "DirectMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_adminId_idx" ON "DirectMessage"("adminId");

-- CreateIndex
CREATE INDEX "DirectMessage_resendEmailId_idx" ON "DirectMessage"("resendEmailId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
