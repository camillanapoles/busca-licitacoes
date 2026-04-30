import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getCredentialSecret() {
  const secret = process.env.APIBRASIL_CREDENTIAL_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("Configure APIBRASIL_CREDENTIAL_SECRET ou NEXTAUTH_SECRET para salvar credenciais.");
  }

  return secret;
}

function getEncryptionKey() {
  return createHash("sha256").update(getCredentialSecret()).digest();
}

export function encryptCredential(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptCredential(encryptedCredential: string) {
  const [version, iv, authTag, encrypted] = encryptedCredential.split(":");

  if (version !== VERSION || !iv || !authTag || !encrypted) {
    throw new Error("Formato de credencial criptografada inválido.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
