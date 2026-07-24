import { createDecipheriv } from 'crypto';
import type { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';

export interface ParserAiConfig {
    provider: 'gemini' | 'openai' | 'nvidia_nim' | 'openrouter';
    model: string;
    apiKey: string;
}

function decryptApiKey(value: string): string {
    const keyValue = process.env.AI_CONFIG_ENCRYPTION_KEY;
    if (!keyValue || !/^[a-fA-F0-9]{64}$/.test(keyValue)) {
        throw new Error('AI_CONFIG_ENCRYPTION_KEY is missing or invalid.');
    }

    const [ivHex, authTagHex, encryptedHex] = value.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Stored AI provider credential is malformed. Save the provider key again.');
    }

    const decipher = createDecipheriv(
        ALGORITHM,
        Buffer.from(keyValue, 'hex'),
        Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]).toString('utf8');
}

export async function getActiveAiProviderConfig(prisma: PrismaClient): Promise<ParserAiConfig> {
    const config = await prisma.aiProviderConfig.findFirst({
        where: { isActive: true },
    });

    if (!config) {
        throw new Error('No active AI provider is configured. Set one in Admin Settings > AI Model.');
    }

    const providerMap = {
        GEMINI: 'gemini',
        OPENAI: 'openai',
        NVIDIA_NIM: 'nvidia_nim',
        OPENROUTER: 'openrouter',
    } as const;

    return {
        provider: providerMap[config.provider],
        model: config.model,
        apiKey: decryptApiKey(config.apiKeyEncrypted),
    };
}
