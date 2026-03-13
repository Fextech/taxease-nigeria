import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Test User ───────────────────────────────────────
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await prisma.user.upsert({
        where: { email: 'demo@taxease.ng' },
        update: {},
        create: {
            email: 'demo@taxease.ng',
            name: 'Demo User',
            password: hashedPassword,
            phone: '+2348012345678',
            professionalCategory: 'Self-Employed',
            plan: 'FREE',
        },
    });

    console.log(`  ✓ User: ${user.email} (${user.id})`);

    // ─── Sample Workspaces ───────────────────────────────
    const workspace2024 = await prisma.workspace.upsert({
        where: { userId_taxYear: { userId: user.id, taxYear: 2024 } },
        update: {},
        create: {
            userId: user.id,
            taxYear: 2024,
            status: 'ACTIVE',
            totalIncome: 1245000000n,        // ₦12,450,000 in kobo
            totalTaxableIncome: 980000000n,   // ₦9,800,000
            totalTaxLiability: 184000000n,    // ₦1,840,000
        },
    });

    const workspace2025 = await prisma.workspace.upsert({
        where: { userId_taxYear: { userId: user.id, taxYear: 2025 } },
        update: {},
        create: {
            userId: user.id,
            taxYear: 2025,
            status: 'ACTIVE',
        },
    });

    console.log(`  ✓ Workspace: ${workspace2024.taxYear} (${workspace2024.id})`);
    console.log(`  ✓ Workspace: ${workspace2025.taxYear} (${workspace2025.id})`);

    // ─── Audit Log Entry ─────────────────────────────────
    await prisma.auditLog.create({
        data: {
            userId: user.id,
            entityType: 'Workspace',
            entityId: workspace2024.id,
            action: 'CREATE',
            newValue: { taxYear: 2024, status: 'ACTIVE' },
        },
    });

    console.log('  ✓ Audit log entry created');
    console.log('✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
