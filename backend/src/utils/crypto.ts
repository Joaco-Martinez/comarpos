import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.ARCA_CONFIG_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("ARCA_CONFIG_SECRET debe tener al menos 32 caracteres.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptText(value: string) {
  const [ivBase64, authTagBase64, encryptedBase64] = value.split(".");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Formato de texto encriptado inválido.");
  }

  const key = getKey();
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
