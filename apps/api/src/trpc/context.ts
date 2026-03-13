import type { FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { decode } from 'next-auth/jwt';

export async function createContext({ req }: { req: FastifyRequest }) {
    let user: { id: string; email: string } | null = null;

    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
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
            // Invalid token — user stays null
        }
    }

    return {
        prisma,
        user,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
