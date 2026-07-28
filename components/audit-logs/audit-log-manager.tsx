"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditLogDetails } from "@/components/audit-logs/audit-log-details";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { TableContainer } from "@/components/ui/table-container";
import { createAuditSummary } from "@/lib/audit/audit-summary";
import { AUDIT_ENTITY_TYPES, ORGANIZATION_AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

type AuditLogListItem = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorDisplayName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditLogContext = {
  entityType: string;
  entityId: string;
  entityName: string | null;
};

type AuditLogDetailResponse = {
  data: {
    id: string;
    scope: "ORGANIZATION" | "PLATFORM";
    organizationId: string | null;
    organization?: { id: string; name: string; slug: string } | null;
    actorEmail: string | null;
    actorDisplayName: string | null;
    action: string;
    entityType: string;
    entityId: string;
    entityName: string | null;
    beforeData: unknown;
    afterData: unknown;
    metadata: unknown;
    createdAt: string;
  };
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "ACTIVATE",
  "DEACTIVATE",
  "INVITE",
  "RESEND_INVITATION",
  "REVOKE_INVITATION",
  "ACCEPT_INVITATION",
  "DECLINE_INVITATION",
  "CHANGE_ROLE",
  "ACTIVATE_MEMBER",
  "DEACTIVATE_MEMBER",
  "TRANSFER_OWNERSHIP",
] as const;

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  ACTIVATE: "bg-green-100 text-green-700",
  DEACTIVATE: "bg-slate-100 text-slate-700",
  INVITE: "bg-blue-100 text-blue-700",
  RESEND_INVITATION: "bg-blue-100 text-blue-700",
  REVOKE_INVITATION: "bg-red-100 text-red-700",
  ACCEPT_INVITATION: "bg-green-100 text-green-700",
  DECLINE_INVITATION: "bg-red-100 text-red-700",
  CHANGE_ROLE: "bg-purple-100 text-purple-700",
  ACTIVATE_MEMBER: "bg-green-100 text-green-700",
  DEACTIVATE_MEMBER: "bg-slate-100 text-slate-700",
  TRANSFER_OWNERSHIP: "bg-purple-100 text-purple-700",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  [AUDIT_ENTITY_TYPES.COMPANY]: "Company",
  [AUDIT_ENTITY_TYPES.PORT]: "Port",
  [AUDIT_ENTITY_TYPES.TERMINAL]: "Terminal",
  [AUDIT_ENTITY_TYPES.BERTH]: "Berth",
  [AUDIT_ENTITY_TYPES.VESSEL]: "Vessel",
  [AUDIT_ENTITY_TYPES.SERVICE]: "Service",
  [AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE]: "Vessel Schedule",
};

function getShortIdentifier(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function parsePositiveInt(input: string | null, fallback: number): number {
  const parsed = Number.parseInt(input ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function AuditLogManager() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [context, setContext] = useState<AuditLogContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedLog, setSelectedLog] = useState<AuditLogDetailResponse["data"] | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const search = searchParams.get("search")?.trim() ?? "";
  const action = searchParams.get("action")?.trim() ?? "";
  const entityType = searchParams.get("entityType")?.trim() ?? "";
  const entityId = searchParams.get("entityId")?.trim() ?? "";
  const actorUserId = searchParams.get("actorUserId")?.trim() ?? "";
  const dateFrom = searchParams.get("dateFrom")?.trim() ?? "";
  const dateTo = searchParams.get("dateTo")?.trim() ?? "";

  const replaceQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) {
      return;
    }

    router.push(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams]);

  const actorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    logs.forEach((log) => {
      if (log.actorUserId) {
        unique.set(log.actorUserId, `${log.actorDisplayName ?? "Unknown"} (${log.actorEmail ?? "no-email"})`);
      }
    });
    return Array.from(unique.entries());
  }, [logs]);

  const isObjectHistoryMode = Boolean(entityType && entityId);

  const objectHistoryTitle = !isObjectHistoryMode
    ? "Audit Logs"
    : `${ENTITY_TYPE_LABELS[entityType] ?? entityType} History`;

  const objectHistoryName = !isObjectHistoryMode
    ? null
    : (context?.entityName ?? `Record ${getShortIdentifier(entityId)}`);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
      });
      if (search) params.set("search", search);
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      if (actorUserId) params.set("actorUserId", actorUserId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/audit-logs?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: AuditLogListItem[];
        pagination?: Pagination;
        context?: AuditLogContext;
        error?: string;
      };

      if (!response.ok || !payload.data || !payload.pagination) {
        throw new Error(payload.error ?? "Failed to load audit logs");
      }

      setLogs(payload.data);
      setPagination(payload.pagination);
      setContext(payload.context ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs");
      setLogs([]);
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [action, actorUserId, dateFrom, dateTo, entityId, entityType, page, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  async function openDetails(id: string) {
    const response = await fetch(`/api/audit-logs/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as AuditLogDetailResponse & { error?: string };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load audit log details");
    }
    setSelectedLog(payload.data);
    setIsDetailsOpen(true);
  }

  function clearFilters() {
    replaceQuery({
      search: null,
      action: null,
      actorUserId: null,
      dateFrom: null,
      dateTo: null,
      page: "1",
      ...(isObjectHistoryMode ? {} : { entityType: null, entityId: null }),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={objectHistoryTitle}
        description={isObjectHistoryMode ? "Review change history for a single record" : "Review activity within your organization"}
      />

      {isObjectHistoryMode ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">{objectHistoryName}</p>
          <p className="mt-1 text-xs text-blue-700">
            Results are limited to this {ENTITY_TYPE_LABELS[entityType]?.toLowerCase() ?? "record"}.
          </p>
          <Link
            href="/audit-logs"
            className="mt-3 inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            View All Audit Logs
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={(event) => {
            replaceQuery({
              search: event.target.value.trim() || null,
              page: "1",
            });
          }}
        />
        <Select
          value={action}
          onChange={(event) => {
            const nextAction = event.target.value;
            replaceQuery({
              action: nextAction || null,
              page: "1",
            });
          }}
        >
          <option value="">All actions</option>
          {ACTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        {!isObjectHistoryMode ? (
          <Select
            value={entityType}
            onChange={(event) => {
              const nextEntityType = event.target.value;
              replaceQuery({
                entityType: nextEntityType || null,
                entityId: null,
                page: "1",
              });
            }}
          >
            <option value="">All entity types</option>
            {ORGANIZATION_AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENTITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={actorUserId}
          onChange={(event) => {
            const nextActorUserId = event.target.value;
            replaceQuery({
              actorUserId: nextActorUserId || null,
              page: "1",
            });
          }}
        >
          <option value="">All actors</option>
          {actorOptions.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            const nextDateFrom = event.target.value;
            replaceQuery({
              dateFrom: nextDateFrom || null,
              page: "1",
            });
          }}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => {
            const nextDateTo = event.target.value;
            replaceQuery({
              dateTo: nextDateTo || null,
              page: "1",
            });
          }}
        />
        <div className={`${isObjectHistoryMode ? "md:col-span-3" : "md:col-span-3"} flex justify-between`}>
          <p className="text-sm text-slate-500">{pagination.total} results</p>
          <Button
            variant="secondary"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      </div>

      {error ? <AlertMessage type="error" message={error} /> : null}

      <TableContainer
        footer={(
          <div className="flex items-center justify-between">
            <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => {
                  const nextPage = page - 1;
                  replaceQuery({ page: String(nextPage) });
                }}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  const nextPage = page + 1;
                  replaceQuery({ page: String(nextPage) });
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      >
        {isLoading ? (
          <LoadingState message="Loading audit logs..." />
        ) : logs.length === 0 ? (
          <EmptyState
            title={isObjectHistoryMode ? "No history is available for this record yet." : "No audit logs found"}
            description={isObjectHistoryMode ? "Some records may predate audit tracking." : "Try adjusting filters."}
            className="m-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Date/Time", "Actor", "Action", "Entity", "Entity Name", "Summary", ""].map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.actorDisplayName ?? "Unknown"}</p>
                      <p className="text-xs text-slate-500">{log.actorEmail ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={["rounded-full px-2 py-0.5 text-xs font-medium", ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"].join(" ")}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}</td>
                    <td className="px-4 py-3">{log.entityName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {createAuditSummary({
                        action: log.action,
                        entityType: log.entityType,
                        entityName: log.entityName,
                        actorDisplayName: log.actorDisplayName,
                        metadata: log.metadata,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="secondary" onClick={() => void openDetails(log.id)}>View details</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableContainer>

      <AuditLogDetails log={selectedLog} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </div>
  );
}
