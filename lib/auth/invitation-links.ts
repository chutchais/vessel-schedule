import { createHash, randomBytes } from "crypto";
import { buildAppUrl, getServerAppUrl } from "@/lib/config/app-url";

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
  return getServerAppUrl();
}

export function buildInvitationUrl(token: string) {
  return buildAppUrl(`/invitations/accept?token=${encodeURIComponent(token)}`, getAppUrl());
}
