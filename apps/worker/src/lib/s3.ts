import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'banklens-statements-dev';

/**
 * Download a file from S3 and return it as a Buffer.
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3.send(command);
    const stream = response.Body;
    if (!stream) throw new Error('Empty S3 response body');

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
