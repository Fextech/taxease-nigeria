import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/maintenance
 * Public endpoint — returns { enabled, html } for the maintenance page.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [enabledRow, htmlRow] = await Promise.all([
            prisma.appConfig.findUnique({ where: { key: 'maintenance_mode_enabled' } }),
            prisma.appConfig.findUnique({ where: { key: 'maintenance_mode_html' } }),
        ]);

        return NextResponse.json({
            enabled: enabledRow?.value === 'true',
            html: htmlRow?.value ?? '',
        });
    } catch {
        return NextResponse.json({ enabled: false, html: '' });
    }
}
