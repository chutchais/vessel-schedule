import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function createInvitationToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getInvitationExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITATION_LIFETIME_MS);
}

export function getAppUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is not configured");

  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS outside localhost");
  }
  return url.origin;
}

export function buildInvitationUrl(token: string) {
  return `${getAppUrl()}/invitations/accept?token=${encodeURIComponent(token)}`;
}
