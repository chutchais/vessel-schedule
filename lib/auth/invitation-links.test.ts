import assert from "node:assert/strict";
import test from "node:test";
import { createInvitationToken, hashInvitationToken, getInvitationExpiry } from "./invitation-links";

test("invitation token hash is deterministic and raw tokens are unique", () => {
  const first = createInvitationToken();
  const second = createInvitationToken();
  assert.equal(first.tokenHash, hashInvitationToken(first.token));
  assert.equal(first.tokenHash.length, 64);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("invitation expiry is seven days", () => {
  const now = new Date("2026-07-28T00:00:00.000Z");
  assert.equal(getInvitationExpiry(now).toISOString(), "2026-08-04T00:00:00.000Z");
});
