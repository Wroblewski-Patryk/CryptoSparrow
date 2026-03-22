import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const legacyEncryptCbc = (plaintext: string, keyMaterial: string) => {
  const key = crypto.createHash("sha256").update(keyMaterial).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

describe("crypto utils", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.API_KEY_ENCRYPTION_KEYS;
    delete process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION;
  });

  it("encrypts/decrypts with AES-GCM and versioned payload", async () => {
    process.env.API_KEY_ENCRYPTION = "legacy-fallback-key-material";
    const { encrypt, decrypt } = await import("./crypto");

    const ciphertext = encrypt("secret-value-123");

    expect(ciphertext.startsWith("v1:gcm:")).toBe(true);
    expect(decrypt(ciphertext)).toBe("secret-value-123");
  });

  it("decrypts legacy CBC payload for backward compatibility", async () => {
    process.env.API_KEY_ENCRYPTION = "legacy-only-key-material";
    const { decrypt } = await import("./crypto");

    const legacyCiphertext = legacyEncryptCbc("legacy-secret", process.env.API_KEY_ENCRYPTION);

    expect(decrypt(legacyCiphertext)).toBe("legacy-secret");
  });

  it("supports explicit key versions from keyring env", async () => {
    process.env.API_KEY_ENCRYPTION = "fallback-key-material";
    process.env.API_KEY_ENCRYPTION_KEYS = "v1:key-one,v2:key-two";
    process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = "v2";

    const { encrypt, decrypt } = await import("./crypto");

    const ciphertext = encrypt("versioned-secret");
    expect(ciphertext.startsWith("v2:gcm:")).toBe(true);
    expect(decrypt(ciphertext)).toBe("versioned-secret");
  });
});
