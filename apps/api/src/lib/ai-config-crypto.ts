import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
    const value = process.env.AI_CONFIG_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
        throw new Error('AI_CONFIG_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
    }
    return Buffer.from(value, 'hex');
}

export function encryptAiConfig(value: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptAiConfig(value: string): string {
    const [ivHex, authTagHex, encryptedHex] = value.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Stored AI provider credential is malformed. Save the provider key again.');
    }

    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}
