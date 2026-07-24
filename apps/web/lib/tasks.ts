type WorkerJobPath = '/jobs/parse-statement' | '/jobs/generate-report';

export class TaskConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TaskConfigurationError';
    }
}

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new TaskConfigurationError(`${name} is not configured.`);
    }
    return value;
}

function getApiUrl(): string {
    const configuredUrl = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!configuredUrl) {
        throw new TaskConfigurationError('API_URL (or NEXT_PUBLIC_API_URL) is not configured.');
    }
    const apiUrl = configuredUrl.replace(/\/+$/, '');
    try {
        const parsed = new URL(apiUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('unsupported protocol');
        }
    } catch {
        throw new TaskConfigurationError('API_URL must be an absolute HTTP(S) URL.');
    }
    return apiUrl;
}

/**
 * Sends a job request to the API service. The API runs on Cloud Run with the
 * BankLens dispatcher service account, so it is the only service that creates
 * Cloud Tasks. This keeps Google service-account credentials out of the web
 * deployment (which runs outside GCP).
 */
export async function enqueueWorkerJob(
    path: WorkerJobPath,
    payload: Record<string, unknown>
): Promise<void> {
    const apiUrl = getApiUrl();
    const internalSecret = requiredEnv('INTERNAL_API_SECRET');
    if (internalSecret.length < 32) {
        throw new TaskConfigurationError('INTERNAL_API_SECRET must contain at least 32 characters.');
    }

    const endpoint = path === '/jobs/parse-statement'
        ? '/internal/jobs/parse-statement'
        : '/internal/jobs/generate-report';

    let response: Response;
    try {
        response = await fetch(`${apiUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Api-Secret': internalSecret,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        throw new Error(`API job dispatch request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`API job dispatch failed (${response.status}): ${detail || response.statusText}`);
    }
}
