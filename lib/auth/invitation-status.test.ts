import assert from "node:assert/strict";
import test from "node:test";
import { getInvitationState, isActiveInvitation } from "./invitation-status";

const now = new Date("2026-07-28T00:00:00Z");
const future = new Date("2026-08-01T00:00:00Z");

test("classifies active, expired, revoked and accepted invitations", () => {
  assert.equal(getInvitationState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now), "ACTIVE");
  assert.equal(getInvitationState({ acceptedAt: null, revokedAt: null, expiresAt: new Date("2026-07-27T00:00:00Z") }, now), "EXPIRED");
  assert.equal(getInvitationState({ acceptedAt: null, revokedAt: now, expiresAt: future }, now), "REVOKED");
  assert.equal(getInvitationState({ acceptedAt: now, revokedAt: null, expiresAt: future }, now), "ACCEPTED");
  assert.equal(getInvitationState({ status: "DECLINED", acceptedAt: null, revokedAt: null, expiresAt: future }, now), "DECLINED");
  assert.equal(isActiveInvitation({ acceptedAt: null, revokedAt: null, expiresAt: future }, now), true);
});
