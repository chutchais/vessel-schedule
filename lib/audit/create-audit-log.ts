import { Prisma } from "@/generated/prisma/client";
import type { AuditAction, AuditScope } from "@/generated/prisma/client";
import { sanitizeAuditData } from "@/lib/audit/sanitize-audit-data";

export type CreateAuditLogInput = {
  scope: AuditScope;
  organizationId?: string | null;
  actor: {
    id: string;
    email: string;
    displayName: string;
  };
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};

export async function createAuditLog(
  tx: Prisma.TransactionClient,
  input: CreateAuditLogInput,
) {
  if (input.scope === "ORGANIZATION" && !input.organizationId) {
    throw new Error("organizationId is required for ORGANIZATION audit scope");
  }

  const beforeData = sanitizeAuditData(input.beforeData, "beforeData");
  const afterData = sanitizeAuditData(input.afterData, "afterData");
  const metadata = sanitizeAuditData(input.metadata, "metadata");

  return tx.auditLog.create({
    data: {
      scope: input.scope,
      organizationId: input.organizationId ?? null,
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      actorDisplayName: input.actor.displayName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName ?? null,
      beforeData: beforeData === undefined ? undefined : beforeData === null ? Prisma.JsonNull : beforeData,
      afterData: afterData === undefined ? undefined : afterData === null ? Prisma.JsonNull : afterData,
      metadata: metadata === undefined ? undefined : metadata === null ? Prisma.JsonNull : metadata,
    },
  });
}
