import crypto from 'node:crypto';

const PREFIX = 'v1:';

const getKey = () => {
  const configured = process.env.TOTP_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[0-9a-f]{64}$/i.test(configured)) {
      throw new Error('TOTP_ENCRYPTION_KEY debe ser hexadecimal de 32 bytes');
    }
    return Buffer.from(configured, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOTP_ENCRYPTION_KEY es obligatoria en producción');
  }
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'development-only').digest();
};

export const encryptSecret = (value) => {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
};

export const decryptSecret = (value) => {
  if (!value || !value.startsWith(PREFIX)) return value;
  const [, ivValue, tagValue, ciphertextValue] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
