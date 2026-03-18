import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const adminSettingsRouter = router({
    getAdminProfile: adminProcedure
        .query(async ({ ctx }) => {
            const user = await ctx.prisma.adminUser.findUnique({
                where: { id: ctx.admin.id },
            });
            if (!user) throw new Error("Admin not found");
            return {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                totpEnabled: !!user.totpSecret,
                createdAt: user.createdAt
            };
        }),

    updateAdminProfile: adminProcedure
        .input(
            z.object({
                fullName: z.string().min(2),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.prisma.adminUser.update({
                where: { id: ctx.admin.id },
                data: { fullName: input.fullName }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'ADMIN_PROFILE_UPDATED',
                    targetEntity: `AdminUser:${ctx.admin.id}`,
                    metadata: { newFullName: input.fullName }
                }
            });

            return { success: true, updated };
        }),

    changePassword: adminProcedure
        .input(
            z.object({
                currentPassword: z.string().min(1),
                newPassword: z.string().min(8),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const admin = await ctx.prisma.adminUser.findUnique({
                where: { id: ctx.admin.id }
            });
            if (!admin) throw new Error("Admin not found");

            const isValid = await bcrypt.compare(input.currentPassword, admin.passwordHash);
            if (!isValid) throw new Error("Incorrect current password.");

            const newHash = await bcrypt.hash(input.newPassword, 10);

            await ctx.prisma.adminUser.update({
                where: { id: ctx.admin.id },
                data: { passwordHash: newHash }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'ADMIN_PASSWORD_CHANGED',
                    targetEntity: `AdminUser:${ctx.admin.id}`,
                }
            });

            return { success: true };
        }),

    listSessions: adminProcedure
        .query(async ({ ctx }) => {
            return await ctx.prisma.adminSession.findMany({
                where: { adminId: ctx.admin.id },
                orderBy: { lastActiveAt: 'desc' },
                take: 20
            });
        }),

    revokeSession: adminProcedure
        .input(z.object({ sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.prisma.adminSession.updateMany({
                where: { id: input.sessionId, adminId: ctx.admin.id },
                data: { revokedAt: new Date() }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'ADMIN_SESSION_REVOKED',
                    targetEntity: `AdminSession:${input.sessionId}`,
                }
            });

            return { success: true };
        }),

    getIntegrationStatuses: adminProcedure
        .query(async () => {
            // Mocked status checks
            return {
                paystack: { status: 'healthy', lastPing: new Date().toISOString() },
                s3: { status: 'healthy', lastPing: new Date().toISOString() },
                gemini: { status: 'degraded', lastPing: new Date().toISOString() },
                resend: { status: 'healthy', lastPing: new Date().toISOString() },
            };
        }),
        
    pingIntegration: adminProcedure
        .input(z.object({ service: z.string() }))
        .mutation(async ({ input }) => {
            // Mock a ping delay
            await new Promise(r => setTimeout(r, 600));
            return { status: input.service === 'gemini' ? 'degraded' : 'healthy', latency: Math.floor(Math.random() * 200 + 50) };
        }),
});
