import type { AuditEntityType } from "@/lib/audit/entity-types";

export function buildAuditHistoryUrl(entityType: AuditEntityType, entityId: string): string {
  const params = new URLSearchParams({
    entityType,
    entityId,
  });

  return `/audit-logs?${params.toString()}`;
}
