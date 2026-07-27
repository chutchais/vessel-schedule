"use client";

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

export function AuditLogManager() {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedLog, setSelectedLog] = useState<AuditLogDetailResponse["data"] | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const actorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    logs.forEach((log) => {
      if (log.actorUserId) {
        unique.set(log.actorUserId, `${log.actorDisplayName ?? "Unknown"} (${log.actorEmail ?? "no-email"})`);
      }
    });
    return Array.from(unique.entries());
  }, [logs]);

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
      if (entityType.trim()) params.set("entityType", entityType.trim());
      if (actorUserId) params.set("actorUserId", actorUserId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/audit-logs?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: AuditLogListItem[];
        pagination?: Pagination;
        error?: string;
      };

      if (!response.ok || !payload.data || !payload.pagination) {
        throw new Error(payload.error ?? "Failed to load audit logs");
      }

      setLogs(payload.data);
      setPagination(payload.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [action, actorUserId, dateFrom, dateTo, entityType, page, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, action, entityType, actorUserId, dateFrom, dateTo]);

  async function openDetails(id: string) {
    const response = await fetch(`/api/audit-logs/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as AuditLogDetailResponse & { error?: string };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load audit log details");
    }
    setSelectedLog(payload.data);
    setIsDetailsOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" description="Review activity within your organization" />

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input placeholder="Search logs..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <Select value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        <Input placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
        <Select value={actorUserId} onChange={(event) => setActorUserId(event.target.value)}>
          <option value="">All actors</option>
          {actorOptions.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <div className="md:col-span-3 flex justify-between">
          <p className="text-sm text-slate-500">{pagination.total} results</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearchInput("");
              setAction("");
              setEntityType("");
              setActorUserId("");
              setDateFrom("");
              setDateTo("");
            }}
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
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        )}
      >
        {isLoading ? (
          <LoadingState message="Loading audit logs..." />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit logs found" description="Try adjusting filters." className="m-4" />
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
                    <td className="px-4 py-3">{log.entityType}</td>
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
