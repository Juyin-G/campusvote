import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'CampusVote';

export const generateTotpSetup = async (email) => {
  const secret = generateSecret();

  const otpauthUrl = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });

  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return {
    secret,
    otpauthUrl,
    qrCode,
  };
};

export const verifyTotpCode = async ({ secret, token }) => {
  const result = await verify({
    secret,
    token,
  });

  return result.valid;
};