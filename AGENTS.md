# BankLens Nigeria - AI Agent Instructions

This file provides crucial architectural context and rules for AI agents (Warp, Cursor, Copilot, Antigravity) working within the BankLens Nigeria monorepo. **Always read this file before suggesting large architectural changes.**

## Monorepo Architecture
Turborepo managed with **pnpm 9.x** (Node ≥ 20).
- **apps/web**: Next.js 16 (App Router, React 19). Runs on `:3000`.
- **apps/api**: Fastify + tRPC server. Runs on `:3001`. Handles DB operations.
- **apps/worker**: BullMQ worker connecting to Redis to process background jobs (`parse-statement`).
- **apps/parser**: Python FastAPI service on `:8000` (virtualenv in `.venv/`). Uses `pdfplumber` and Gemini AI for PDF extraction.
- **packages/shared**: Zod schemas, tax computation logic, constants.

---

## 🛑 Frontend Stack & UI Rules (CRITICAL)

### CSS & Component Library
1. **Tailwind v4 + shadcn/ui**: We use `shadcn/ui` with Tailwind v4. Components are located in `apps/web/components/ui/`.
2. **CSS Variables (OKLCH)**: Our brand colors are strictly defined in `apps/web/app/globals.css`. 
   - We use shadcn's OKLCH variable system (`--primary`, `--secondary`).
   - We also maintain legacy aliases (`--te-mint`: `#23494d`, `--te-gold`: `#f0a030`).
   - **Do not hardcode hex colors in Tailwind classes.** Use `text-primary`, `bg-[var(--te-mint)]`, etc.
3. **Icons**: We use **Material Symbols Outlined** via a Google Fonts stylesheet in `layout.tsx`. Use `<span className="material-symbols-outlined">icon_name</span>`. Do not install `lucide-react` or other icon sets.

### State Management
1. **Client State**: We use **Zustand** (`zustand@5`), specifically the `persist` middleware, for global UI state.
   - Example: `apps/web/stores/workspace-store.ts` tracks the `activeWorkspaceId`.
2. **Server State**: We are transitioning from native `fetch()` to **tRPC / React Query**. (Note: Many pages still use manual `fetch()`. If modifying these, consider upgrading them to tRPC `useQuery` where appropriate).

---

## 🛑 Backend & Database Rules (CRITICAL)

### Database (Prisma)
1. **Monetary Values**: ALL money is stored and computed in **kobo (BigInt)** to prevent floating-point errors. Use `formatNGN()` from `@banklens/shared` for display.
2. **Soft Deletes**: We NEVER permanently delete records. 
   - `Workspace`, `Statement`, `Transaction`, and `Annotation` all use a `deletedAt DateTime?` field.
   - We have a **Prisma Client Extension** in both `api/` and `web/` that provides `.softDelete()` and `.softDeleteMany()`. **Always use these instead of `.delete()`**.
   - The extension automatically filters out deleted records from standard `.findMany()` queries.

### File Uploads & S3 Pipeline
Our S3 upload pipeline is highly specific due to CORS and Next.js stream limitations. **Do not alter this flow without understanding it:**
1. **Frontend Uploader**: We use **Uppy.js** (`@uppy/core`, `@uppy/aws-s3`) in `StatementUploader.tsx` for direct-to-S3 uploads to bypass Vercel/Next.js payload limits.
2. **S3 ETag Bug**: Uppy's default S3 plugin fails silently if the S3 bucket CORS does not expose the `ETag` header. We have a **custom `uploadPartBytes` implementation** in our Uppy config to resolve the promise even without an ETag. Do not remove this.
3. **Password-Protected PDFs**:
   - `StatementUploader` detects encrypted PDFs locally before uploading.
   - Validation is done via `POST /api/statements/check`. 
   - **CRITICAL FETCH BUG**: Never pass a raw `File` blob directly into `FormData` for a `fetch()` request if Uppy still needs to upload that exact same file later. Next.js `fetch` will permanently exhaust the Blob's read stream, causing Uppy's XMLHttpRequest to S3 to silently hang forever. Always clone the file first: `new File([file], ...)` or pass a `File` ref.
4. **Proxying Streams**: When `apps/web/app/api/...` needs to forward a multipart file to the Python `parser` service, it acts as a **raw Node.js stream reverse-proxy**. It pipes `request.body` directly to avoiding corrupting multipart boundaries. Do not attempt to parse and reconstruct `FormData` in the Next.js API route.

---

## Workflow Commands
- Start all apps: `pnpm dev`
- Run linting: `pnpm lint` && `pnpm typecheck`
- Prisma commands must run from the API app: `pnpm --filter @banklens/api exec prisma studio`
