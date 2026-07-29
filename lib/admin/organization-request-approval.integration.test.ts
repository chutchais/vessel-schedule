import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertDatabaseTarget } from "@/lib/db/target-guard";
import {
  approveOrganizationRequest,
  type ApprovalActor,
  type ApprovalExternalAdapter,
  type ApprovalFailureBoundary,
} from "./organization-request-approval";

const testDatabaseUrl = process.env.RB3_TEST_DATABASE_URL;
if (testDatabaseUrl) assertDatabaseTarget({ purpose: "integration-test", connectionUrl: testDatabaseUrl });
const integrationTest = testDatabaseUrl ? test : test.skip;
const prisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) })
  : null;
const prefix = `rb3-${process.pid}-`;
let sequence = 0;

function next(label: string) {
  sequence += 1;
  return `${prefix}${label}-${sequence}`;
}

class FakeExternalAdapter implements ApprovalExternalAdapter {
  readonly identities = new Map<string, string>();
  calls = 0;
  invitationsSent = 0;
  failNext = false;

  async provisionIdentity(email: string) {
    this.calls += 1;
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, category: "provider", message: "deterministic provider failure" } as const;
    }
    const existing = this.identities.get(email);
    if (existing) {
      return { ok: true, userId: existing, outcome: "ALREADY_EXISTS" } as const;
    }
    const userId = randomUUID();
    this.identities.set(email, userId);
    this.invitationsSent += 1;
    return { ok: true, userId, outcome: "INVITED" } as const;
  }
}

async function createAdmin(platformRole: "SUPER_ADMIN" | "USER" = "SUPER_ADMIN") {
  if (!prisma) throw new Error("RB3_TEST_DATABASE_URL is required");
  const actor: ApprovalActor = {
    id: randomUUID(),
    email: `${next("admin")}@example.test`,
    displayName: "RB3 Administrator",
    platformRole,
  };
  await prisma.user.create({
    data: {
      id: actor.id,
      email: actor.email,
      displayName: actor.displayName,
      platformRole,
    },
  });
  return actor;
}

async function createRequest(
  overrides: Partial<{
    status: "PENDING" | "APPROVING" | "APPROVED" | "REJECTED" | "APPROVAL_FAILED";
    requesterEmail: string;
    organizationId: string;
    approvalClaimedAt: Date;
    approvalClaimId: string;
    approvalVersion: number;
  }> = {},
) {
  if (!prisma) throw new Error("RB3_TEST_DATABASE_URL is required");
  return prisma.organizationRequest.create({
    data: {
      organizationName: next("organization"),
      requesterName: "RB3 Owner",
      requesterEmail: overrides.requesterEmail ?? `${next("owner")}@example.test`,
      status: overrides.status,
      organizationId: overrides.organizationId,
      approvalClaimedAt: overrides.approvalClaimedAt,
      approvalClaimId: overrides.approvalClaimId,
      approvalVersion: overrides.approvalVersion,
      approvalStage: overrides.status === "APPROVING" ? "CLAIMED" : undefined,
    },
  });
}

function approvalInput(requestId: string, actor: ApprovalActor) {
  return {
    requestId,
    organizationName: next("approved-organization"),
    slug: next("approved-org"),
    reviewNotes: "RB3 integration test",
    actor,
  };
}

async function assertApproved(requestId: string, adapter: FakeExternalAdapter) {
  if (!prisma) throw new Error("RB3_TEST_DATABASE_URL is required");
  const request = await prisma.organizationRequest.findUniqueOrThrow({ where: { id: requestId } });
  assert.equal(request.status, "APPROVED");
  assert.ok(request.organizationId);
  assert.ok(request.authUserId);
  assert.ok(request.reviewedAt);
  assert.equal(request.failureReason, null);
  assert.equal(
    await prisma.organization.count({ where: { requestsForOrganization: { some: { id: requestId } } } }),
    1,
  );
  assert.equal(
    await prisma.organizationMember.count({
      where: {
        organizationId: request.organizationId!,
        userId: request.authUserId!,
        role: "OWNER",
        isActive: true,
      },
    }),
    1,
  );
  assert.equal(adapter.invitationsSent, 1);
  const audits = await prisma.auditLog.findMany({
    where: { entityType: "OrganizationRequest", entityId: requestId, action: "APPROVE_REQUEST" },
  });
  const successAudits = audits.filter((audit) => {
    const metadata = audit.metadata as { outcome?: string } | null;
    return metadata?.outcome === "APPROVED";
  });
  assert.equal(successAudits.length, 1);
}

before(async () => {
  if (!prisma) return;
  await prisma.organizationRequest.deleteMany({ where: { organizationName: { startsWith: prefix } } });
  await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
});

after(async () => {
  if (!prisma) return;
  await prisma.organizationRequest.deleteMany({ where: { organizationName: { startsWith: prefix } } });
  await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.$disconnect();
});

integrationTest("two administrators concurrently approve one request with one winner", async () => {
  const [firstAdmin, secondAdmin] = await Promise.all([createAdmin(), createAdmin()]);
  const request = await createRequest();
  const adapter = new FakeExternalAdapter();
  const results = await Promise.all([
    approveOrganizationRequest(approvalInput(request.id, firstAdmin), prisma!, adapter),
    approveOrganizationRequest(approvalInput(request.id, secondAdmin), prisma!, adapter),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.deepEqual(results.find((result) => !result.ok), { ok: false, reason: "conflict" });
  await assertApproved(request.id, adapter);
});

integrationTest("repeated approval after success returns conflict without side effects", async () => {
  const admin = await createAdmin();
  const request = await createRequest();
  const adapter = new FakeExternalAdapter();
  assert.equal((await approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter)).ok, true);
  const firstCallCount = adapter.calls;
  const retries = await Promise.all([
    approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter),
    approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter),
  ]);
  assert.ok(retries.every((result) => !result.ok && result.reason === "conflict"));
  assert.equal(adapter.calls, firstCallCount);
  await assertApproved(request.id, adapter);
});

const boundaries: ApprovalFailureBoundary[] = [
  "after_claim",
  "after_organization_creation",
  "after_organization_link",
  "after_local_owner_preparation",
  "before_external_invitation",
  "after_external_success",
  "during_email_delivery",
  "before_final_approval",
  "during_audit_logging",
];

for (const boundary of boundaries) {
  integrationTest(`retry resumes safely after ${boundary}`, async () => {
    const admin = await createAdmin();
    const request = await createRequest();
    const adapter = new FakeExternalAdapter();
    const firstInput = approvalInput(request.id, admin);
    const failed = await approveOrganizationRequest({ ...firstInput, failAt: boundary }, prisma!, adapter);
    assert.deepEqual(failed, { ok: false, reason: "recoverable_failure" });
    const persistedFailure = await prisma!.organizationRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    assert.equal(persistedFailure.status, "APPROVAL_FAILED");
    const persistedOrganizationId = persistedFailure.organizationId;
    const retried = await approveOrganizationRequest(firstInput, prisma!, adapter);
    assert.equal(retried.ok, true);
    const completed = await prisma!.organizationRequest.findUniqueOrThrow({ where: { id: request.id } });
    if (persistedOrganizationId) assert.equal(completed.organizationId, persistedOrganizationId);
    await assertApproved(request.id, adapter);
    const failureAudits = await prisma!.auditLog.findMany({
      where: { entityType: "OrganizationRequest", entityId: request.id },
    });
    assert.equal(
      failureAudits.filter((audit) => {
        const metadata = audit.metadata as { outcome?: string } | null;
        return metadata?.outcome === "RECOVERABLE_FAILURE";
      }).length,
      1,
    );
  });
}

integrationTest("provider failure is retryable and already-existing identity is reusable", async () => {
  const admin = await createAdmin();
  const request = await createRequest();
  const adapter = new FakeExternalAdapter();
  adapter.failNext = true;
  assert.deepEqual(
    await approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter),
    { ok: false, reason: "recoverable_failure" },
  );
  const existingId = randomUUID();
  adapter.identities.set(request.requesterEmail, existingId);
  const retried = await approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter);
  assert.equal(retried.ok, true);
  const completed = await prisma!.organizationRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(completed.authUserId, existingId);
  assert.equal(adapter.invitationsSent, 0);
});

integrationTest("rejected and approved requests cannot be approved", async () => {
  const admin = await createAdmin();
  const adapter = new FakeExternalAdapter();
  const rejected = await createRequest({ status: "REJECTED" });
  const approved = await createRequest({ status: "APPROVED" });
  for (const request of [rejected, approved]) {
    assert.deepEqual(
      await approveOrganizationRequest(approvalInput(request.id, admin), prisma!, adapter),
      { ok: false, reason: "conflict" },
    );
  }
  assert.equal(adapter.calls, 0);
});

integrationTest("an abandoned APPROVING request can be version-claimed and recovered", async () => {
  const admin = await createAdmin();
  const request = await createRequest({
    status: "APPROVING",
    approvalClaimId: randomUUID(),
    approvalClaimedAt: new Date(Date.now() - 60_000),
    approvalVersion: 4,
  });
  const adapter = new FakeExternalAdapter();
  const result = await approveOrganizationRequest(
    {
      ...approvalInput(request.id, admin),
      recoverApprovingBefore: new Date(),
    },
    prisma!,
    adapter,
  );
  assert.equal(result.ok, true);
  const completed = await prisma!.organizationRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(completed.approvalVersion, 5);
  await assertApproved(request.id, adapter);
});

integrationTest("unauthorized actors are rejected before database or provider side effects", async () => {
  const unauthorized = await createAdmin("USER");
  const request = await createRequest();
  const adapter = new FakeExternalAdapter();
  assert.deepEqual(
    await approveOrganizationRequest(approvalInput(request.id, unauthorized), prisma!, adapter),
    { ok: false, reason: "forbidden" },
  );
  assert.equal(adapter.calls, 0);
  assert.equal((await prisma!.organizationRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PENDING");
});

integrationTest("different requests with the same normalized data remain isolated", async () => {
  const [firstAdmin, secondAdmin] = await Promise.all([createAdmin(), createAdmin()]);
  const email = `${next("shared-owner")}@example.test`;
  const [first, second] = await Promise.all([
    createRequest({ requesterEmail: email }),
    createRequest({ requesterEmail: email }),
  ]);
  const adapter = new FakeExternalAdapter();
  const base = next("shared-org");
  const [firstResult, secondResult] = await Promise.all([
    approveOrganizationRequest(
      { ...approvalInput(first.id, firstAdmin), organizationName: "Shared Name", slug: base },
      prisma!,
      adapter,
    ),
    approveOrganizationRequest(
      { ...approvalInput(second.id, secondAdmin), organizationName: "Shared Name", slug: base },
      prisma!,
      adapter,
    ),
  ]);
  if (!firstResult.ok || !secondResult.ok) {
    for (const request of [first, second]) {
      const current = await prisma!.organizationRequest.findUniqueOrThrow({ where: { id: request.id } });
      if (current.status === "APPROVAL_FAILED") {
        assert.equal(
          (
            await approveOrganizationRequest(
              { ...approvalInput(request.id, firstAdmin), organizationName: "Shared Name", slug: base },
              prisma!,
              adapter,
            )
          ).ok,
          true,
        );
      }
    }
  }
  const requests = await prisma!.organizationRequest.findMany({ where: { id: { in: [first.id, second.id] } } });
  assert.ok(requests.every((request) => request.status === "APPROVED"));
  assert.equal(new Set(requests.map((request) => request.organizationId)).size, 2);
  assert.equal(adapter.invitationsSent, 1);
});
