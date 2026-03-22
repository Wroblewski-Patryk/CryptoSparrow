import crypto from "crypto";
import { loadEnv } from "../config/loadEnv";

loadEnv();

const CIPHER_VERSION_PREFIX = "v";
const CIPHER_ALGORITHM = "gcm";
const IV_LENGTH_GCM = 12;
const LEGACY_IV_LENGTH_CBC = 16;

const sha256Key = (value: string) => crypto.createHash("sha256").update(value).digest();

const parseVersionedKeys = () => {
  const entries = (process.env.API_KEY_ENCRYPTION_KEYS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const keys = new Map<string, Buffer>();

  for (const entry of entries) {
    const [version, material] = entry.split(":");
    if (!version || !material) continue;
    keys.set(version, sha256Key(material));
  }

  // Backward-compatible default for local/dev environments.
  if (keys.size === 0 && process.env.API_KEY_ENCRYPTION) {
    keys.set("v1", sha256Key(process.env.API_KEY_ENCRYPTION));
  }

  return keys;
};

const keyring = parseVersionedKeys();
const activeVersion = process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION ?? "v1";

const getActiveKey = () => {
  const key = keyring.get(activeVersion);
  if (!key) {
    throw new Error(`Missing active encryption key version: ${activeVersion}`);
  }
  return { version: activeVersion, key };
};

const getKeyForVersion = (version: string) => {
  const key = keyring.get(version);
  if (!key) {
    throw new Error(`Missing encryption key for version: ${version}`);
  }
  return key;
};

const decryptLegacyCbc = (text: string) => {
  const [ivHex, encryptedHex] = text.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid legacy ciphertext format");
  }

  const fallbackMaterial = process.env.API_KEY_ENCRYPTION;
  if (!fallbackMaterial) {
    throw new Error("Missing legacy encryption key material");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");

  if (iv.length !== LEGACY_IV_LENGTH_CBC || encryptedText.length === 0) {
    throw new Error("Invalid legacy ciphertext payload");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", sha256Key(fallbackMaterial), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString();
};

export function encrypt(text: string) {
  const { version, key } = getActiveKey();
  const iv = crypto.randomBytes(IV_LENGTH_GCM);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${CIPHER_ALGORITHM}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(text: string) {
  if (!text.startsWith(CIPHER_VERSION_PREFIX)) {
    return decryptLegacyCbc(text);
  }

  const [version, algorithm, ivHex, tagHex, encryptedHex] = text.split(":");
  if (!version || !algorithm || !ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid ciphertext format");
  }

  if (algorithm !== CIPHER_ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const key = getKeyForVersion(version);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
