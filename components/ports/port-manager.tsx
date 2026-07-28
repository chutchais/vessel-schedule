"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { HistoryLink } from "@/components/audit-logs/history-link";
import { useCanViewAuditLogs } from "@/components/audit-logs/use-can-view-audit-logs";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableContainer } from "@/components/ui/table-container";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

type Port = {
  id: string;
  code: string;
  unlocode: string | null;
  name: string;
  country: string;
  timezone: string;
  latitude: number | string | null;
  longitude: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PortForm = {
  code: string;
  unlocode: string;
  name: string;
  country: string;
  timezone: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
};

type PortsResponse = {
  data?: Port[];
  count?: number;
  error?: string;
};

const initialForm: PortForm = {
  code: "",
  unlocode: "",
  name: "",
  country: "",
  timezone: "Asia/Bangkok",
  latitude: "",
  longitude: "",
  isActive: true,
};

function displayCoordinate(value: Port["latitude"]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  return numberValue.toFixed(6).replace(/\.?0+$/, "");
}

function toInputValue(value: Port["latitude"]): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export default function PortManager() {
  const isMountedRef = useRef(true);
  const canViewAuditLogs = useCanViewAuditLogs();

  const [ports, setPorts] = useState<Port[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [form, setForm] = useState<PortForm>(initialForm);
  const [initialFormState, setInitialFormState] = useState<PortForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Port | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadPorts() {
    if (isMountedRef.current) {
      setLoading(true);
      setPageError("");
    }

    try {
      const response = await fetch("/api/ports", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as PortsResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to load ports");
      }

      if (isMountedRef.current) {
        setPorts(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPorts([]);
        setPageError(error instanceof Error ? error.message : "Failed to load ports");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPorts();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const filteredPorts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return ports.filter((port) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        port.code.toLowerCase().includes(normalizedSearch) ||
        port.unlocode?.toLowerCase().includes(normalizedSearch) ||
        port.name.toLowerCase().includes(normalizedSearch) ||
        port.country.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && port.isActive) ||
        (statusFilter === "inactive" && !port.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [ports, search, statusFilter]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<K extends keyof PortForm>(field: K, value: PortForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function closeDrawerImmediately() {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setInitialFormState(initialForm);
    setDrawerError("");
    setShowDiscardChanges(false);
  }

  function requestCloseDrawer() {
    if (submitting) {
      return;
    }

    if (isFormDirty) {
      setShowDiscardChanges(true);
      return;
    }

    closeDrawerImmediately();
  }

  function openCreateDrawer() {
    setEditingId(null);
    setForm(initialForm);
    setInitialFormState(initialForm);
    setDrawerError("");
    setPageError("");
    setSuccessMessage("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(port: Port) {
    const editForm: PortForm = {
      code: port.code,
      unlocode: port.unlocode ?? "",
      name: port.name,
      country: port.country,
      timezone: port.timezone,
      latitude: toInputValue(port.latitude),
      longitude: toInputValue(port.longitude),
      isActive: port.isActive,
    };

    setEditingId(port.id);
    setForm(editForm);
    setInitialFormState(editForm);
    setDrawerError("");
    setPageError("");
    setSuccessMessage("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isMountedRef.current) {
      return;
    }

    const isEditing = editingId !== null;
    setSubmitting(true);
    setDrawerError("");
    setSuccessMessage("");

    try {
      const response = await fetch(isEditing ? `/api/ports/${editingId}` : "/api/ports", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { data?: Port; error?: string };

      if (!response.ok) {
        throw new Error(result.error || (isEditing ? "Failed to update port" : "Failed to create port"));
      }

      await loadPorts();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccessMessage(isEditing ? "Port updated successfully." : "Port created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Failed to save port");
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  async function confirmToggleStatus() {
    if (!statusTarget || !isMountedRef.current) {
      return;
    }

    const nextIsActive = !statusTarget.isActive;

    setStatusUpdatingId(statusTarget.id);
    setPageError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/ports/${statusTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: statusTarget.code,
          unlocode: statusTarget.unlocode ?? "",
          name: statusTarget.name,
          country: statusTarget.country,
          timezone: statusTarget.timezone,
          latitude: toInputValue(statusTarget.latitude),
          longitude: toInputValue(statusTarget.longitude),
          isActive: nextIsActive,
        }),
      });

      const result = (await response.json()) as { data?: Port; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Failed to update port status");
      }

      await loadPorts();

      if (isMountedRef.current) {
        setSuccessMessage(nextIsActive ? "Port activated successfully." : "Port deactivated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to update port status");
      }
    } finally {
      if (isMountedRef.current) {
        setStatusUpdatingId(null);
        setStatusTarget(null);
      }
    }
  }

  return (
    <section>
      <PageHeader
        title="Port Management"
        description="Manage ports used in vessel schedules"
        actions={<Button onClick={openCreateDrawer}>Add Port</Button>}
      />

      {successMessage ? <AlertMessage type="success" message={successMessage} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Search" htmlFor="port-search" className="md:col-span-2">
            <Input
              id="port-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, UN/LOCODE, name, or country"
            />
          </FormField>

          <FormField label="Status" htmlFor="port-status-filter">
            <Select
              id="port-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredPorts.length} of {ports.length} ports
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredPorts.length} ${filteredPorts.length === 1 ? "port" : "ports"}`}>
        {loading ? (
          <LoadingState message="Loading ports..." />
        ) : filteredPorts.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No ports found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">UN/LOCODE</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Port Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Country</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Timezone</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Coordinates</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPorts.map((port) => (
                  <tr key={port.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{port.code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{port.unlocode || "—"}</td>
                    <td className="px-4 py-3 text-slate-900">{port.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{port.country}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{port.timezone}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {displayCoordinate(port.latitude)}, {displayCoordinate(port.longitude)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge active={port.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(port)}>
                          Edit
                        </Button>
                        {canViewAuditLogs ? (
                          <HistoryLink entityType={AUDIT_ENTITY_TYPES.PORT} entityId={port.id} entityLabel={port.name} />
                        ) : null}
                        <Button
                          variant={port.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === port.id}
                          onClick={() => setStatusTarget(port)}
                        >
                          {statusUpdatingId === port.id ? "Updating..." : port.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableContainer>

      <Drawer
        isOpen={isDrawerOpen}
        title={editingId ? "Edit Port" : "Create Port"}
        description="Manage port details used in vessel schedules."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="port-form" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update Port" : "Create Port"}
            </Button>
          </div>
        }
      >
        {showDiscardChanges ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">You have unsaved changes.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setShowDiscardChanges(false)}>
                Keep editing
              </Button>
              <Button variant="danger" className="h-8 px-3 text-xs" onClick={closeDrawerImmediately}>
                Discard changes
              </Button>
            </div>
          </div>
        ) : null}

        {drawerError ? <AlertMessage type="error" message={drawerError} className="mb-4" /> : null}

        <form id="port-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Port Code" htmlFor="port-code" required>
              <Input
                id="port-code"
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                maxLength={10}
                required
                placeholder="LCB"
                disabled={submitting}
              />
            </FormField>

            <FormField label="UN/LOCODE" htmlFor="port-unlocode">
              <Input
                id="port-unlocode"
                value={form.unlocode}
                onChange={(event) => updateForm("unlocode", event.target.value.toUpperCase())}
                maxLength={5}
                placeholder="THLCH"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Port Name" htmlFor="port-name" required className="md:col-span-2">
              <Input
                id="port-name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                placeholder="Laem Chabang"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Country" htmlFor="port-country" required>
              <Input
                id="port-country"
                value={form.country}
                onChange={(event) => updateForm("country", event.target.value)}
                required
                placeholder="Thailand"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Timezone" htmlFor="port-timezone" required>
              <Input
                id="port-timezone"
                value={form.timezone}
                onChange={(event) => updateForm("timezone", event.target.value)}
                required
                placeholder="Asia/Bangkok"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Latitude" htmlFor="port-latitude">
              <Input
                id="port-latitude"
                type="number"
                value={form.latitude}
                onChange={(event) => updateForm("latitude", event.target.value)}
                min={-90}
                max={90}
                step="any"
                placeholder="13.0827"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Longitude" htmlFor="port-longitude">
              <Input
                id="port-longitude"
                type="number"
                value={form.longitude}
                onChange={(event) => updateForm("longitude", event.target.value)}
                min={-180}
                max={180}
                step="any"
                placeholder="100.8833"
                disabled={submitting}
              />
            </FormField>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm("isActive", event.target.checked)}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Active
              </label>
            </div>
          </div>
        </form>
      </Drawer>

      {statusTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setStatusTarget(null)}
            aria-label="Close status confirmation"
          />
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="port-status-confirm-title"
            aria-describedby="port-status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="port-status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Port?" : "Activate Port?"}
            </h2>
            <p id="port-status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "This port will no longer be available for new operations."
                : "This port will become available for new operations."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStatusTarget(null)} disabled={statusUpdatingId !== null}>
                Cancel
              </Button>
              <Button
                variant={statusTarget.isActive ? "danger" : "primary"}
                onClick={() => void confirmToggleStatus()}
                disabled={statusUpdatingId !== null}
              >
                {statusTarget.isActive ? "Deactivate Port" : "Activate Port"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
