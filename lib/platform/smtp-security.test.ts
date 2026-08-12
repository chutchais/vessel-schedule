import assert from "node:assert/strict";
import test from "node:test";
import { canSendSmtpTestToVerifiedAccount, csrfOriginAllowed, isAllowedSmtpAction, safeSmtpErrorMessage, smtpRateLimitAllowed, smtpRateLimitBucket } from "./smtp-security";
import { isPlatformAdmin } from "./smtp-authorization";

test("SMTP provider errors are converted to safe messages without secrets", () => {
  const secret = "smtp://operator:very-secret@mail.example.test:587";
  const message = safeSmtpErrorMessage(new Error(`authentication failed for ${secret}`));
  assert.equal(message, "SMTP authentication was rejected.");
  assert.equal(message.includes("very-secret"), false);
  assert.equal(safeSmtpErrorMessage(new Error("socket timed out")), "The SMTP server did not respond in time.");
});

test("SMTP action and CSRF guards allow only expected values and origin", () => {
  assert.equal(isAllowedSmtpAction("check"), true);
  assert.equal(isAllowedSmtpAction("send-test"), true);
  assert.equal(isAllowedSmtpAction("send-to-anyone"), false);
  assert.equal(csrfOriginAllowed("https://getflowport.com", null, "https://getflowport.com"), true);
  assert.equal(csrfOriginAllowed("https://evil.example", null, "https://getflowport.com"), false);
});

test("SMTP rate-limit buckets are action- and actor-specific", () => {
  const start = 1_000_000;
  assert.notEqual(smtpRateLimitBucket("check", "user-a", start), smtpRateLimitBucket("send-test", "user-a", start));
  assert.notEqual(smtpRateLimitBucket("check", "user-a", start), smtpRateLimitBucket("check", "user-b", start));
  assert.equal(smtpRateLimitAllowed("check", 10), true);
  assert.equal(smtpRateLimitAllowed("check", 11), false);
  assert.equal(smtpRateLimitAllowed("send-test", 3), true);
  assert.equal(smtpRateLimitAllowed("send-test", 4), false);
});

test("SMTP administration is restricted to Platform Admin users", () => {
  assert.equal(isPlatformAdmin("SUPER_ADMIN"), true);
  assert.equal(isPlatformAdmin("OWNER"), false);
  assert.equal(isPlatformAdmin("ADMIN"), false);
  assert.equal(isPlatformAdmin("USER"), false);
});

test("SMTP test email recipient is restricted to the verified signed-in account", () => {
  assert.equal(canSendSmtpTestToVerifiedAccount("admin@example.test", "2026-08-12T00:00:00Z", "admin@example.test"), true);
  assert.equal(canSendSmtpTestToVerifiedAccount("admin@example.test", undefined, "admin@example.test"), false);
  assert.equal(canSendSmtpTestToVerifiedAccount("other@example.test", "2026-08-12T00:00:00Z", "admin@example.test"), false);
});
