import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
        const internalSecret = process.env.INTERNAL_API_SECRET?.trim();
        if (!apiUrl || !internalSecret || internalSecret.length < 32) {
            console.error('[statements/check] Internal API password validation is not configured');
            return NextResponse.json(
                { valid: false, error: 'Password validation service is currently unavailable' },
                { status: 503 }
            );
        }
        
        // Proxy the exact headers (importantly: content-type with its auto-generated boundary) 
        // and the exact body stream directly to FastAPI.
        // This guarantees the PDF binary is never parsed, manipulated, or corrupted by Node.js.
        let res;
        try {
            res = await fetch(`${apiUrl}/internal/statements/check-password`, {
                method: 'POST',
                headers: {
                    // Pass the original boundary through
                    'Content-Type': request.headers.get('content-type') || 'multipart/form-data',
                    'X-Internal-Api-Secret': internalSecret,
                },
                body: request.body, // Pass the raw ReadableStream
                // @ts-ignore - Required for Node.js fetch when streaming request bodies
                duplex: 'half',
                signal: AbortSignal.timeout(15000),
            });
        } catch (fetchErr) {
            console.warn('[statements/check] Parser service offline, validation failed:', fetchErr);
            return NextResponse.json({ valid: false, error: 'Validation service is currently offline' });
        }

        if (!res.ok) {
            const errData = await res.text().catch(() => "");
            console.warn(`[statements/check] Parser returned HTTP ${res.status}:`, errData);
            return NextResponse.json(
                { valid: false, error: 'Password validation service is currently unavailable. Please retry shortly.' },
                { status: 502 }
            );
        }

        const data = await res.json();
        if (!data.valid) {
            console.warn('[statements/check] Python parser failed validation with error:', data.error);
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('[statements/check] Error proxying password check:', error);
        return NextResponse.json(
            { valid: false, error: 'Failed to verify password' },
            { status: 500 }
        );
    }
}
