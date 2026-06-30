import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getSecretKey() {
  const secret =
    process.env.ARCA_CREDENTIALS_SECRET ||
    process.env.AFIP_CREDENTIALS_SECRET ||
    "";

  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta configurar ARCA_CREDENTIALS_SECRET en el .env. Debe tener al menos 32 caracteres."
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  if (!value) return value;

  const key = getSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(value: string) {
  if (!value) return value;

  const raw = Buffer.from(value, "base64");

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = getSecretKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export const arcaCryptoService = {
  encrypt,
  decrypt,
};