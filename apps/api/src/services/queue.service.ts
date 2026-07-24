import { CloudTasksClient } from '@google-cloud/tasks';

// ─── Cloud Tasks configuration ───────────────────────────

const tasksClient = new CloudTasksClient();

const GCP_PROJECT  = process.env.GCP_PROJECT_ID!;
const GCP_LOCATION = process.env.GCP_TASKS_LOCATION || 'europe-west1';
const GCP_QUEUE    = process.env.GCP_TASKS_QUEUE    || 'banklens-jobs';
const WORKER_URL   = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET!;
const TASKS_INVOKER_SERVICE_ACCOUNT = process.env.CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT;

function getQueuePath(): string {
    return tasksClient.queuePath(GCP_PROJECT, GCP_LOCATION, GCP_QUEUE);
}

// ─── Dispatchers ─────────────────────────────────────────

/**
 * Dispatch a parse-statement Cloud Task.
 * Queue a parse request for the Cloud Run worker.
 */
export async function enqueueParseJob(
    statementId: string,
    pdfPassword?: string
): Promise<void> {
    const payload = JSON.stringify({ statementId, pdfPassword });

    await tasksClient.createTask({
        parent: getQueuePath(),
        task: {
            httpRequest: {
                httpMethod: 'POST' as const,
                url: `${WORKER_URL}/jobs/parse-statement`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': WORKER_SECRET,
                },
                body: Buffer.from(payload).toString('base64'),
                ...(TASKS_INVOKER_SERVICE_ACCOUNT
                    ? {
                        oidcToken: {
                            serviceAccountEmail: TASKS_INVOKER_SERVICE_ACCOUNT,
                            audience: WORKER_URL,
                        },
                    }
                    : {}),
            },
        },
    });
}

/**
 * Dispatch a generate-report Cloud Task.
 * Called from apps/web/app/api/reports/route.ts for the email-report action.
 */
export async function enqueueReportJob(payload: {
    workspaceId: string;
    userId: string;
    userEmail: string;
    taxYear?: number;
    additionalDeductions?: { label: string; amount: string }[];
    annualRentPaid?: string;
}): Promise<void> {
    await tasksClient.createTask({
        parent: getQueuePath(),
        task: {
            httpRequest: {
                httpMethod: 'POST' as const,
                url: `${WORKER_URL}/jobs/generate-report`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': WORKER_SECRET,
                },
                body: Buffer.from(JSON.stringify(payload)).toString('base64'),
                ...(TASKS_INVOKER_SERVICE_ACCOUNT
                    ? {
                        oidcToken: {
                            serviceAccountEmail: TASKS_INVOKER_SERVICE_ACCOUNT,
                            audience: WORKER_URL,
                        },
                    }
                    : {}),
            },
        },
    });
}
