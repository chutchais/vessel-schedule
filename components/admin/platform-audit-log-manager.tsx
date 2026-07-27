"use client";

import { useCallback, useEffect, useState } from "react";
import { AuditLogDetails, type AuditLogDetailsData } from "@/components/audit-logs/audit-log-details";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { TableContainer } from "@/components/ui/table-container";
import { createAuditSummary } from "@/lib/audit/audit-summary";

type AuditLogItem = {
  id: string;
  scope: "ORGANIZATION" | "PLATFORM";
  organizationId: string | null;
  organization: { id: string; name: string; slug: string } | null;
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

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const ACTIONS = [
  "",
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
  "APPROVE_REQUEST",
  "REJECT_REQUEST",
];

export function PlatformAuditLogManager() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedLog, setSelectedLog] = useState<AuditLogDetailsData | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search.trim()) params.set("search", search.trim());
      if (scope) params.set("scope", scope);
      if (organizationId.trim()) params.set("organizationId", organizationId.trim());
      if (action) params.set("action", action);
      if (entityType.trim()) params.set("entityType", entityType.trim());
      if (actorUserId.trim()) params.set("actorUserId", actorUserId.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: AuditLogItem[]; pagination?: Pagination; error?: string };
      if (!response.ok || !payload.data || !payload.pagination) {
        throw new Error(payload.error ?? "Failed to load platform audit logs");
      }

      setLogs(payload.data);
      setPagination(payload.pagination);
    } catch (loadError) {
      setLogs([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load platform audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [action, actorUserId, dateFrom, dateTo, entityType, organizationId, page, scope, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, scope, organizationId, action, entityType, actorUserId, dateFrom, dateTo]);

  async function openDetails(id: string) {
    const response = await fetch(`/api/admin/audit-logs/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as { data?: AuditLogDetailsData; error?: string };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load audit log details");
    }
    setSelectedLog(payload.data);
    setIsDetailsOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Platform Audit Logs" description="Review platform and organization audit activity" />

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="">PLATFORM (default)</option>
          <option value="all">All scopes</option>
          <option value="PLATFORM">PLATFORM only</option>
          <option value="ORGANIZATION">ORGANIZATION only</option>
        </Select>
        <Input placeholder="Organization ID" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} />
        <Select value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.filter(Boolean).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        <Input placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
        <Input placeholder="Actor User ID" value={actorUserId} onChange={(event) => setActorUserId(event.target.value)} />
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <div className="md:col-span-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">{pagination.total} results</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setScope("");
              setOrganizationId("");
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
                  {["Date", "Scope", "Organization", "Actor", "Action", "Entity", "Details", ""].map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{log.scope}</td>
                    <td className="px-4 py-3">{log.organization?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{log.actorDisplayName ?? "Unknown"}</p>
                      <p className="text-xs text-slate-500">{log.actorEmail ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.entityType} / {log.entityName ?? log.entityId}</td>
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
                      <Button variant="secondary" onClick={() => void openDetails(log.id)}>View</Button>
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
