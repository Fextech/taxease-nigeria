import type { FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { decode } from 'next-auth/jwt';
import { getAdminJwtSecret } from '../lib/admin-jwt.js';

/** Throttle: only write lastActiveAt when it's older than this many ms */
const LAST_ACTIVE_THROTTLE_MS = 60_000;

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;

    const prefix = `${name}=`;
    for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim();
        if (trimmed.startsWith(prefix)) {
            return decodeURIComponent(trimmed.slice(prefix.length));
        }
    }

    return null;
}

export async function createContext({ req }: { req: FastifyRequest }) {
    let user: { id: string; email: string } | null = null;
    let admin: { id: string; email: string; role: string } | null = null;
    let adminSessionToken: string | null = null;

    // Extract JWT from Authorization header for users, or fall back to admin cookie auth.
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookieToken = getCookieValue(req.headers.cookie, 'admin_token');
    const token = bearerToken ?? cookieToken;

    if (token) {
        try {
            // First try decoding as NextAuth user token
            const decoded = await decode({
                token,
                secret: process.env.NEXTAUTH_SECRET!,
                salt: '',
            });
            if (decoded?.userId && decoded?.email) {
                user = {
                    id: decoded.userId as string,
                    email: decoded.email as string,
                };
            }
        } catch {
            // Invalid NextAuth token — fall through to admin check
        }

        // If not a valid NextAuth token, try decoding as Admin token
        if (!user) {
            try {
                const { jwtVerify } = await import('jose');
                const secret = getAdminJwtSecret();
                const { payload } = await jwtVerify(token, secret);

                if (payload?.adminId) {
                    // Enforce session revocation: look up the live session row
                    const session = await prisma.adminSession.findFirst({
                        where: { token },
                        select: {
                            id: true,
                            revokedAt: true,
                            expiresAt: true,
                            lastActiveAt: true,
                            admin: {
                                select: { id: true, email: true, role: true, isActive: true },
                            },
                        },
                    });

                    const now = new Date();

                    if (
                        session &&
                        !session.revokedAt &&
                        session.expiresAt > now &&
                        session.admin.isActive
                    ) {
                        adminSessionToken = token;
                        admin = {
                            id: session.admin.id,
                            email: session.admin.email,
                            role: session.admin.role,
                        };

                        // Throttled lastActiveAt write (fire-and-forget)
                        const msSinceLastActive = session.lastActiveAt
                            ? now.getTime() - session.lastActiveAt.getTime()
                            : Infinity;

                        if (msSinceLastActive > LAST_ACTIVE_THROTTLE_MS) {
                            prisma.adminSession
                                .update({
                                    where: { id: session.id },
                                    data: { lastActiveAt: now },
                                })
                                .catch(() => {/* non-critical — ignore write failures */});
                        }
                    }
                    // If session is missing, revoked, or expired → admin stays null (rejected)
                }
            } catch {
                // Invalid admin token or missing ADMIN_JWT_SECRET (startup should have caught this)
            }
        }
    }

    return {
        prisma,
        user,
        admin,
        adminSessionToken,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
