import { NextResponse } from 'next/server';
import { auth } from '@/auth';

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

        // Mock implementation for now.
        // In a real scenario, we would save this to the DB, push to Zendesk/Intercom, 
        // or trigger an email via Resend to the support alias.
        console.log(`[Support Ticket] From: ${session.user.email} | Type: ${category} | Subject: ${subject}`);
        console.log(`[Message details]: ${message}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return NextResponse.json({ success: true, message: "Ticket created successfully" });
    } catch (error) {
        console.error('Support API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
