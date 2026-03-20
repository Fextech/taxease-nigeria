import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { subject, category, message } = body;

        if (!subject || !category || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Format category to match Prisma enum (e.g. "Parsing Error" -> "PARSING_ERROR")
        const ticketCategory = category.toUpperCase().replace(/ /g, '_');

        await prisma.supportTicket.create({
            data: {
                userId: session.user.id,
                subject,
                category: ticketCategory,
                messages: {
                    create: {
                        senderId: session.user.id,
                        senderType: 'user',
                        body: message,
                    }
                }
            }
        });

        return NextResponse.json({ success: true, message: "Ticket created successfully" });
    } catch (error) {
        console.error('Support API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
