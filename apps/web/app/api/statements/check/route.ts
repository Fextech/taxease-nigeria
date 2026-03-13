import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const password = formData.get('password');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const PARSER_URL = process.env.PARSER_URL || 'http://127.0.0.1:8000';
        
        // Reconstruct FormData to ensure correct boundary headers in Node fetch
        const outFormData = new FormData();
        outFormData.append('file', file as Blob);
        if (password) {
            outFormData.append('password', password as string);
        }

        let res;
        try {
            res = await fetch(`${PARSER_URL}/check-password`, {
                method: 'POST',
                body: outFormData,
            });
        } catch (fetchErr) {
            console.warn('[statements/check] Parser service offline, validation failed:', fetchErr);
            // If the python parser is offline, enforce the failure and alert the user.
            return NextResponse.json({ valid: false, error: 'Validation service is currently offline' });
        }

        if (!res.ok) {
            console.warn(`[statements/check] Parser returned status ${res.status}`);
            return NextResponse.json({ valid: false, error: 'Parser rejected request' });
        }

        const data = await res.json();
        if (!data.valid) {
            console.warn('[statements/check] Python parser failed validation with error:', data.error);
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('[statements/check] Error checking password:', error);
        return NextResponse.json(
            { valid: false, error: 'Failed to verify password' },
            { status: 500 }
        );
    }
}
