import crypto from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const TOKEN_BYTES_LENGTH = 32;
export const SHA256_HEX_LENGTH = 64;
const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

export const generateSha256Hash = (data) => {
  if (typeof data !== 'string' || !data) {
    throw new Error('Data must be a non-empty string');
  }
  return crypto.createHash(HASH_ALGORITHM).update(data, 'utf8').digest('hex');
};

export const verifySha256Hash = (data, expectedHash) => {
  if (typeof data !== 'string' || typeof expectedHash !== 'string') return false;
  if (expectedHash.length !== SHA256_HEX_LENGTH) return false;

  const computedHash = generateSha256Hash(data);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
};

export const generateSecureToken = (bytesLength = TOKEN_BYTES_LENGTH) => {
  return crypto.randomBytes(bytesLength).toString('hex');
};

export const generateUrlSafeToken = (bytesLength = TOKEN_BYTES_LENGTH) => {
  return crypto.randomBytes(bytesLength).toString('base64url');
};

export const generateNumericCode = (length = 6) => {
  const max = Math.pow(10, length);
  const code = crypto.randomInt(0, max);
  return code.toString().padStart(length, '0');
};

export const generateTokenPair = () => {
  const rawToken = generateSecureToken(TOKEN_BYTES_LENGTH);
  const tokenHash = generateSha256Hash(rawToken);
  return { rawToken, tokenHash };
};

export const verifyTokenPair = (rawToken, storedHash) => {
  return verifySha256Hash(rawToken, storedHash);
};

export const generateBackupCodes = (
  count = BACKUP_CODES_COUNT,
  codeLength = BACKUP_CODE_LENGTH
) => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];

  for (let i = 0; i < count; i++) {
    let code = '';
    const randomBytes = crypto.randomBytes(codeLength);
    for (let j = 0; j < codeLength; j++) {
      code += charset[randomBytes[j] % charset.length];
    }
    codes.push(code);
  }

  return codes;
};

export const hashBackupCodes = (codes) => {
  if (!Array.isArray(codes)) {
    throw new Error('Backup codes must be an array');
  }
  return codes.map((code) => generateSha256Hash(code.toUpperCase()));
};

export const verifyBackupCode = (code, storedHashes) => {
  if (!code || !Array.isArray(storedHashes)) {
    return { isValid: false, matchedIndex: -1 };
  }

  const normalizedCode = code.toUpperCase().trim();
  const codeHash = generateSha256Hash(normalizedCode);

  const matchedIndex = storedHashes.findIndex((storedHash) => {
    if (typeof storedHash !== 'string' || storedHash.length !== SHA256_HEX_LENGTH) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(codeHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  });

  return {
    isValid: matchedIndex !== -1,
    matchedIndex,
  };
};

export const generateReceiptCode = () => {
  return generateSecureToken(32);
};

export const generateVotePayloadHash = (payload) => {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return generateSha256Hash(payloadString);
};

export const isValidSha256Hash = (hash) => {
  if (typeof hash !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(hash);
};

export const isValidHexToken = (token, bytesLength = TOKEN_BYTES_LENGTH) => {
  if (typeof token !== 'string') return false;
  return new RegExp(`^[a-f0-9]{${bytesLength * 2}}$`, 'i').test(token);
};

export default {
  generateSha256Hash,
  verifySha256Hash,
  generateSecureToken,
  generateUrlSafeToken,
  generateNumericCode,
  generateTokenPair,
  verifyTokenPair,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  generateReceiptCode,
  generateVotePayloadHash,
  isValidSha256Hash,
  isValidHexToken,
  SHA256_HEX_LENGTH,
};