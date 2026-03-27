import { adminProcedure, superAdminProcedure, router } from '../../trpc/trpc.js';
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

    // ─── Maintenance Mode ─────────────────────────────────────
    getMaintenanceConfig: adminProcedure
        .query(async ({ ctx }) => {
            const [enabledRow, htmlRow] = await Promise.all([
                ctx.prisma.appConfig.findUnique({ where: { key: 'maintenance_mode_enabled' } }),
                ctx.prisma.appConfig.findUnique({ where: { key: 'maintenance_mode_html' } }),
            ]);
            return {
                enabled: enabledRow?.value === 'true',
                html: htmlRow?.value ?? '<h2 style="text-align:center;color:#fff;margin-top:40px;">We are currently undergoing maintenance. Please check back later.</h2>',
            };
        }),

    updateMaintenanceConfig: superAdminProcedure
        .input(z.object({
            enabled: z.boolean(),
            html: z.string().max(50000),
        }))
        .mutation(async ({ ctx, input }) => {
            await Promise.all([
                ctx.prisma.appConfig.upsert({
                    where: { key: 'maintenance_mode_enabled' },
                    create: { key: 'maintenance_mode_enabled', value: String(input.enabled), description: 'Whether maintenance mode is active', updatedBy: ctx.admin.id },
                    update: { value: String(input.enabled), updatedBy: ctx.admin.id },
                }),
                ctx.prisma.appConfig.upsert({
                    where: { key: 'maintenance_mode_html' },
                    create: { key: 'maintenance_mode_html', value: input.html, description: 'HTML content for maintenance page', updatedBy: ctx.admin.id },
                    update: { value: input.html, updatedBy: ctx.admin.id },
                }),
            ]);

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: input.enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
                    targetEntity: 'AppConfig:maintenance_mode',
                    metadata: { enabled: input.enabled },
                },
            });

            return { success: true };
        }),

    toggleMaintenanceMode: superAdminProcedure
        .input(z.object({ enabled: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.prisma.appConfig.upsert({
                where: { key: 'maintenance_mode_enabled' },
                create: { key: 'maintenance_mode_enabled', value: String(input.enabled), description: 'Whether maintenance mode is active', updatedBy: ctx.admin.id },
                update: { value: String(input.enabled), updatedBy: ctx.admin.id },
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: input.enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
                    targetEntity: 'AppConfig:maintenance_mode',
                },
            });

            return { success: true, enabled: input.enabled };
        }),

    // ─── How-To Guide ───────────────────────────────────────
    getHowToGuide: adminProcedure
        .query(async ({ ctx }) => {
            const configRow = await ctx.prisma.appConfig.findUnique({ where: { key: 'how_to_guide_pages' } });
            if (!configRow?.value) return { pages: [] };
            try {
                const pages = JSON.parse(configRow.value);
                return { pages: Array.isArray(pages) ? pages : [] };
            } catch {
                return { pages: [] };
            }
        }),

    updateHowToGuide: superAdminProcedure
        .input(z.object({ pages: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
            const jsonValue = JSON.stringify(input.pages);

            await ctx.prisma.appConfig.upsert({
                where: { key: 'how_to_guide_pages' },
                create: { key: 'how_to_guide_pages', value: jsonValue, description: 'JSON array of HTML strings for the How-To guide', updatedBy: ctx.admin.id },
                update: { value: jsonValue, updatedBy: ctx.admin.id },
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'HOW_TO_GUIDE_UPDATED',
                    targetEntity: 'AppConfig:how_to_guide_pages',
                    metadata: { pageCount: input.pages.length },
                },
            });

            return { success: true };
        }),
});
