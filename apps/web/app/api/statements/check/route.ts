import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let PARSER_URL = process.env.PARSER_URL || 'http://127.0.0.1:8000';
        // Ensure the URL has a scheme
        if (!PARSER_URL.startsWith('http://') && !PARSER_URL.startsWith('https://')) {
            PARSER_URL = `https://${PARSER_URL}`;
        }
        
        // Proxy the exact headers (importantly: content-type with its auto-generated boundary) 
        // and the exact body stream directly to FastAPI.
        // This guarantees the PDF binary is never parsed, manipulated, or corrupted by Node.js.
        let res;
        try {
            res = await fetch(`${PARSER_URL}/check-password`, {
                method: 'POST',
                headers: {
                    // Pass the original boundary through
                    'Content-Type': request.headers.get('content-type') || 'multipart/form-data',
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
            return NextResponse.json({ valid: false, error: 'Parser rejected request' });
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
