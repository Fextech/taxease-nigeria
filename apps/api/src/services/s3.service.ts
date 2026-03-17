import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── S3 Client Singleton ─────────────────────────────────

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'banklens-statements-dev';
const URL_EXPIRY = Number(process.env.S3_PRESIGNED_URL_EXPIRY) || 900; // 15 minutes

// ─── Presigned URLs ──────────────────────────────────────

/**
 * Generate a presigned PUT URL for uploading a file to S3.
 */
export async function generateUploadUrl(
    key: string,
    contentType: string,
    maxSizeBytes?: number
): Promise<{ url: string; key: string }> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
    });

    const url = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY });
    return { url, key };
}

/**
 * Generate a presigned GET URL for downloading a file from S3.
 */
export async function generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY });
}

/**
 * Build the S3 key for a statement file.
 * Format: statements/{userId}/{workspaceId}/{month}/{filename}
 */
export function buildStatementKey(
    userId: string,
    workspaceId: string,
    month: number,
    filename: string
): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `statements/${userId}/${workspaceId}/${month}/${Date.now()}_${sanitized}`;
}
