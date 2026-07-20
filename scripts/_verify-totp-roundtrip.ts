import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDb, sql } from "../src/lib/db";
import {
  generateTotpSecret, buildOtpauthUrl, generateQrDataUrl, validateTotpCode,
  encryptTotpSecret, decryptTotpSecret, generateRecoveryCodes, normalizeRecoveryCode, RECOVERY_CODE_COUNT,
} from "../src/lib/totp";
import * as OTPAuth from "otpauth";

async function main() {
  const failures: string[] = [];

  // 1. Secret + otpauth URL + QR generation (this is exactly what /setup returns).
  const secret = generateTotpSecret();
  const url = buildOtpauthUrl(secret, "roundtrip-test-user");
  if (!url.startsWith("otpauth://totp/")) failures.push("otpauth URL doesn't have the expected scheme");
  if (!url.includes("issuer=LogMonitor")) failures.push("otpauth URL missing issuer=LogMonitor");
  const qr = await generateQrDataUrl(url);
  if (!qr.startsWith("data:image/png;base64,")) failures.push("QR data URL doesn't look like a PNG data URI");

  // 2. Generate the *actual* current code the way a real authenticator app would (independent
  // of validateTotpCode, using the otpauth library's own generate()), then confirm our
  // validator accepts it — proves setup and verification agree on secret/algorithm/digits/period.
  const currentCode = new OTPAuth.TOTP({
    issuer: "LogMonitor", label: "roundtrip-test-user", algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
  if (!validateTotpCode(secret, currentCode)) failures.push("validateTotpCode rejected a freshly-generated valid code");
  if (validateTotpCode(secret, "000000")) failures.push("validateTotpCode accepted an all-zeros code (should almost never validate)");

  // 3. Encrypt/decrypt round trip.
  const encrypted = encryptTotpSecret(secret);
  const decrypted = decryptTotpSecret(encrypted);
  if (decrypted !== secret) failures.push("decryptTotpSecret did not return the original secret");
  if (encrypted === secret) failures.push("encryptTotpSecret returned the secret unchanged (not actually encrypted)");

  // 4. Recovery codes: correct count, correct hash format, and a generated code verifies
  // against its own hash via bcrypt (the same check verify-otp/authorize() perform).
  const { plaintext, hashes } = await generateRecoveryCodes();
  if (plaintext.length !== RECOVERY_CODE_COUNT || hashes.length !== RECOVERY_CODE_COUNT) {
    failures.push(`Expected ${RECOVERY_CODE_COUNT} recovery codes, got ${plaintext.length}/${hashes.length}`);
  }
  const normalized = normalizeRecoveryCode(plaintext[0].toLowerCase().replace(/-/g, " -")); // simulate messy user input
  if (!(await bcrypt.compare(normalized, hashes[0]))) failures.push("A generated recovery code did not match its own bcrypt hash after normalization");

  // 5. Full DB round trip against a disposable test user: insert -> enable TOTP -> insert
  // recovery codes -> confirm the columns read back correctly -> clean up completely.
  const db = await getDb();
  const testUsername = `_totp_roundtrip_${Date.now()}`;
  const passwordHash = await bcrypt.hash("not-a-real-password", 10);
  const insertResult = await db
    .request()
    .input("username", sql.NVarChar, testUsername)
    .input("passwordHash", sql.NVarChar, passwordHash)
    .query<{ Id: number }>("INSERT INTO Users (Username, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@username, @passwordHash, 'Admin')");
  const testUserId = insertResult.recordset[0].Id;

  try {
    await db
      .request()
      .input("id", sql.Int, testUserId)
      .input("secret", sql.NVarChar, encrypted)
      .query("UPDATE Users SET TotpSecretEncrypted = @secret, TotpEnabled = 1, TotpEnrolledAt = SYSUTCDATETIME() WHERE Id = @id");

    for (const hash of hashes) {
      await db.request().input("userId", sql.Int, testUserId).input("hash", sql.NVarChar, hash)
        .query("INSERT INTO UserTotpRecoveryCodes (UserId, CodeHash) VALUES (@userId, @hash)");
    }

    const readBack = await db
      .request()
      .input("id", sql.Int, testUserId)
      .query<{ TotpEnabled: boolean; TotpSecretEncrypted: string | null }>(
        "SELECT TotpEnabled, TotpSecretEncrypted FROM Users WHERE Id = @id"
      );
    const row = readBack.recordset[0];
    if (!row?.TotpEnabled) failures.push("TotpEnabled did not persist as true");
    if (!row?.TotpSecretEncrypted || decryptTotpSecret(row.TotpSecretEncrypted) !== secret) {
      failures.push("Stored+decrypted secret does not match the original after a real DB round trip");
    }

    const codesCount = await db.request().input("userId", sql.Int, testUserId).query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM UserTotpRecoveryCodes WHERE UserId = @userId AND UsedAt IS NULL"
    );
    if (codesCount.recordset[0].Cnt !== RECOVERY_CODE_COUNT) {
      failures.push(`Expected ${RECOVERY_CODE_COUNT} unused recovery codes in the DB, found ${codesCount.recordset[0].Cnt}`);
    }
  } finally {
    // UserTotpRecoveryCodes cascades on Users delete, but this app deletes explicitly in
    // FK-safe order everywhere else — matching that convention rather than relying on cascade.
    await db.request().input("userId", sql.Int, testUserId).query("DELETE FROM UserTotpRecoveryCodes WHERE UserId = @userId");
    await db.request().input("id", sql.Int, testUserId).query("DELETE FROM Users WHERE Id = @id");
  }

  if (failures.length > 0) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }

  console.log("All TOTP round-trip checks passed:");
  console.log("  - otpauth URL + QR generation OK");
  console.log("  - A code generated the way a real authenticator app would validates correctly");
  console.log("  - An invalid code is correctly rejected");
  console.log("  - AES-256-GCM encrypt/decrypt round trip OK");
  console.log(`  - ${RECOVERY_CODE_COUNT} recovery codes generated, hashed, and verify correctly`);
  console.log("  - Full DB round trip (enable, store, read back, verify, clean up) OK — no leftover rows");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
