import { CloudTasksClient } from '@google-cloud/tasks';

/**
 * Returns a configured CloudTasksClient.
 *
 * - On Cloud Run (GCP): uses Application Default Credentials automatically.
 * - On Vercel (external): reads GOOGLE_APPLICATION_CREDENTIALS_JSON env var
 *   which should contain the full service account key JSON as a string.
 */
export function getTasksClient(): CloudTasksClient {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        return new CloudTasksClient({ credentials });
    }
    // Running on GCP (Cloud Run) — uses the attached service account automatically
    return new CloudTasksClient();
}

/**
 * Returns the fully-qualified Cloud Tasks queue path.
 */
export function getQueuePath(client: CloudTasksClient): string {
    return client.queuePath(
        process.env.GCP_PROJECT_ID!,
        process.env.GCP_TASKS_LOCATION || 'europe-west1',
        process.env.GCP_TASKS_QUEUE    || 'banklens-jobs'
    );
}
