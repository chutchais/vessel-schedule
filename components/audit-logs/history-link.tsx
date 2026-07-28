"use client";

import Link from "next/link";
import type { AuditEntityType } from "@/lib/audit/entity-types";
import { buildAuditHistoryUrl } from "@/lib/audit/history-url";

type HistoryLinkProps = {
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  className?: string;
};

export function HistoryLink({ entityType, entityId, entityLabel, className = "" }: HistoryLinkProps) {
  return (
    <Link
      href={buildAuditHistoryUrl(entityType, entityId)}
      className={[
        "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        className,
      ].filter(Boolean).join(" ")}
      aria-label={`View history for ${entityLabel}`}
    >
      History
    </Link>
  );
}
