#!/usr/bin/env node
/**
 * One-off backfill: encrypt the plaintext PII already sitting in
 * public.profiles, then null the plaintext columns.
 *
 * Run AFTER applying 20260802000007_pii_encryption_and_tracking_hardening.sql
 * and AFTER setting PII_ENCRYPTION_KEY.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   PII_ENCRYPTION_KEY=... \
 *   node scripts/encrypt-existing-pii.mjs
 *
 * Idempotent: rows already carrying ciphertext are skipped. Pass --dry-run to
 * preview without writing.
 */

import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes, createHash } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rawKey = process.env.PII_ENCRYPTION_KEY;

if (!url || !serviceKey || !rawKey) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PII_ENCRYPTION_KEY.",
  );
  process.exit(1);
}

// Mirrors getKey() in lib/crypto.ts — keep the two in sync.
function resolveKey(raw) {
  const t = raw.trim();
  if (/^[A-Za-z0-9+/]{43}=$/.test(t)) return Buffer.from(t, "base64");
  if (/^[0-9a-fA-F]{64}$/.test(t)) return Buffer.from(t, "hex");
  return createHash("sha256").update(raw).digest();
}

const KEY = resolveKey(rawKey);
if (KEY.length !== 32) {
  console.error(`PII_ENCRYPTION_KEY must be 32 bytes (got ${KEY.length}).`);
  process.exit(1);
}

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "")
    return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const { data: rows, error } = await supabase
  .from("profiles")
  .select(
    "id, full_name, phone, next_of_kin, next_of_kin_email, full_name_enc, phone_enc, next_of_kin_enc, next_of_kin_email_enc",
  );

if (error) {
  console.error("Could not read profiles:", error.message);
  process.exit(1);
}

console.log(`Scanning ${rows.length} profile row(s)…`);

let migrated = 0;
let skipped = 0;

for (const row of rows) {
  const alreadyEncrypted =
    row.full_name_enc ||
    row.phone_enc ||
    row.next_of_kin_enc ||
    row.next_of_kin_email_enc;

  const hasPlaintext =
    row.full_name || row.phone || row.next_of_kin || row.next_of_kin_email;

  if (alreadyEncrypted || !hasPlaintext) {
    skipped++;
    continue;
  }

  const update = {
    full_name_enc: encryptField(row.full_name),
    phone_enc: encryptField(row.phone),
    next_of_kin_enc: encryptField(row.next_of_kin),
    next_of_kin_email_enc: encryptField(row.next_of_kin_email),
    // Drop the plaintext — this is the point of the exercise.
    full_name: null,
    phone: null,
    next_of_kin: null,
    next_of_kin_email: null,
  };

  if (DRY_RUN) {
    console.log(`[dry-run] would encrypt ${row.id}`);
    migrated++;
    continue;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", row.id);

  if (upErr) {
    console.error(`  ✗ ${row.id}: ${upErr.message}`);
  } else {
    migrated++;
    console.log(`  ✓ ${row.id}`);
  }
}

console.log(
  `\nDone. ${migrated} encrypted, ${skipped} skipped (already encrypted or empty).`,
);
if (DRY_RUN) console.log("Dry run — nothing was written.");
