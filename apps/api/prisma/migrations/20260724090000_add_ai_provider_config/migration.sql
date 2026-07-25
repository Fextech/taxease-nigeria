CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'NVIDIA_NIM', 'OPENROUTER');

CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderConfig_provider_key" ON "AiProviderConfig"("provider");
CREATE INDEX "AiProviderConfig_isActive_idx" ON "AiProviderConfig"("isActive");
