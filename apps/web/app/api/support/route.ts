import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const rawEmailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const senderName = process.env.SENDER_NAME || 'Banklens';
const FROM_EMAIL = rawEmailFrom.includes('<') ? rawEmailFrom : `${senderName} <${rawEmailFrom}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || 'admin@flowiselabs.com';

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

        const ticket = await prisma.supportTicket.create({
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

        // Notify admin via email (fire-and-forget — don't block the response)
        resend.emails.send({
            from: FROM_EMAIL,
            to: ADMIN_EMAIL,
            subject: `[New Support Ticket] ${subject}`,
            html: `
                <div style="font-family: sans-serif; max-width: 640px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px; color: #111827;">
                    <h2 style="color: #0f766e; margin-top: 0;">New Support Ticket Submitted</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Ticket ID</td>
                            <td style="padding: 8px 0; font-weight: 600;">${ticket.id}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">From</td>
                            <td style="padding: 8px 0;">${session.user.name || 'Unknown'} &lt;${session.user.email}&gt;</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Category</td>
                            <td style="padding: 8px 0;">${category}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Subject</td>
                            <td style="padding: 8px 0; font-weight: 600;">${subject}</td>
                        </tr>
                    </table>
                    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                    </div>
                    <a href="${process.env.ADMIN_URL || 'http://localhost:3001'}/support/${ticket.id}" 
                       style="display: inline-block; background: #0f766e; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                        View Ticket in Admin Panel →
                    </a>
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Submitted on ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
                </div>
            `,
        }).catch((err) => {
            console.error('[Support] Failed to send admin notification email:', err);
        });

        return NextResponse.json({ success: true, message: "Ticket created successfully" });
    } catch (error) {
        console.error('Support API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
