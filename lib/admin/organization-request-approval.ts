import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import {
  provisionApprovalIdentity,
  type ApprovalIdentityResult,
} from "@/lib/supabase/admin";

type ApprovalDatabase = Pick<PrismaClient, "$transaction">;

export type ApprovalActor = {
  id: string;
  email: string;
  displayName: string;
  platformRole: string;
};

export type ApprovalFailureBoundary =
  | "after_claim"
  | "after_organization_creation"
  | "after_organization_link"
  | "after_local_owner_preparation"
  | "before_external_invitation"
  | "after_external_success"
  | "during_email_delivery"
  | "before_final_approval"
  | "during_audit_logging";

export type ApprovalExternalAdapter = {
  provisionIdentity(email: string): Promise<ApprovalIdentityResult>;
};

export type ApprovalResult =
  | { ok: true; organizationId: string; authUserId: string }
  | {
      ok: false;
      reason: "not_found" | "forbidden" | "conflict" | "invalid_email" | "recoverable_failure";
    };

type ApprovalInput = {
  requestId: string;
  organizationName: string;
  slug: string;
  reviewNotes?: string;
  actor: ApprovalActor;
  now?: Date;
  recoverApprovingBefore?: Date;
  failAt?: ApprovalFailureBoundary;
};

const realExternalAdapter: ApprovalExternalAdapter = {
  provisionIdentity: provisionApprovalIdentity,
};

class InjectedApprovalFailure extends Error {
  constructor(boundary: ApprovalFailureBoundary) {
    super(`Injected approval failure at ${boundary}`);
  }
}

function inject(input: ApprovalInput, boundary: ApprovalFailureBoundary) {
  if (input.failAt === boundary) throw new InjectedApprovalFailure(boundary);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createUniqueOrganization(
  tx: Prisma.TransactionClient,
  name: string,
  baseSlug: string,
  input: ApprovalInput,
) {
  let suffix = 1;
  while (true) {
    const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const existing = await tx.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      const organization = await tx.organization.create({
        data: { name, slug, isActive: true },
        select: { id: true, slug: true },
      });
      inject(input, "after_organization_creation");
      return organization;
    }
    suffix += 1;
  }
}

async function recordRecoverableFailure(
  db: ApprovalDatabase,
  input: ApprovalInput,
  claimId: string,
  safeReason: string,
) {
  await db.$transaction(async (tx) => {
    const failed = await tx.organizationRequest.updateMany({
      where: {
        id: input.requestId,
        status: "APPROVING",
        approvalClaimId: claimId,
      },
      data: {
        status: "APPROVAL_FAILED",
        failureReason: safeReason,
      },
    });
    if (failed.count !== 1) return;
    const request = await tx.organizationRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });
    await createAuditLog(tx, {
      scope: "PLATFORM",
      organizationId: request.organizationId,
      actor: input.actor,
      action: "APPROVE_REQUEST",
      entityType: "OrganizationRequest",
      entityId: request.id,
      entityName: request.organizationName,
      afterData: {
        status: request.status,
        organizationId: request.organizationId,
        approvalVersion: request.approvalVersion,
        approvalStage: request.approvalStage,
      },
      metadata: { outcome: "RECOVERABLE_FAILURE", failureCategory: safeReason },
    });
  });
}

export async function approveOrganizationRequest(
  input: ApprovalInput,
  db: ApprovalDatabase = prisma,
  externalAdapter: ApprovalExternalAdapter = realExternalAdapter,
): Promise<ApprovalResult> {
  if (input.actor.platformRole !== "SUPER_ADMIN") {
    return { ok: false, reason: "forbidden" };
  }

  const now = input.now ?? new Date();
  const recoverBefore =
    input.recoverApprovingBefore ?? new Date(now.getTime() - 5 * 60 * 1000);
  const claimId = randomUUID();

  const claim = await db.$transaction(async (tx) => {
    const candidate = await tx.organizationRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!candidate) return { kind: "not_found" } as const;
    if (!isValidEmail(candidate.requesterEmail)) return { kind: "invalid_email" } as const;

    const initialClaim = candidate.status === "PENDING" && candidate.organizationId === null;
    const failedRetry = candidate.status === "APPROVAL_FAILED";
    const abandonedRetry =
      candidate.status === "APPROVING" &&
      candidate.approvalClaimedAt !== null &&
      candidate.approvalClaimedAt <= recoverBefore;
    if (!initialClaim && !failedRetry && !abandonedRetry) {
      return { kind: "conflict" } as const;
    }

    const claimed = await tx.organizationRequest.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        organizationId: candidate.organizationId,
        approvalVersion: candidate.approvalVersion,
        ...(abandonedRetry
          ? { approvalClaimedAt: { lte: recoverBefore } }
          : { approvalClaimedAt: candidate.approvalClaimedAt }),
      },
      data: {
        status: "APPROVING",
        reviewedById: input.actor.id,
        reviewNotes: input.reviewNotes ?? candidate.reviewNotes,
        approvalStartedAt: candidate.approvalStartedAt ?? now,
        approvalClaimedAt: now,
        approvalClaimId: claimId,
        approvalVersion: { increment: 1 },
        approvalStage: candidate.approvalStage ?? "CLAIMED",
        failureReason: null,
      },
    });
    if (claimed.count !== 1) return { kind: "conflict" } as const;

    const request = await tx.organizationRequest.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    await createAuditLog(tx, {
      scope: "PLATFORM",
      organizationId: request.organizationId,
      actor: input.actor,
      action: "APPROVE_REQUEST",
      entityType: "OrganizationRequest",
      entityId: request.id,
      entityName: request.organizationName,
      beforeData: { status: candidate.status, approvalVersion: candidate.approvalVersion },
      afterData: {
        status: request.status,
        organizationId: request.organizationId,
        approvalVersion: request.approvalVersion,
        approvalStage: request.approvalStage,
      },
      metadata: {
        outcome: initialClaim ? "CLAIMED" : "RETRY_CLAIMED",
        recoveredAbandonedAttempt: abandonedRetry,
      },
    });
    return { kind: "claimed", request } as const;
  });

  if (claim.kind !== "claimed") {
    return { ok: false, reason: claim.kind };
  }

  try {
    inject(input, "after_claim");
    let claimedRequest = claim.request;

    if (!claimedRequest.organizationId) {
      claimedRequest = await db.$transaction(async (tx) => {
        const organization = await createUniqueOrganization(
          tx,
          input.organizationName,
          input.slug,
          input,
        );
        const linked = await tx.organizationRequest.updateMany({
          where: {
            id: input.requestId,
            status: "APPROVING",
            approvalClaimId: claimId,
            organizationId: null,
          },
          data: {
            organizationId: organization.id,
            slug: organization.slug,
            approvalStage: "ORGANIZATION_LINKED",
          },
        });
        if (linked.count !== 1) throw new Error("Approval claim was lost");
        inject(input, "after_organization_link");
        return tx.organizationRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      });
    }

    let authUserId = claimedRequest.authUserId;
    let invitationOutcome: "INVITED" | "ALREADY_EXISTS" | "ALREADY_LINKED" =
      authUserId ? "ALREADY_LINKED" : "INVITED";
    if (!authUserId) {
      await db.$transaction(async (tx) => {
        const pending = await tx.organizationRequest.updateMany({
          where: { id: input.requestId, status: "APPROVING", approvalClaimId: claimId },
          data: { approvalStage: "AUTH_INVITATION_PENDING" },
        });
        if (pending.count !== 1) throw new Error("Approval claim was lost");
      });
      inject(input, "before_external_invitation");
      inject(input, "during_email_delivery");
      const external = await externalAdapter.provisionIdentity(claimedRequest.requesterEmail);
      if (!external.ok) throw new Error(external.message);
      authUserId = external.userId;
      invitationOutcome = external.outcome;
      inject(input, "after_external_success");
      const persisted = await db.$transaction(async (tx) =>
        tx.organizationRequest.updateMany({
          where: { id: input.requestId, status: "APPROVING", approvalClaimId: claimId },
          data: {
            authUserId,
            invitationSentAt: external.outcome === "INVITED" ? now : claimedRequest.invitationSentAt,
            approvalStage: "AUTH_IDENTITY_LINKED",
          },
        }),
      );
      if (persisted.count !== 1) throw new Error("Approval claim was lost");
    }

    const organizationId = claimedRequest.organizationId;
    if (!organizationId || !authUserId) throw new Error("Approval progress is incomplete");

    await db.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId,
          email: claimedRequest.requesterEmail,
          displayName: claimedRequest.requesterName,
          platformRole: "USER",
          isActive: true,
        },
        update: {
          email: claimedRequest.requesterEmail,
          displayName: claimedRequest.requesterName,
          isActive: true,
        },
      });
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId, userId: authUserId } },
        create: { organizationId, userId: authUserId, role: "OWNER", isActive: true },
        update: { role: "OWNER", isActive: true },
      });
      inject(input, "after_local_owner_preparation");
      inject(input, "before_final_approval");
      const approved = await tx.organizationRequest.updateMany({
        where: { id: input.requestId, status: "APPROVING", approvalClaimId: claimId },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          failureReason: null,
        },
      });
      if (approved.count !== 1) throw new Error("Approval claim was lost");
      const completed = await tx.organizationRequest.findUniqueOrThrow({
        where: { id: input.requestId },
      });
      inject(input, "during_audit_logging");
      await createAuditLog(tx, {
        scope: "PLATFORM",
        organizationId,
        actor: input.actor,
        action: "APPROVE_REQUEST",
        entityType: "OrganizationRequest",
        entityId: input.requestId,
        entityName: completed.organizationName,
        beforeData: {
          status: "APPROVING",
          approvalVersion: completed.approvalVersion,
          approvalStage: completed.approvalStage,
        },
        afterData: {
          status: completed.status,
          organizationId,
          authUserId,
          reviewedAt: completed.reviewedAt,
        },
        metadata: {
          outcome: "APPROVED",
          invitationOutcome,
          ownerRole: "OWNER",
        },
      });
    });
    return { ok: true, organizationId, authUserId };
  } catch (error) {
    const category =
      error instanceof InjectedApprovalFailure
        ? `injected_${error.message.split(" ").at(-1)}`
        : "approval_step_failed";
    await recordRecoverableFailure(db, input, claimId, category);
    return { ok: false, reason: "recoverable_failure" };
  }
}
