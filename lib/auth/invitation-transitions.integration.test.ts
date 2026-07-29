import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertDatabaseTarget } from "@/lib/db/target-guard";
import {
  acceptOrganizationInvitation,
  declineOrganizationInvitation,
  revokeOrganizationInvitation,
  type InvitationTransitionActor,
  type InvitationTransitionResult,
} from "./invitation-transitions";

const testDatabaseUrl = process.env.RB1_TEST_DATABASE_URL;
if (testDatabaseUrl) assertDatabaseTarget({ purpose: "integration-test", connectionUrl: testDatabaseUrl });
const integrationTest = testDatabaseUrl ? test : test.skip;
const prisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) })
  : null;

const prefix = `rb1-${process.pid}-`;
let sequence = 0;

type Fixture = Awaited<ReturnType<typeof createFixture>>;

function nextValue(label: string) {
  sequence += 1;
  return `${prefix}${label}-${sequence}`;
}

async function createFixture(options: {
  role?: "ADMIN" | "PLANNER" | "VIEWER";
  expiresAt?: Date;
} = {}) {
  if (!prisma) throw new Error("RB1_TEST_DATABASE_URL is required");
  const owner: InvitationTransitionActor = {
    id: randomUUID(),
    email: `${nextValue("owner")}@example.test`,
    displayName: "RB1 Owner",
  };
  const invitee: InvitationTransitionActor = {
    id: randomUUID(),
    email: `${nextValue("invitee")}@example.test`,
    displayName: "RB1 Invitee",
  };
  const organization = await prisma.organization.create({
    data: { name: nextValue("organization"), slug: nextValue("org") },
  });
  await prisma.user.create({
    data: { id: owner.id, email: owner.email, displayName: owner.displayName },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      isActive: true,
    },
  });
  const tokenHash = Buffer.from(nextValue("token")).toString("hex").padEnd(64, "0").slice(0, 64);
  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: organization.id,
      email: invitee.email,
      role: options.role ?? "VIEWER",
      pendingKey: `${organization.id}:${invitee.email}`,
      tokenHash,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
      invitedById: owner.id,
    },
  });
  return { owner, invitee, organization, invitation, tokenHash };
}

async function transitionAuditCount(fixture: Fixture) {
  if (!prisma) throw new Error("RB1_TEST_DATABASE_URL is required");
  return prisma.auditLog.count({
    where: {
      entityType: "OrganizationInvitation",
      entityId: fixture.invitation.id,
      action: { in: ["ACCEPT_INVITATION", "DECLINE_INVITATION", "REVOKE_INVITATION"] },
    },
  });
}

async function assertTerminalConsistency(fixture: Fixture) {
  if (!prisma) throw new Error("RB1_TEST_DATABASE_URL is required");
  const invitation = await prisma.organizationInvitation.findUniqueOrThrow({
    where: { id: fixture.invitation.id },
  });
  const memberships = await prisma.organizationMember.count({
    where: {
      organizationId: fixture.organization.id,
      userId: fixture.invitee.id,
    },
  });
  assert.ok(["ACCEPTED", "DECLINED", "REVOKED"].includes(invitation.status));
  if (invitation.status === "ACCEPTED") {
    assert.ok(invitation.acceptedAt);
    assert.equal(invitation.acceptedById, fixture.invitee.id);
    assert.equal(invitation.revokedAt, null);
    assert.equal(memberships, 1);
  } else if (invitation.status === "DECLINED") {
    assert.equal(invitation.acceptedAt, null);
    assert.equal(invitation.acceptedById, null);
    assert.equal(invitation.revokedAt, null);
    assert.equal(memberships, 0);
  } else {
    assert.equal(invitation.acceptedAt, null);
    assert.equal(invitation.acceptedById, null);
    assert.ok(invitation.revokedAt);
    assert.equal(memberships, 0);
  }
  assert.equal(await transitionAuditCount(fixture), 1);
}

function assertOneWinner(results: InvitationTransitionResult[]) {
  assert.equal(results.filter((result) => result.ok).length, 1);
  const loser = results.find((result) => !result.ok);
  assert.deepEqual(loser, { ok: false, reason: "conflict" });
}

before(async () => {
  if (!prisma) return;
  await prisma.auditLog.deleteMany({ where: { entityName: { startsWith: prefix } } });
  await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
});

after(async () => {
  if (!prisma) return;
  await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.$disconnect();
});

integrationTest("accept versus decline has exactly one terminal winner", async () => {
  const fixture = await createFixture();
  const results = await Promise.all([
    acceptOrganizationInvitation(
      { tokenHash: fixture.tokenHash, actor: fixture.invitee },
      prisma!,
    ),
    declineOrganizationInvitation(
      {
        invitationId: fixture.invitation.id,
        invitedEmail: fixture.invitee.email,
        actor: fixture.invitee,
      },
      prisma!,
    ),
  ]);
  assertOneWinner(results);
  await assertTerminalConsistency(fixture);
});

integrationTest("accept versus revoke has exactly one terminal winner", async () => {
  const fixture = await createFixture();
  const results = await Promise.all([
    acceptOrganizationInvitation(
      { tokenHash: fixture.tokenHash, actor: fixture.invitee },
      prisma!,
    ),
    revokeOrganizationInvitation(
      {
        invitationId: fixture.invitation.id,
        organizationId: fixture.organization.id,
        organizationRole: "OWNER",
        actor: fixture.owner,
      },
      prisma!,
    ),
  ]);
  assertOneWinner(results);
  await assertTerminalConsistency(fixture);
});

integrationTest("two concurrent accepts create one membership and one audit", async () => {
  const fixture = await createFixture();
  const results = await Promise.all([
    acceptOrganizationInvitation({ tokenHash: fixture.tokenHash, actor: fixture.invitee }, prisma!),
    acceptOrganizationInvitation({ tokenHash: fixture.tokenHash, actor: fixture.invitee }, prisma!),
  ]);
  assertOneWinner(results);
  await assertTerminalConsistency(fixture);
});

integrationTest("two concurrent declines produce one audit", async () => {
  const fixture = await createFixture();
  const input = {
    invitationId: fixture.invitation.id,
    invitedEmail: fixture.invitee.email,
    actor: fixture.invitee,
  };
  const results = await Promise.all([
    declineOrganizationInvitation(input, prisma!),
    declineOrganizationInvitation(input, prisma!),
  ]);
  assertOneWinner(results);
  await assertTerminalConsistency(fixture);
});

integrationTest("two concurrent revokes produce one audit", async () => {
  const fixture = await createFixture();
  const input = {
    invitationId: fixture.invitation.id,
    organizationId: fixture.organization.id,
    organizationRole: "OWNER" as const,
    actor: fixture.owner,
  };
  const results = await Promise.all([
    revokeOrganizationInvitation(input, prisma!),
    revokeOrganizationInvitation(input, prisma!),
  ]);
  assertOneWinner(results);
  await assertTerminalConsistency(fixture);
});

integrationTest("decline and revoke reject expired invitations without audit", async () => {
  const declineFixture = await createFixture({ expiresAt: new Date(Date.now() - 60_000) });
  const revokeFixture = await createFixture({ expiresAt: new Date(Date.now() - 60_000) });
  const decline = await declineOrganizationInvitation(
    {
      invitationId: declineFixture.invitation.id,
      invitedEmail: declineFixture.invitee.email,
      actor: declineFixture.invitee,
    },
    prisma!,
  );
  const revoke = await revokeOrganizationInvitation(
    {
      invitationId: revokeFixture.invitation.id,
      organizationId: revokeFixture.organization.id,
      organizationRole: "OWNER",
      actor: revokeFixture.owner,
    },
    prisma!,
  );
  assert.deepEqual(decline, { ok: false, reason: "conflict" });
  assert.deepEqual(revoke, { ok: false, reason: "conflict" });
  assert.equal(await transitionAuditCount(declineFixture), 0);
  assert.equal(await transitionAuditCount(revokeFixture), 0);
});

integrationTest("decline and revoke cannot overwrite accepted invitations", async () => {
  const fixture = await createFixture();
  assert.equal(
    (await acceptOrganizationInvitation(
      { tokenHash: fixture.tokenHash, actor: fixture.invitee },
      prisma!,
    )).ok,
    true,
  );
  const [decline, revoke] = await Promise.all([
    declineOrganizationInvitation(
      {
        invitationId: fixture.invitation.id,
        invitedEmail: fixture.invitee.email,
        actor: fixture.invitee,
      },
      prisma!,
    ),
    revokeOrganizationInvitation(
      {
        invitationId: fixture.invitation.id,
        organizationId: fixture.organization.id,
        organizationRole: "OWNER",
        actor: fixture.owner,
      },
      prisma!,
    ),
  ]);
  assert.deepEqual(decline, { ok: false, reason: "conflict" });
  assert.deepEqual(revoke, { ok: false, reason: "conflict" });
  await assertTerminalConsistency(fixture);
});

integrationTest("accept cannot overwrite revoked or declined invitations", async () => {
  const revoked = await createFixture();
  const declined = await createFixture();
  assert.equal(
    (await revokeOrganizationInvitation(
      {
        invitationId: revoked.invitation.id,
        organizationId: revoked.organization.id,
        organizationRole: "OWNER",
        actor: revoked.owner,
      },
      prisma!,
    )).ok,
    true,
  );
  assert.equal(
    (await declineOrganizationInvitation(
      {
        invitationId: declined.invitation.id,
        invitedEmail: declined.invitee.email,
        actor: declined.invitee,
      },
      prisma!,
    )).ok,
    true,
  );
  assert.deepEqual(
    await acceptOrganizationInvitation(
      { tokenHash: revoked.tokenHash, actor: revoked.invitee },
      prisma!,
    ),
    { ok: false, reason: "conflict" },
  );
  assert.deepEqual(
    await acceptOrganizationInvitation(
      { tokenHash: declined.tokenHash, actor: declined.invitee },
      prisma!,
    ),
    { ok: false, reason: "conflict" },
  );
  await assertTerminalConsistency(revoked);
  await assertTerminalConsistency(declined);
});

integrationTest("revoke enforces organization isolation", async () => {
  const fixture = await createFixture();
  const other = await createFixture();
  const result = await revokeOrganizationInvitation(
    {
      invitationId: fixture.invitation.id,
      organizationId: other.organization.id,
      organizationRole: "OWNER",
      actor: other.owner,
    },
    prisma!,
  );
  assert.deepEqual(result, { ok: false, reason: "not_found" });
  const invitation = await prisma!.organizationInvitation.findUniqueOrThrow({
    where: { id: fixture.invitation.id },
  });
  assert.equal(invitation.status, "PENDING");
  assert.equal(await transitionAuditCount(fixture), 0);
});

integrationTest("revoke enforces role permissions", async () => {
  const fixture = await createFixture({ role: "ADMIN" });
  const result = await revokeOrganizationInvitation(
    {
      invitationId: fixture.invitation.id,
      organizationId: fixture.organization.id,
      organizationRole: "ADMIN",
      actor: fixture.owner,
    },
    prisma!,
  );
  assert.deepEqual(result, { ok: false, reason: "forbidden" });
  const invitation = await prisma!.organizationInvitation.findUniqueOrThrow({
    where: { id: fixture.invitation.id },
  });
  assert.equal(invitation.status, "PENDING");
  assert.equal(await transitionAuditCount(fixture), 0);
});
