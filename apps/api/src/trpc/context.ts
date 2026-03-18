import type { FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { decode } from 'next-auth/jwt';

export async function createContext({ req }: { req: FastifyRequest }) {
    let user: { id: string; email: string } | null = null;
    let admin: { id: string; email: string; role: string } | null = null;

    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
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
            // Invalid NextAuth token
        }

        // If not a valid NextAuth token, try decoding as Admin token
        if (!user) {
            try {
                const { jwtVerify } = await import('jose');
                const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'fallback_admin_secret');
                const { payload } = await jwtVerify(token, secret);
                if (payload && payload.adminId) {
                    admin = {
                        id: payload.adminId as string,
                        email: payload.email as string,
                        role: payload.role as string,
                    };
                }
            } catch {
                // Invalid admin token
            }
        }
    }

    return {
        prisma,
        user,
        admin,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
