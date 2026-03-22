/**
 * admin-jwt.ts
 *
 * Single source of truth for the ADMIN_JWT_SECRET.
 * Throws a clear startup error if the secret is missing or too weak,
 * preventing silent fallback to a known string.
 */

let cachedSecret: Uint8Array | null = null;

export function getAdminJwtSecret(): Uint8Array {
    if (cachedSecret) return cachedSecret;

    const raw = process.env.ADMIN_JWT_SECRET;

    if (!raw || raw.trim().length === 0) {
        throw new Error(
            '[FATAL] ADMIN_JWT_SECRET environment variable is not set. ' +
            'Generate one with: openssl rand -hex 32'
        );
    }

    if (raw.trim().length < 32) {
        throw new Error(
            '[FATAL] ADMIN_JWT_SECRET is too short (minimum 32 characters). ' +
            'Generate a secure value with: openssl rand -hex 32'
        );
    }

    cachedSecret = new TextEncoder().encode(raw.trim());
    return cachedSecret;
}
