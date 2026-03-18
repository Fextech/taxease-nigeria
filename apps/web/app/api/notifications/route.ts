import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const notifications = await prisma.notification.findMany({
            where: {
                userId: session.user.id,
                deletedAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50, // Limit to 50 most recent
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error('Fetch notifications error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, notificationId } = body;

        if (action === 'mark_read' && notificationId) {
            await prisma.notification.update({
                where: {
                    id: notificationId,
                    userId: session.user.id, // Security: ensure user owns it
                },
                data: {
                    isRead: true,
                },
            });
            return NextResponse.json({ success: true });
        }

        if (action === 'mark_all_read') {
            await prisma.notification.updateMany({
                where: {
                    userId: session.user.id,
                    isRead: false,
                    deletedAt: null,
                },
                data: {
                    isRead: true,
                },
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Update notification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
