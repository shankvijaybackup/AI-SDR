/**
 * Encryption Utilities
 * AES-256-GCM encryption for sensitive data (API keys, tokens)
 */

import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

// Get encryption key from environment (must be 32 bytes hex)
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Convert hex string to buffer
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    return keyBuffer;
}

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {object} - { encrypted, iv, authTag }
 */
export function encrypt(text) {
    if (!text) return null;

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    } catch (err) {
        console.error('[Encryption] Error encrypting data:', err.message);
        throw err;
    }
}

/**
 * Decrypt encrypted data
 * @param {string} encrypted - Encrypted hex string
 * @param {string} iv - Initialization vector (hex)
 * @param {string} authTag - Authentication tag (hex)
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encrypted, iv, authTag) {
    if (!encrypted || !iv || !authTag) return null;

    try {
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(
            algorithm,
            key,
            Buffer.from(iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.error('[Encryption] Error decrypting data:', err.message);
        throw err;
    }
}

/**
 * Generate a new encryption key (32 bytes)
 * Run this once and store in .env as ENCRYPTION_KEY
 */
export function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a value (one-way, for verification)
 */
export function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

// Log warning if encryption key is not set
if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  [Encryption] ENCRYPTION_KEY not set - sensitive data will not be encrypted!');
    console.warn('⚠️  [Encryption] Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
