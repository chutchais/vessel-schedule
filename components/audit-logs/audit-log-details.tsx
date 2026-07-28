"use client";

import { Drawer } from "@/components/ui/drawer";

export type AuditLogDetailsData = {
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

type Props = {
  log: AuditLogDetailsData | null;
  isOpen: boolean;
  onClose: () => void;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value === "[REDACTED]") return "[REDACTED]";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return date.toLocaleString();
    }
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function AuditLogDetails({ log, isOpen, onClose }: Props) {
  const before = toRecord(log?.beforeData);
  const after = toRecord(log?.afterData);
  const changedFields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const beforeActive = typeof before.isActive === "boolean" ? before.isActive : null;
  const afterActive = typeof after.isActive === "boolean" ? after.isActive : null;
  const hasStatusChange = beforeActive !== null && afterActive !== null && beforeActive !== afterActive;

  return (
    <Drawer isOpen={isOpen} title="Audit Log Details" onRequestClose={onClose}>
      {!log ? null : (
        <div className="space-y-6 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p><span className="font-semibold">Timestamp:</span> {new Date(log.createdAt).toLocaleString()}</p>
            <p><span className="font-semibold">Scope:</span> {log.scope}</p>
            <p><span className="font-semibold">Organization:</span> {log.organization?.name ?? "—"}</p>
            <p><span className="font-semibold">Action:</span> {log.action}</p>
            <p><span className="font-semibold">Actor:</span> {log.actorDisplayName ?? "—"}</p>
            <p><span className="font-semibold">Actor Email:</span> {log.actorEmail ?? "—"}</p>
            <p><span className="font-semibold">Entity Type:</span> {log.entityType}</p>
            <p><span className="font-semibold">Entity ID:</span> {log.entityId}</p>
            <p className="sm:col-span-2"><span className="font-semibold">Entity Name:</span> {log.entityName ?? "—"}</p>
          </div>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-900">Changes</h3>
            {log.action === "CREATE" ? (
              <p className="text-slate-700">Created record</p>
            ) : (log.action === "ACTIVATE" || log.action === "DEACTIVATE") && hasStatusChange ? (
              <p className="text-slate-700">
                Status changed from {beforeActive ? "Active" : "Inactive"} to {afterActive ? "Active" : "Inactive"}
              </p>
            ) : changedFields.length === 0 ? (
              <p className="text-slate-500">No changed fields recorded.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Field</th>
                      <th className="px-3 py-2 font-semibold">Before</th>
                      <th className="px-3 py-2 font-semibold">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {changedFields.map((field) => (
                      <tr key={field}>
                        <td className="px-3 py-2 font-medium">{field}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap break-words">{formatValue(before[field])}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap break-words">{formatValue(after[field])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="rounded-md border border-slate-200 p-3">
            <summary className="cursor-pointer font-medium">Raw JSON</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
              {JSON.stringify({ beforeData: log.beforeData, afterData: log.afterData, metadata: log.metadata }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </Drawer>
  );
}
