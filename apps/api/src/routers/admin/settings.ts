import { adminProcedure, superAdminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { encryptAiConfig } from '../../lib/ai-config-crypto.js';

const AI_PROVIDER_CATALOGUE = [
    {
        id: 'GEMINI',
        label: 'Google Gemini',
        description: 'Native Gemini API with schema-constrained JSON output.',
        defaultModel: 'gemini-2.5-flash',
        recommendedModels: [
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Best default for reliable, high-volume statement extraction.' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Use for harder layouts and higher extraction accuracy.' },
            { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: 'Fast, cost-conscious option for structured document extraction.' },
        ],
    },
    {
        id: 'OPENAI',
        label: 'OpenAI',
        description: 'Frontier reasoning models with strict structured outputs.',
        defaultModel: 'gpt-5.6-terra',
        recommendedModels: [
            { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', note: 'Balanced default for quality, latency, and cost.' },
            { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', note: 'Highest-reasoning choice for especially difficult statements.' },
            { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', note: 'Cost-sensitive option for large processing volumes.' },
        ],
    },
    {
        id: 'NVIDIA_NIM',
        label: 'NVIDIA NIM',
        description: 'OpenAI-compatible access to NVIDIA-hosted and open-weight models.',
        defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        recommendedModels: [
            { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Llama 3.3 Nemotron Super 49B', note: 'Strong open-weight reasoning model for complex extraction.' },
            { id: 'openai/gpt-oss-120b', label: 'gpt-oss-120b', note: 'Open-weight, high-capacity option for quality-focused workloads.' },
            { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', note: 'Proven open-weight fallback for quality-focused extraction.' },
        ],
    },
    {
        id: 'OPENROUTER',
        label: 'OpenRouter',
        description: 'One OpenAI-compatible API for models from many providers.',
        defaultModel: 'google/gemini-2.5-flash',
        recommendedModels: [
            { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Fast structured extraction through a gateway provider.' },
            { id: 'openai/gpt-oss-120b', label: 'gpt-oss-120b', note: 'Open-weight option with broad gateway availability.' },
            { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', note: 'Open-weight reasoning alternative for challenging statements.' },
        ],
    },
] as const;

const aiProviderInput = z.enum(['GEMINI', 'OPENAI', 'NVIDIA_NIM', 'OPENROUTER']);

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
        .query(async ({ ctx }) => {
            const activeAiProvider = await ctx.prisma.aiProviderConfig.findFirst({
                where: { isActive: true },
                select: { provider: true, model: true, updatedAt: true },
            });
            return {
                paystack: { status: 'healthy', lastPing: new Date().toISOString(), detail: null },
                s3: { status: 'healthy', lastPing: new Date().toISOString(), detail: null },
                aiModel: {
                    status: activeAiProvider ? 'healthy' : 'degraded',
                    lastPing: activeAiProvider?.updatedAt.toISOString() ?? new Date().toISOString(),
                    detail: activeAiProvider ? `${activeAiProvider.provider} · ${activeAiProvider.model}` : 'No active provider configured',
                },
                resend: { status: 'healthy', lastPing: new Date().toISOString(), detail: null },
            };
        }),

    pingIntegration: adminProcedure
        .input(z.object({ service: z.string() }))
        .mutation(async () => {
            // Mock a ping delay
            await new Promise(r => setTimeout(r, 600));
            return { status: 'healthy', latency: Math.floor(Math.random() * 200 + 50) };
        }),

    // ─── AI Model Routing ────────────────────────────────────
    getAiProviderConfigs: adminProcedure
        .query(async ({ ctx }) => {
            const configured = await ctx.prisma.aiProviderConfig.findMany();
            const byProvider = new Map(configured.map((config) => [config.provider, config]));

            return {
                providers: AI_PROVIDER_CATALOGUE.map((provider) => {
                    const config = byProvider.get(provider.id);
                    return {
                        ...provider,
                        model: config?.model ?? provider.defaultModel,
                        isActive: config?.isActive ?? false,
                        apiKeyConfigured: Boolean(config?.apiKeyEncrypted),
                        updatedAt: config?.updatedAt ?? null,
                    };
                }),
            };
        }),

    saveAiProviderConfig: superAdminProcedure
        .input(z.object({
            provider: aiProviderInput,
            model: z.string().trim().min(1).max(160),
            apiKey: z.string().trim().min(10).max(500).optional(),
            isActive: z.boolean(),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.aiProviderConfig.findUnique({
                where: { provider: input.provider },
            });

            if (!existing && !input.apiKey) {
                throw new Error('Enter an API key before saving a new provider.');
            }

            const apiKeyEncrypted = input.apiKey
                ? encryptAiConfig(input.apiKey)
                : existing!.apiKeyEncrypted;

            const saved = await ctx.prisma.$transaction(async (tx) => {
                if (input.isActive) {
                    await tx.aiProviderConfig.updateMany({
                        where: { isActive: true },
                        data: { isActive: false },
                    });
                }

                return tx.aiProviderConfig.upsert({
                    where: { provider: input.provider },
                    create: {
                        provider: input.provider,
                        model: input.model,
                        apiKeyEncrypted,
                        isActive: input.isActive,
                        updatedBy: ctx.admin.id,
                    },
                    update: {
                        model: input.model,
                        apiKeyEncrypted,
                        isActive: input.isActive,
                        updatedBy: ctx.admin.id,
                    },
                });
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'AI_PROVIDER_CONFIG_UPDATED',
                    targetEntity: `AiProviderConfig:${input.provider}`,
                    metadata: {
                        provider: input.provider,
                        model: input.model,
                        isActive: input.isActive,
                        apiKeyUpdated: Boolean(input.apiKey),
                    },
                },
            });

            return {
                success: true,
                provider: saved.provider,
                model: saved.model,
                isActive: saved.isActive,
            };
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
