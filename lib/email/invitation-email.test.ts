import assert from "node:assert/strict";
import test from "node:test";
import { deliverInvitationEmail, setEmailTransportForTests, type EmailMessage } from "./invitation-email";

const invitation = {
  to: "invitee@example.com",
  organizationName: "Harbor <Operations>",
  inviterName: "Ava & Co.",
  role: "PLANNER",
  expiresAt: new Date("2026-08-05T12:00:00.000Z"),
  acceptanceUrl: "https://app.example.com/invitations/accept?token=secret",
};

test("delivers an escaped invitation through a fake transport", async () => {
  let message: EmailMessage | undefined;
  setEmailTransportForTests({ send: async (value) => { message = value; } });
  try {
    assert.deepEqual(await deliverInvitationEmail(invitation), { ok: true });
    assert.ok(message);
    assert.match(message.html, /Harbor &lt;Operations&gt;/);
    assert.match(message.html, /Ava &amp; Co\./);
    assert.doesNotMatch(message.html, /Harbor <Operations>/);
  } finally { setEmailTransportForTests(null); }
});

test("reports a fake provider failure", async () => {
  setEmailTransportForTests({ send: async () => { throw new Error("provider unavailable"); } });
  try {
    assert.deepEqual(await deliverInvitationEmail(invitation), { ok: false, category: "transport", message: "The email provider could not deliver this invitation" });
  } finally { setEmailTransportForTests(null); }
});
