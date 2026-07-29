import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { canManageInvitation } from "@/lib/auth/invitations";
import { prisma } from "@/lib/db/prisma";

type InvitationDatabase = Pick<PrismaClient, "$transaction">;

export type InvitationTransitionActor = {
  id: string;
  email: string;
  displayName: string;
};

export type InvitationTransitionResult =
  | { ok: true; organizationId: string; organizationSlug?: string }
  | { ok: false; reason: "not_found" | "forbidden" | "conflict" | "email_mismatch" };

class InvitationClaimConflict extends Error {}

async function ensureAuditActor(tx: Prisma.TransactionClient, actor: InvitationTransitionActor) {
  const existing = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } });
  if (!existing) {
    await tx.user.create({
      data: {
        id: actor.id,
        email: actor.email,
        displayName: actor.displayName,
        platformRole: "USER",
        isActive: true,
      },
    });
  }
}

export async function acceptOrganizationInvitation(
  input: {
    tokenHash: string;
    actor: InvitationTransitionActor;
    now?: Date;
  },
  db: InvitationDatabase = prisma,
): Promise<InvitationTransitionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const now = input.now ?? new Date();
      const candidate = await tx.organizationInvitation.findUnique({
        where: { tokenHash: input.tokenHash },
        include: { organization: { select: { slug: true, isActive: true } } },
      });
      if (!candidate || !candidate.organization.isActive) {
        return { ok: false, reason: "not_found" } as const;
      }
      if (candidate.email !== input.actor.email) {
        return { ok: false, reason: "email_mismatch" } as const;
      }

      const existingUser = await tx.user.findUnique({
        where: { id: input.actor.id },
        select: { displayName: true },
      });
      const user = await tx.user.upsert({
        where: { id: input.actor.id },
        create: {
          id: input.actor.id,
          email: input.actor.email,
          displayName: input.actor.displayName,
          platformRole: "USER",
          isActive: true,
        },
        update: { email: input.actor.email, isActive: true },
      });
      const claimed = await tx.organizationInvitation.updateMany({
        where: {
          id: candidate.id,
          tokenHash: input.tokenHash,
          status: "PENDING",
          acceptedAt: null,
          acceptedById: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
          acceptedById: user.id,
          pendingKey: null,
        },
      });
      if (claimed.count !== 1) throw new InvitationClaimConflict();

      const invitation = await tx.organizationInvitation.findUnique({
        where: { id: candidate.id },
        include: { organization: { select: { slug: true } } },
      });
      if (!invitation) throw new Error("Claimed invitation could not be loaded");

      const membershipKey = {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: user.id,
        },
      };
      const existingMembership = await tx.organizationMember.findUnique({ where: membershipKey });
      if (!existingMembership) {
        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
            isActive: true,
          },
        });
      } else if (!existingMembership.isActive) {
        await tx.organizationMember.update({ where: membershipKey, data: { isActive: true } });
      }

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: invitation.organizationId,
        actor: {
          id: user.id,
          email: input.actor.email,
          displayName: existingUser?.displayName || input.actor.displayName,
        },
        action: "ACCEPT_INVITATION",
        entityType: "OrganizationInvitation",
        entityId: invitation.id,
        entityName: invitation.email,
        beforeData: { status: "PENDING", role: invitation.role },
        afterData: {
          status: invitation.status,
          acceptedAt: invitation.acceptedAt,
          acceptedById: invitation.acceptedById,
        },
        metadata: { membershipAlreadyExisted: Boolean(existingMembership) },
      });
      return {
        ok: true,
        organizationId: invitation.organizationId,
        organizationSlug: invitation.organization.slug,
      } as const;
    });
  } catch (error) {
    if (error instanceof InvitationClaimConflict) {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }
}

export async function declineOrganizationInvitation(
  input: {
    invitationId: string;
    invitedEmail: string;
    actor: InvitationTransitionActor;
    now?: Date;
  },
  db: InvitationDatabase = prisma,
): Promise<InvitationTransitionResult> {
  return db.$transaction(async (tx) => {
    const now = input.now ?? new Date();
    const claimed = await tx.organizationInvitation.updateMany({
      where: {
        id: input.invitationId,
        email: input.invitedEmail,
        status: "PENDING",
        acceptedAt: null,
        acceptedById: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { status: "DECLINED", pendingKey: null },
    });
    if (claimed.count !== 1) {
      const visible = await tx.organizationInvitation.findFirst({
        where: { id: input.invitationId, email: input.invitedEmail },
        select: { id: true },
      });
      return { ok: false, reason: visible ? "conflict" : "not_found" } as const;
    }

    const invitation = await tx.organizationInvitation.findUnique({
      where: { id: input.invitationId },
    });
    if (!invitation) throw new Error("Claimed invitation could not be loaded");
    await ensureAuditActor(tx, input.actor);
    await createAuditLog(tx, {
      scope: "ORGANIZATION",
      organizationId: invitation.organizationId,
      actor: input.actor,
      action: "DECLINE_INVITATION",
      entityType: "OrganizationInvitation",
      entityId: invitation.id,
      entityName: invitation.email,
      beforeData: { status: "PENDING", role: invitation.role },
      afterData: {
        status: invitation.status,
        acceptedAt: invitation.acceptedAt,
        acceptedById: invitation.acceptedById,
        revokedAt: invitation.revokedAt,
      },
    });
    return { ok: true, organizationId: invitation.organizationId } as const;
  });
}

export async function revokeOrganizationInvitation(
  input: {
    invitationId: string;
    organizationId: string;
    organizationRole: "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
    actor: InvitationTransitionActor;
    now?: Date;
  },
  db: InvitationDatabase = prisma,
): Promise<InvitationTransitionResult> {
  return db.$transaction(async (tx) => {
    const candidate = await tx.organizationInvitation.findFirst({
      where: { id: input.invitationId, organizationId: input.organizationId },
      select: { role: true },
    });
    if (!candidate) return { ok: false, reason: "not_found" } as const;
    if (!canManageInvitation(input.organizationRole, candidate.role)) {
      return { ok: false, reason: "forbidden" } as const;
    }

    const now = input.now ?? new Date();
    const claimed = await tx.organizationInvitation.updateMany({
      where: {
        id: input.invitationId,
        organizationId: input.organizationId,
        status: "PENDING",
        acceptedAt: null,
        acceptedById: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { status: "REVOKED", revokedAt: now, pendingKey: null },
    });
    if (claimed.count !== 1) return { ok: false, reason: "conflict" } as const;

    const invitation = await tx.organizationInvitation.findUnique({
      where: { id: input.invitationId },
    });
    if (!invitation) throw new Error("Claimed invitation could not be loaded");
    await createAuditLog(tx, {
      scope: "ORGANIZATION",
      organizationId: invitation.organizationId,
      actor: input.actor,
      action: "REVOKE_INVITATION",
      entityType: "OrganizationInvitation",
      entityId: invitation.id,
      entityName: invitation.email,
      beforeData: { status: "PENDING", role: invitation.role },
      afterData: {
        status: invitation.status,
        acceptedAt: invitation.acceptedAt,
        acceptedById: invitation.acceptedById,
        revokedAt: invitation.revokedAt,
      },
    });
    return { ok: true, organizationId: invitation.organizationId } as const;
  });
}
