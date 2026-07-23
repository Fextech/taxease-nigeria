FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# ─── Builder stage ────────────────────────────────────────
FROM base AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies — include api package.json so prisma is available
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Prisma needs both URLs at build time to validate the schema
ARG DATABASE_URL
ARG DATABASE_URL_UNPOOLED
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_URL_UNPOOLED=$DATABASE_URL_UNPOOLED

# These are initialized at module-level in API routes (Resend, NextAuth, S3, Paystack)
# They only exist in this builder stage and are NOT present in the final image
ARG AUTH_SECRET
ARG RESEND_API_KEY
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION
ARG AWS_S3_BUCKET_NAME
ARG PAYSTACK_SECRET_KEY
ARG NEXT_PUBLIC_API_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
ENV AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
ENV AWS_REGION=$AWS_REGION
ENV AWS_S3_BUCKET_NAME=$AWS_S3_BUCKET_NAME
ENV PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Generate Prisma client BEFORE building (web imports from api/src/db/prisma.ts)
RUN pnpm --filter @banklens/api exec prisma generate --schema ./prisma/schema.prisma

# Build shared package first, then the web app
RUN pnpm --filter @banklens/shared build && pnpm --filter @banklens/web build

# ─── Runner stage ─────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

# next.config.ts output: 'standalone' copies only what's needed
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Cloud Run injects PORT; Next.js standalone server reads it automatically
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
