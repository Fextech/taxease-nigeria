import { z } from 'zod';
import { publicProcedure, router } from '../../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';

export const adminAuthRouter = router({
    login: publicProcedure
        .input(
            z.object({
                email: z.string().email(),
                password: z.string().min(1),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const admin = await ctx.prisma.adminUser.findUnique({
                where: { email: input.email },
            });

            if (!admin || !admin.isActive) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid email or password',
                });
            }

            const validPassword = await bcrypt.compare(input.password, admin.passwordHash);
            if (!validPassword) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid email or password',
                });
            }

            // Return success but requiring TOTP (if enrolled)
            // For now, this is enough to progress to the TOTP verification screen
            return {
                message: 'Password verified',
                requiresTotp: !!admin.totpSecret,
                adminId: admin.id,
            };
        }),

    verifyTotp: publicProcedure
        .input(
            z.object({
                adminId: z.string(),
                code: z.string().length(6),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const admin = await ctx.prisma.adminUser.findUnique({
                where: { id: input.adminId },
            });

            if (!admin || !admin.isActive || !admin.totpSecret) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid session or TOTP not enrolled',
                });
            }

            const totp = new OTPAuth.TOTP({
                issuer: 'BankLens',
                label: admin.email,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(admin.totpSecret),
            });

            const delta = totp.validate({ token: input.code, window: 1 });
            if (delta === null) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid TOTP code',
                });
            }

            // At this point TOTP is verified. We create the custom JWT token
            const { SignJWT } = await import('jose');
            const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'fallback_admin_secret');
            
            const token = await new SignJWT({
                adminId: admin.id,
                email: admin.email,
                role: admin.role,
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('12h')
                .sign(secret);
                
            // Create a session entry
            await ctx.prisma.adminSession.create({
                data: {
                    adminId: admin.id,
                    token,
                    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), 
                    ipAddress: '127.0.0.1', // Mock for now
                }
            });

            return {
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    role: admin.role,
                }
            };
        }),
});
