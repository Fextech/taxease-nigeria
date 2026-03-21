# Security Update Implementation Plan

## Purpose

This document turns the production security review into an implementation plan. It is intended to guide remediation work, verification, rollout, and regression testing before BankLens Nigeria goes live.

The findings below are derived from the current codebase state and reference the exact files and line locations identified during review.

## Remediation Principles

1. Fix authentication and authorization flaws before lower-severity hardening.
2. Remove production data exposure paths before expanding observability.
3. Prefer server-validated session state over client-stored bearer tokens.
4. Add regression tests for every security bug fixed.
5. Re-run static checks and dependency audit after each security patch set.

## Priority Order

1. Critical auth token issues
2. High-severity access control and data exposure issues
3. Medium-severity privilege separation and XSS issues
4. Dependency and platform hardening
5. Final verification and production checklist

---

## 1. Critical: Remove Admin JWT Fallback Secret

### Finding

The admin auth flow falls back to a hard-coded secret when `ADMIN_JWT_SECRET` is missing, allowing forged admin tokens in a misconfigured environment.

### References

- [apps/api/src/routers/admin/auth.ts:82](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/auth.ts#L82)
- [apps/api/src/trpc/context.ts:34](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/context.ts#L34)

### Implementation Plan

1. Replace the fallback logic with a strict environment requirement.
2. Introduce a shared helper that loads and validates `ADMIN_JWT_SECRET` once.
3. Fail fast on server boot if the secret is absent or too weak.
4. Ensure both token issuance and verification use the same helper.
5. Add a clear startup error message so the app never silently falls back.

### Files To Change

- [apps/api/src/routers/admin/auth.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/auth.ts)
- [apps/api/src/trpc/context.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/context.ts)
- Potential new helper file under [apps/api/src/lib](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/lib)
- Potential startup validation touchpoint in [apps/api/src/server.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/server.ts)

### Verification

1. Boot the API without `ADMIN_JWT_SECRET` and confirm startup fails.
2. Boot with a valid secret and confirm admin login still works.
3. Confirm forged tokens signed with the old fallback string are rejected.

---

## 2. High: Enforce Admin Session Revocation and Expiry

### Finding

Admin sessions are stored and revocable in the database, but request authentication trusts JWT signature alone and does not check session revocation or expiry.

### References

- [apps/api/prisma/schema.prisma:300](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L300)
- [apps/api/src/routers/admin/settings.ts:93](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts#L93)
- [apps/api/src/trpc/context.ts:31](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/context.ts#L31)

### Implementation Plan

1. Treat the database `AdminSession` row as authoritative.
2. During admin token verification, load the corresponding session record by token or session ID.
3. Reject admin requests when:
   - the session is missing,
   - `revokedAt` is set,
   - `expiresAt` is in the past,
   - the admin user is inactive or deleted.
4. Update `lastActiveAt` on valid requests, with throttling to avoid excessive writes.
5. Consider changing JWT payload to include a `sessionId` instead of using the raw token as the database lookup key.
6. Ensure `revokeSession` invalidates current authorization immediately.
7. Add logout and “revoke all other sessions” support if absent.

### Files To Change

- [apps/api/src/trpc/context.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/context.ts)
- [apps/api/src/routers/admin/auth.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/auth.ts)
- [apps/api/src/routers/admin/settings.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts)
- [apps/api/prisma/schema.prisma](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma)

### Verification

1. Log in as admin and capture a valid token.
2. Revoke the session through admin settings.
3. Confirm the same token is immediately rejected on the next request.
4. Confirm expired sessions are denied even if the JWT is otherwise valid.

---

## 3. High: Remove the Debug Workspace Endpoint

### Finding

The temporary debug endpoint exposes global workspace and user email data to authenticated users and returns stack traces on failure.

### References

- [apps/web/app/api/debug-workspace/route.ts:20](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/debug-workspace/route.ts#L20)
- [apps/web/app/api/debug-workspace/route.ts:45](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/debug-workspace/route.ts#L45)

### Implementation Plan

1. Delete the endpoint entirely unless there is a strong operational need.
2. If temporary diagnostics are still required, gate them behind:
   - non-production environment checks,
   - explicit admin authorization,
   - redacted output,
   - no stack traces in responses.
3. Search the frontend and docs for any references to this endpoint and remove them.

### Files To Change

- [apps/web/app/api/debug-workspace/route.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/debug-workspace/route.ts)

### Verification

1. Confirm the route no longer exists in production build output, or returns `404`.
2. Confirm no client code depends on it.

---

## 4. High: Fix IDOR in Statement Listing

### Finding

The `list` action in `/api/statements/upload` returns statement metadata for any submitted `workspaceId` without checking ownership.

### References

- [apps/web/app/api/statements/upload/route.ts:160](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/statements/upload/route.ts#L160)

### Implementation Plan

1. Add the same workspace ownership validation used in `getUploadUrl` and `confirm` before listing statements.
2. Centralize workspace authorization logic in a helper to avoid drift across actions.
3. Review the entire route for other action-specific authorization gaps.
4. Add a regression test where User A requests User B’s workspace statements and receives `404` or `403`.

### Files To Change

- [apps/web/app/api/statements/upload/route.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/statements/upload/route.ts)

### Verification

1. Confirm own-workspace listing still succeeds.
2. Confirm cross-user workspace listing is denied.

---

## 5. High: Block Suspended or Deleted Users From Signing In

### Finding

Credential sign-in ignores `isSuspended` and `deletedAt`, allowing suspended or soft-deleted accounts to authenticate.

### References

- [apps/api/prisma/schema.prisma:24](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L24)
- [apps/api/prisma/schema.prisma:27](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L27)
- [apps/web/auth.ts:28](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/auth.ts#L28)

### Implementation Plan

1. Update credentials auth to reject users with:
   - `isSuspended === true`
   - `deletedAt !== null`
2. Review Google OAuth sign-in and session callbacks to enforce the same account-state rules.
3. Add a middleware or session-level recheck so already-issued sessions are invalidated when a user is suspended.
4. Decide on user-facing messaging:
   - generic denial for security,
   - or support-oriented suspended-account response.

### Files To Change

- [apps/web/auth.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/auth.ts)
- Potential middleware/session touchpoints in [apps/web/middleware.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/middleware.ts)

### Verification

1. Create a suspended user and confirm sign-in fails.
2. Suspend an already signed-in user and confirm protected routes are blocked on next request.

---

## 6. Medium: Implement Real Admin RBAC

### Finding

`adminProcedure` only checks that the caller is an authenticated admin. Most routes do not enforce role-specific authorization even though distinct admin roles exist.

### References

- [apps/api/prisma/schema.prisma:508](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L508)
- [apps/api/src/trpc/trpc.ts:25](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/trpc.ts#L25)
- [apps/api/src/routers/admin/users.ts:206](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/users.ts#L206)
- [apps/api/src/routers/admin/settings.ts:146](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts#L146)

### Implementation Plan

1. Define a route-to-role matrix for all admin capabilities.
2. Add reusable role-guard middleware, for example:
   - `adminProcedure`
   - `superAdminProcedure`
   - `operationsProcedure`
   - `supportProcedure`
   - `readOnlyProcedure`
3. Restrict sensitive actions such as:
   - revealing user emails,
   - gifting credits,
   - suspending or deleting users,
   - maintenance mode changes,
   - how-to content changes,
   - pricing changes,
   - queue flushes.
4. Review every router under `apps/api/src/routers/admin`.
5. Add audit entries for authorization failures if useful for forensic review.

### Files To Review And Potentially Change

- [apps/api/src/trpc/trpc.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/trpc/trpc.ts)
- [apps/api/src/routers/admin/users.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/users.ts)
- [apps/api/src/routers/admin/settings.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts)
- [apps/api/src/routers/admin/system.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/system.ts)
- [apps/api/src/routers/admin/billing.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/billing.ts)
- [apps/api/src/routers/admin/broadcast.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/broadcast.ts)
- [apps/api/src/routers/admin/support.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/support.ts)
- [apps/api/src/routers/admin/analytics.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/analytics.ts)
- [apps/api/src/routers/admin/audit.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/audit.ts)

### Verification

1. Test each role against allowed and disallowed routes.
2. Confirm `READ_ONLY_ANALYST` cannot trigger mutations.
3. Confirm only approved roles can access PII-revealing actions.

---

## 7. Medium: Eliminate Stored XSS in Admin-Managed HTML

### Finding

Admin-managed HTML is stored and later rendered with `dangerouslySetInnerHTML`, creating stored-XSS risk.

### References

- [apps/api/src/routers/admin/settings.ts:146](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts#L146)
- [apps/api/src/routers/admin/settings.ts:214](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts#L214)
- [apps/web/app/maintenance/page.tsx:48](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/maintenance/page.tsx#L48)
- [apps/web/components/HowToGuideModal.tsx:83](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/components/HowToGuideModal.tsx#L83)

### Implementation Plan

1. Decide whether raw HTML is truly required.
2. Preferred option: replace raw HTML storage with a safer structured format such as Markdown or typed content blocks.
3. If HTML must remain supported:
   - sanitize on write using a robust allowlist sanitizer,
   - sanitize again on read if needed,
   - strip script tags, inline event handlers, `javascript:` URLs, iframes, and dangerous CSS.
4. Apply a CSP that reduces blast radius for injected markup.
5. Restrict who can edit these fields through RBAC.
6. Audit any other `dangerouslySetInnerHTML` usage across the repo.

### Files To Change

- [apps/api/src/routers/admin/settings.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/settings.ts)
- [apps/web/app/maintenance/page.tsx](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/maintenance/page.tsx)
- [apps/web/components/HowToGuideModal.tsx](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/components/HowToGuideModal.tsx)
- Potential shared sanitizer helper under `apps/web/lib` or `apps/api/src/lib`

### Verification

1. Submit payloads such as `<script>`, `onerror=`, and `javascript:` links and confirm they are neutralized.
2. Confirm legitimate formatting still renders correctly.

---

## 8. Medium: Move Admin Auth Away From Local Storage and Script-Readable Cookies

### Finding

Admin bearer tokens are stored in `localStorage` and set via client-side cookies, making token theft trivial if any admin-side XSS occurs.

### References

- [apps/admin/stores/admin-store.ts:30](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/stores/admin-store.ts#L30)
- [apps/admin/app/providers.tsx:21](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/app/providers.tsx#L21)
- [apps/admin/app/login/page.tsx:49](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/app/login/page.tsx#L49)

### Implementation Plan

1. Move admin auth to HttpOnly, Secure, SameSite cookies set server-side.
2. Stop storing bearer tokens in `localStorage` entirely.
3. Stop reading auth from JS-managed storage in the tRPC client.
4. Update middleware to rely on server-managed cookies only.
5. Consider CSRF protection for admin mutations once cookie auth is adopted.
6. Add logout endpoint that clears the cookie and revokes the session.

### Files To Change

- [apps/admin/stores/admin-store.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/stores/admin-store.ts)
- [apps/admin/app/providers.tsx](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/app/providers.tsx)
- [apps/admin/app/login/page.tsx](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/app/login/page.tsx)
- [apps/admin/app/totp-verify/page.tsx](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/app/totp-verify/page.tsx)
- [apps/admin/middleware.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/middleware.ts)
- API auth/session routes in [apps/api/src/routers/admin/auth.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/admin/auth.ts)

### Verification

1. Confirm no admin token appears in `localStorage`, `sessionStorage`, or readable cookies.
2. Confirm admin navigation and tRPC requests still authenticate correctly.
3. Confirm logout clears server-side session state.

---

## 9. Medium: Bind Payment Verification to the Authenticated User

### Finding

Payment verification acts on any transaction reference without confirming ownership by the current user.

### References

- [apps/web/app/api/billing/route.ts:189](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/billing/route.ts#L189)

### Implementation Plan

1. Require `txn.userId === session.user.id` before verifying or applying effects.
2. Validate that referenced workspace IDs in transaction metadata also belong to the same user.
3. Wrap verification side effects in a database transaction where appropriate.
4. Audit the API-side billing router for the same logical issue and keep parity.
5. Consider moving verification to a webhook-driven flow so the server, not the client, finalizes state changes.

### Files To Change

- [apps/web/app/api/billing/route.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/app/api/billing/route.ts)
- Review parity with [apps/api/src/routers/billing.ts](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/src/routers/billing.ts)

### Verification

1. Confirm a user cannot verify another user’s payment reference.
2. Confirm valid self-owned references still process correctly.

---

## 10. Dependency Vulnerability Remediation

### Audit Result Summary

`pnpm audit --prod --audit-level high` reported 5 high-severity vulnerabilities and 15 total vulnerabilities.

### Notable High-Severity Packages

1. `undici` `<7.24.0`
2. `effect` `<3.20.0`
3. `fast-xml-parser` `<=5.5.5`

### Implementation Plan

1. Upgrade direct dependencies that pull vulnerable transitive packages.
2. Refresh lockfile after version bumps.
3. If upstream packages lag, use `pnpm overrides` as a temporary mitigation where safe.
4. Re-run audit after upgrades and document any remaining accepted risk.

### Likely Affected Areas

- [apps/worker/package.json](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/worker/package.json)
- [apps/api/package.json](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/package.json)
- [apps/web/package.json](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/web/package.json)
- [apps/admin/package.json](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/admin/package.json)
- [package.json](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/package.json)
- [pnpm-lock.yaml](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/pnpm-lock.yaml)

### Verification

1. Re-run `pnpm audit --prod --audit-level high`.
2. Re-run `pnpm typecheck`.
3. Re-run `pnpm lint` after fixing toolchain issues.

---

## 11. Cross-Cutting Hardening Tasks

These items were not all confirmed as direct exploitable bugs in code review, but they should be part of production remediation.

### Authentication Hardening

1. Add rate limiting for:
   - user sign-in,
   - password reset request,
   - MFA verify endpoints,
   - admin login,
   - admin TOTP verify.
2. Enforce account lockout or backoff using existing admin fields such as:
   - [apps/api/prisma/schema.prisma:286](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L286)
   - [apps/api/prisma/schema.prisma:287](/Users/mac/Studio/Fextech%20Apps/Taxease/taxease-nigeria/apps/api/prisma/schema.prisma#L287)
3. Store password reset tokens hashed instead of plaintext, so DB compromise does not immediately grant reset capability.
4. Review session invalidation after password change and MFA changes.

### Web Security Headers

1. Add `helmet` or equivalent hardening on the API server if not already registered.
2. Add CSP, `X-Frame-Options`, `Referrer-Policy`, and `X-Content-Type-Options` at the web and admin edges.
3. Review CORS policies for web, admin, parser, and API services.

### File Upload And Parser Hardening

1. Re-validate MIME type and file size server-side before issuing S3 upload URLs.
2. Consider scanning uploads before downstream processing.
3. Keep parser service non-public if possible and restrict it to private network access from trusted services.
4. Set strict S3 bucket policies and lifecycle rules for statement objects.

### Logging And Error Handling

1. Remove stack traces and internal error details from user-facing responses.
2. Normalize internal logging for auth failures, admin actions, and parser errors.
3. Ensure logs do not contain passwords, TOTP secrets, reset tokens, or raw statement contents.

---

## 12. Suggested Work Breakdown

### Phase 1: Immediate Security Blockers

1. Remove admin JWT fallback secret.
2. Enforce admin session revocation and expiry.
3. Delete debug workspace endpoint.
4. Fix statement list IDOR.
5. Block suspended/deleted user sign-in.

### Phase 2: Admin Surface Hardening

1. Implement real admin RBAC.
2. Move admin auth to HttpOnly cookie-based sessions.
3. Sanitize or replace admin-managed HTML content.

### Phase 3: Payments, Dependencies, and Hardening

1. Bind payment verification to authenticated user ownership.
2. Upgrade vulnerable dependencies.
3. Add rate limits and security headers.

### Phase 4: Verification and Release Readiness

1. Security regression tests
2. Full typecheck and lint
3. Dependency audit clean pass
4. Manual pen-test checklist
5. Production config review

---

## 13. Testing Plan

### Automated Tests To Add

1. Admin JWT verification fails without configured secret.
2. Revoked admin session is denied.
3. Expired admin session is denied.
4. Statement list refuses cross-user workspace access.
5. Suspended user cannot sign in.
6. Admin role restrictions are enforced per route.
7. Malicious maintenance/how-to HTML is sanitized.
8. Payment verification rejects foreign transaction references.

### Manual QA Scenarios

1. Normal user login, MFA setup, MFA verify, MFA disable
2. Admin login and TOTP flow
3. Admin session revoke and logout
4. Statement upload, listing, delete, parse lifecycle
5. Workspace unlock, credit purchase, bank add-on, payment verification
6. Maintenance page rendering
7. How-to guide rendering

---

## 14. Validation Commands

Run these after each remediation batch:

```bash
pnpm typecheck
pnpm lint
pnpm audit --prod --audit-level high
```

If new security tests are added, include the project-specific test commands as well.

---

## 15. Definition Of Done

This security update is complete when all of the following are true:

1. No critical or high findings remain open.
2. Admin auth uses no fallback secret and no script-readable token storage.
3. Revoked and expired admin sessions are enforced server-side.
4. Debug and IDOR data exposure paths are closed.
5. Suspended or deleted users cannot access the platform.
6. Admin RBAC is explicit and tested.
7. Admin-managed content cannot trigger stored XSS.
8. Payment verification is ownership-bound.
9. High-severity dependency findings are remediated or formally accepted with justification.
10. Verification checks pass and production env requirements are documented.
