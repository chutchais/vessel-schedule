"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type Port = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type Terminal = {
  id: string;
  portId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  port: {
    id: string;
    code: string;
    name: string;
  };
};

type TerminalForm = {
  portId: string;
  code: string;
  name: string;
  isActive: boolean;
};

type TerminalsResponse = {
  data?: Terminal[];
  error?: string;
};

type PortsResponse = {
  data?: Port[];
  error?: string;
};

type TerminalResponse = {
  data?: Terminal;
  error?: string;
};

const EMPTY_FORM: TerminalForm = {
  portId: "",
  code: "",
  name: "",
  isActive: true,
};

export function TerminalManager() {
  const isMountedRef = useRef(true);

  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);

  const [form, setForm] = useState<TerminalForm>(EMPTY_FORM);
  const [initialFormState, setInitialFormState] = useState<TerminalForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Terminal | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [portsLoading, setPortsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadTerminalsAndPorts() {
    if (isMountedRef.current) {
      setLoading(true);
      setPortsLoading(true);
      setPageError("");
    }

    try {
      const [terminalsResponse, portsResponse] = await Promise.all([
        fetch("/api/terminals", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/ports", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const terminalsResult = (await terminalsResponse.json()) as TerminalsResponse;
      const portsResult = (await portsResponse.json()) as PortsResponse;

      if (!terminalsResponse.ok) {
        throw new Error(terminalsResult.error || "Failed to load terminals");
      }

      if (!portsResponse.ok) {
        throw new Error(portsResult.error || "Failed to load ports");
      }

      if (isMountedRef.current) {
        setTerminals(Array.isArray(terminalsResult.data) ? terminalsResult.data : []);
        setPorts(Array.isArray(portsResult.data) ? portsResult.data : []);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setTerminals([]);
        setPorts([]);
        setPageError(error instanceof Error ? error.message : "Failed to load terminal data");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setPortsLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTerminalsAndPorts();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const activePorts = useMemo(() => {
    return ports.filter((port) => {
      if (port.isActive) {
        return true;
      }

      return editingId !== null && form.portId === port.id;
    });
  }, [editingId, form.portId, ports]);

  const filteredTerminals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return terminals.filter((terminal) => {
      const matchesSearch =
        !query ||
        terminal.code.toLowerCase().includes(query) ||
        terminal.name.toLowerCase().includes(query) ||
        terminal.port.code.toLowerCase().includes(query) ||
        terminal.port.name.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && terminal.isActive) ||
        (statusFilter === "inactive" && !terminal.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, terminals]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<Field extends keyof TerminalForm>(field: Field, value: TerminalForm[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeDrawerImmediately() {
    setForm(EMPTY_FORM);
    setInitialFormState(EMPTY_FORM);
    setEditingId(null);
    setDrawerError("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(false);
  }

  function requestCloseDrawer() {
    if (saving) {
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
    setForm(EMPTY_FORM);
    setInitialFormState(EMPTY_FORM);
    setDrawerError("");
    setPageError("");
    setSuccess("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(terminal: Terminal) {
    const editForm: TerminalForm = {
      portId: terminal.portId,
      code: terminal.code,
      name: terminal.name,
      isActive: terminal.isActive,
    };

    setEditingId(terminal.id);
    setForm(editForm);
    setInitialFormState(editForm);
    setDrawerError("");
    setPageError("");
    setSuccess("");
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

    setSaving(true);
    setDrawerError("");
    setSuccess("");

    try {
      const url = editingId ? `/api/terminals/${editingId}` : "/api/terminals";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as TerminalResponse;

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingId ? "update" : "create"} terminal`);
      }

      await loadTerminalsAndPorts();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccess(editingId ? "Terminal updated successfully." : "Terminal created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Failed to save terminal");
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  async function confirmToggleStatus() {
    if (!statusTarget || !isMountedRef.current) {
      return;
    }

    setStatusUpdatingId(statusTarget.id);
    setPageError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/terminals/${statusTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portId: statusTarget.portId,
          code: statusTarget.code,
          name: statusTarget.name,
          isActive: !statusTarget.isActive,
        }),
      });

      const result = (await response.json()) as TerminalResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to update terminal status");
      }

      await loadTerminalsAndPorts();

      if (isMountedRef.current) {
        setSuccess(statusTarget.isActive ? "Terminal deactivated successfully." : "Terminal activated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to update terminal status");
      }
    } finally {
      if (isMountedRef.current) {
        setStatusUpdatingId(null);
        setStatusTarget(null);
      }
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        title="Terminal Management"
        description="Create, edit, activate, and deactivate terminals"
        actions={<Button onClick={openCreateDrawer}>Add Terminal</Button>}
      />

      {success ? <AlertMessage type="success" message={success} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Search" htmlFor="terminal-search" className="md:col-span-2">
            <Input
              id="terminal-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, name, or port"
            />
          </FormField>

          <FormField label="Status" htmlFor="terminal-status-filter">
            <Select
              id="terminal-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredTerminals.length} of {terminals.length} terminals
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredTerminals.length} ${filteredTerminals.length === 1 ? "terminal" : "terminals"}`}>
        {loading ? (
          <LoadingState message="Loading terminals..." />
        ) : filteredTerminals.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No terminals found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Port</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTerminals.map((terminal) => (
                  <tr key={terminal.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{terminal.code}</td>
                    <td className="px-4 py-3 text-slate-900">{terminal.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{terminal.port.code}</div>
                      <div className="text-xs text-slate-500">{terminal.port.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={terminal.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(terminal)}>
                          Edit
                        </Button>
                        <Button
                          variant={terminal.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === terminal.id}
                          onClick={() => setStatusTarget(terminal)}
                        >
                          {statusUpdatingId === terminal.id
                            ? "Updating..."
                            : terminal.isActive
                              ? "Deactivate"
                              : "Activate"}
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
        title={editingId ? "Edit Terminal" : "Create Terminal"}
        description="Add a terminal to an existing port."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="terminal-form" disabled={saving || portsLoading}>
              {saving ? "Saving..." : editingId ? "Update Terminal" : "Create Terminal"}
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

        <form id="terminal-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Port" htmlFor="terminal-port" required>
              <Select
                id="terminal-port"
                value={form.portId}
                onChange={(event) => updateForm("portId", event.target.value)}
                disabled={portsLoading || saving}
                required
              >
                <option value="">{portsLoading ? "Loading ports..." : "Select Port"}</option>
                {activePorts.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.code} - {port.name}
                    {!port.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Terminal Code" htmlFor="terminal-code" required>
              <Input
                id="terminal-code"
                type="text"
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value)}
                required
                maxLength={20}
                placeholder="A1"
                disabled={saving}
                className="uppercase"
              />
            </FormField>

            <FormField label="Terminal Name" htmlFor="terminal-name" required>
              <Input
                id="terminal-name"
                type="text"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                maxLength={200}
                placeholder="Terminal A1"
                disabled={saving}
              />
            </FormField>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm("isActive", event.target.checked)}
                  disabled={saving}
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
            aria-labelledby="terminal-status-confirm-title"
            aria-describedby="terminal-status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="terminal-status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Terminal?" : "Activate Terminal?"}
            </h2>
            <p id="terminal-status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "This terminal will no longer be available for new operations."
                : "This terminal will become available for new operations."}
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
                {statusTarget.isActive ? "Deactivate Terminal" : "Activate Terminal"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
