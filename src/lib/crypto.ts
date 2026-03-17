import crypto from 'crypto';

// Types
export interface EncryptedToken {
  iv: string;
  encryptedData: string;
  authTag?: string; // For GCM mode
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  key: string;
}

// Default configuration
const defaultConfig: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  key: process.env.ENCRYPTION_KEY || ''
};

// Helper function to derive a key of correct length
function deriveKey(key: string): Buffer {
  // For AES-256, we need a 32-byte key
  if (!key) {
    throw new Error('Encryption key is not set. Please set ENCRYPTION_KEY environment variable.');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export async function encryptToken(
  token: string, 
  config: EncryptionConfig = defaultConfig
): Promise<string> {
  try {
    if (!token) {
      throw new Error('Token cannot be empty or undefined');
    }
    const { algorithm, key } = config;
    
    // Generate initialization vector
    const iv = crypto.randomBytes(16);
    const derivedKey = deriveKey(key); // 32 bytes for AES-256
    
    if (algorithm === 'aes-256-gcm') {
      const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
      cipher.setAAD(Buffer.from('nextjs-token'));
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag.toString('hex'),
      });
    } else {
      // AES-256-CBC
      const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        encryptedData: encrypted,
      });
    }
  } catch (error) {
    console.error("Error during encryption:", error);
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function decryptToken(
  encryptedToken: string, 
  config: EncryptionConfig = defaultConfig
): Promise<string> {
  try {
     if (!encryptedToken.startsWith('{')) {
      return encryptedToken;
    }

    const { algorithm, key } = config;
    const { iv, encryptedData, authTag } = JSON.parse(encryptedToken) as EncryptedToken;

    const ivBuffer = Buffer.from(iv, 'hex');
    const derivedKey = deriveKey(key); // 32 bytes for AES-256
    
    if (algorithm === 'aes-256-gcm') {
      if (!authTag) {
        throw new Error('Auth tag is required for GCM decryption');
      }
      
      const decipher = crypto.createDecipheriv(algorithm, derivedKey, ivBuffer);
      decipher.setAAD(Buffer.from('nextjs-token'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else {
      // AES-256-CBC
      const decipher = crypto.createDecipheriv(algorithm, derivedKey, ivBuffer);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
  } catch (error) {
    console.error("Error during decryption:", error);
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}