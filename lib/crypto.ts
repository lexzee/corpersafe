import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * Application-level encryption for profile PII.
 *
 * Values are encrypted here, in the Next.js server runtime, before they ever
 * reach Postgres. The key lives in PII_ENCRYPTION_KEY (Vercel env var) and is
 * never stored in the database, so a stolen dump — or a login to the Supabase
 * dashboard — yields ciphertext only.
 *
 * Format: v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 * AES-256-GCM gives confidentiality *and* integrity: a tampered value fails
 * to decrypt rather than silently returning garbage.
 *
 * THREAT MODEL — be honest about this:
 *   Protects against: database dumps, Supabase dashboard access, backup leaks,
 *   a compromised DB credential, and SQL-level exposure.
 *   Does NOT protect against: someone who holds PII_ENCRYPTION_KEY (i.e. an
 *   admin of the Vercel project). Making it unreadable to *you* as well would
 *   require deriving the key from each user's password, which breaks SOS —
 *   admins could no longer see who to help.
 */

const PREFIX = "v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PII_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }

  // Accept base64 (preferred) or hex; anything else is hashed to 32 bytes so
  // a hand-typed passphrase still yields a valid key rather than crashing.
  let key: Buffer;
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), "base64");
  } else if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), "hex");
  } else {
    key = createHash("sha256").update(raw).digest();
  }

  if (key.length !== 32) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`,
    );
  }

  cachedKey = key;
  return key;
}

/** True when a key is configured — lets callers degrade instead of 500ing. */
export function encryptionAvailable(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a single value. Empty/undefined input returns null (store a NULL). */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const value = String(plaintext);
  if (value === "") return null;

  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by encryptField.
 *
 * Anything that isn't recognisable ciphertext is passed through unchanged —
 * that's what makes the cutover safe: rows still holding legacy plaintext
 * keep rendering while the backfill runs.
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === "") return null;

  const parts = String(stored).split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) return String(stored);

  try {
    const [, ivB64, tagB64, ctB64] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return (
      decipher.update(Buffer.from(ctB64, "base64")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch (err) {
    // Wrong key, or the value was tampered with. Never leak ciphertext to
    // the UI — callers treat null as "unavailable".
    console.error("PII decrypt failed:", (err as Error).message);
    return null;
  }
}

/** Shape of the encrypted-at-rest columns on public.profiles. */
export type EncryptedProfileRow = {
  full_name?: string | null;
  phone?: string | null;
  next_of_kin?: string | null;
  next_of_kin_email?: string | null;
  full_name_enc?: string | null;
  phone_enc?: string | null;
  next_of_kin_enc?: string | null;
  next_of_kin_email_enc?: string | null;
};

export type DecryptedProfile = {
  full_name: string | null;
  phone: string | null;
  next_of_kin: string | null;
  next_of_kin_email: string | null;
};

/**
 * Read a profile row, preferring ciphertext and falling back to any legacy
 * plaintext still present. Use this everywhere instead of touching the
 * columns directly, so the backfill can run with zero downtime.
 */
export function decryptProfile(
  row: EncryptedProfileRow | null | undefined,
): DecryptedProfile {
  const pick = (enc?: string | null, plain?: string | null) =>
    enc ? decryptField(enc) : (plain ?? null);

  return {
    full_name: pick(row?.full_name_enc, row?.full_name),
    phone: pick(row?.phone_enc, row?.phone),
    next_of_kin: pick(row?.next_of_kin_enc, row?.next_of_kin),
    next_of_kin_email: pick(
      row?.next_of_kin_email_enc,
      row?.next_of_kin_email,
    ),
  };
}

/** Build the encrypted column payload for an insert/update on profiles. */
export function encryptProfile(input: Partial<DecryptedProfile>) {
  const payload: Record<string, string | null> = {};
  if ("full_name" in input)
    payload.full_name_enc = encryptField(input.full_name);
  if ("phone" in input) payload.phone_enc = encryptField(input.phone);
  if ("next_of_kin" in input)
    payload.next_of_kin_enc = encryptField(input.next_of_kin);
  if ("next_of_kin_email" in input)
    payload.next_of_kin_email_enc = encryptField(input.next_of_kin_email);
  return payload;
}
