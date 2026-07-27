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

type Terminal = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  port: {
    id: string;
    code: string;
    name: string;
  };
};

type Berth = {
  id: string;
  terminalId: string;
  code: string;
  name: string;
  berthLength: number;
  color: string;
  zeroOriginSide: "LEFT" | "RIGHT";
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  terminal: {
    id: string;
    code: string;
    name: string;
    port: {
      id: string;
      code: string;
      name: string;
    };
  };
};

type BerthForm = {
  terminalId: string;
  code: string;
  name: string;
  berthLength: string;
  color: string;
  zeroOriginSide: "left" | "right";
  sortOrder: string;
  isActive: boolean;
};

type BerthsResponse = {
  data?: Berth[];
  error?: string;
};

type TerminalsResponse = {
  data?: Terminal[];
  error?: string;
};

type BerthResponse = {
  data?: Berth;
  error?: string;
};

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/i;

const INITIAL_FORM: BerthForm = {
  terminalId: "",
  code: "",
  name: "",
  berthLength: "",
  color: "#3B82F6",
  zeroOriginSide: "left",
  sortOrder: "0",
  isActive: true,
};

function formatLength(length: number) {
  return length.toFixed(2).replace(/\.?0+$/, "");
}

export function BerthManager() {
  const isMountedRef = useRef(true);

  const [berths, setBerths] = useState<Berth[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  const [form, setForm] = useState<BerthForm>(INITIAL_FORM);
  const [initialFormState, setInitialFormState] = useState<BerthForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Berth | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [terminalsLoading, setTerminalsLoading] = useState(true);
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

  async function loadBerthsAndTerminals() {
    if (isMountedRef.current) {
      setLoading(true);
      setTerminalsLoading(true);
      setPageError("");
    }

    try {
      const [berthsResponse, terminalsResponse] = await Promise.all([
        fetch("/api/berths", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/terminals", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const berthsResult = (await berthsResponse.json()) as BerthsResponse;
      const terminalsResult = (await terminalsResponse.json()) as TerminalsResponse;

      if (!berthsResponse.ok) {
        throw new Error(berthsResult.error || "Failed to load berths");
      }

      if (!terminalsResponse.ok) {
        throw new Error(terminalsResult.error || "Failed to load terminals");
      }

      if (isMountedRef.current) {
        setBerths(Array.isArray(berthsResult.data) ? berthsResult.data : []);
        setTerminals(Array.isArray(terminalsResult.data) ? terminalsResult.data : []);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setBerths([]);
        setTerminals([]);
        setPageError(error instanceof Error ? error.message : "Failed to load berth data");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setTerminalsLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBerthsAndTerminals();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const availableTerminals = useMemo(() => {
    return terminals.filter((terminal) => {
      if (terminal.isActive) {
        return true;
      }

      return editingId !== null && form.terminalId === terminal.id;
    });
  }, [editingId, form.terminalId, terminals]);

  const filteredBerths = useMemo(() => {
    const query = search.trim().toLowerCase();

    return berths.filter((berth) => {
      const matchesSearch =
        !query ||
        berth.code.toLowerCase().includes(query) ||
        berth.name.toLowerCase().includes(query) ||
        berth.terminal.code.toLowerCase().includes(query) ||
        berth.terminal.name.toLowerCase().includes(query) ||
        berth.terminal.port.code.toLowerCase().includes(query) ||
        berth.terminal.port.name.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && berth.isActive) ||
        (statusFilter === "inactive" && !berth.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [berths, search, statusFilter]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<Field extends keyof BerthForm>(field: Field, value: BerthForm[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeDrawerImmediately() {
    setForm(INITIAL_FORM);
    setInitialFormState(INITIAL_FORM);
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
    setForm(INITIAL_FORM);
    setInitialFormState(INITIAL_FORM);
    setDrawerError("");
    setPageError("");
    setSuccess("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(berth: Berth) {
    const editForm: BerthForm = {
      terminalId: berth.terminalId,
      code: berth.code,
      name: berth.name,
      berthLength: berth.berthLength.toString(),
      color: berth.color,
      zeroOriginSide: berth.zeroOriginSide === "RIGHT" ? "right" : "left",
      sortOrder: berth.sortOrder.toString(),
      isActive: berth.isActive,
    };

    setEditingId(berth.id);
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

  function toPayload() {
    return {
      terminalId: form.terminalId,
      code: form.code,
      name: form.name,
      berthLength: form.berthLength,
      color: form.color,
      zeroOriginSide: form.zeroOriginSide,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!COLOR_HEX_PATTERN.test(form.color)) {
      setDrawerError("Color must match #RRGGBB");
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    setSaving(true);
    setDrawerError("");
    setSuccess("");

    try {
      const response = await fetch(editingId ? `/api/berths/${editingId}` : "/api/berths", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload()),
      });

      const result = (await response.json()) as BerthResponse;

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingId ? "update" : "create"} berth`);
      }

      await loadBerthsAndTerminals();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccess(editingId ? "Berth updated successfully." : "Berth created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Failed to save berth");
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
      const response = await fetch(`/api/berths/${statusTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          terminalId: statusTarget.terminalId,
          code: statusTarget.code,
          name: statusTarget.name,
          berthLength: statusTarget.berthLength,
          color: statusTarget.color,
          zeroOriginSide: statusTarget.zeroOriginSide === "RIGHT" ? "right" : "left",
          sortOrder: statusTarget.sortOrder,
          isActive: !statusTarget.isActive,
        }),
      });

      const result = (await response.json()) as BerthResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to update berth status");
      }

      await loadBerthsAndTerminals();

      if (isMountedRef.current) {
        setSuccess(statusTarget.isActive ? "Berth deactivated successfully." : "Berth activated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to update berth status");
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
        title="Berth Management"
        description="Create, edit, activate, and deactivate berths"
        actions={<Button onClick={openCreateDrawer}>Add Berth</Button>}
      />

      {success ? <AlertMessage type="success" message={success} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Search" htmlFor="berth-search" className="md:col-span-2">
            <Input
              id="berth-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, name, terminal, or port"
            />
          </FormField>

          <FormField label="Status" htmlFor="berth-status-filter">
            <Select id="berth-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredBerths.length} of {berths.length} berths
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredBerths.length} ${filteredBerths.length === 1 ? "berth" : "berths"}`}>
        {loading ? (
          <LoadingState message="Loading berths..." />
        ) : filteredBerths.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No berths found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Terminal</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Length (m)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Zero Origin</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Sort</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBerths.map((berth) => (
                  <tr key={berth.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{berth.code}</td>
                    <td className="px-4 py-3 text-slate-900">
                      <div>{berth.name}</div>
                      <div className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: berth.color }} />
                        <span className="font-mono">{berth.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {berth.terminal.code} - {berth.terminal.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {berth.terminal.port.code} - {berth.terminal.port.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatLength(berth.berthLength)}</td>
                    <td className="px-4 py-3 text-slate-700">{berth.zeroOriginSide === "RIGHT" ? "Right" : "Left"}</td>
                    <td className="px-4 py-3 text-slate-700">{berth.sortOrder}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={berth.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(berth)}>
                          Edit
                        </Button>
                        <Button
                          variant={berth.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === berth.id}
                          onClick={() => setStatusTarget(berth)}
                        >
                          {statusUpdatingId === berth.id ? "Updating..." : berth.isActive ? "Deactivate" : "Activate"}
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
        title={editingId ? "Edit Berth" : "Create Berth"}
        description="Add a berth to an existing terminal."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="berth-form" disabled={saving || terminalsLoading}>
              {saving ? "Saving..." : editingId ? "Update Berth" : "Create Berth"}
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

        <form id="berth-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Terminal" htmlFor="berth-terminal" required>
              <Select
                id="berth-terminal"
                value={form.terminalId}
                onChange={(event) => updateForm("terminalId", event.target.value)}
                disabled={terminalsLoading || saving}
                required
              >
                <option value="">{terminalsLoading ? "Loading terminals..." : "Select Terminal"}</option>
                {availableTerminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.port.code}/{terminal.code} - {terminal.name}
                    {!terminal.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Berth Code" htmlFor="berth-code" required>
              <Input
                id="berth-code"
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value)}
                required
                maxLength={20}
                placeholder="B01"
                disabled={saving}
                className="uppercase"
              />
            </FormField>

            <FormField label="Berth Name" htmlFor="berth-name" required>
              <Input
                id="berth-name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                maxLength={200}
                placeholder="Main Berth"
                disabled={saving}
              />
            </FormField>

            <FormField label="Berth Length (m)" htmlFor="berth-length" required>
              <Input
                id="berth-length"
                type="number"
                value={form.berthLength}
                onChange={(event) => updateForm("berthLength", event.target.value)}
                required
                min="0.01"
                step="0.01"
                placeholder="350"
                disabled={saving}
              />
            </FormField>

            <FormField label="Color" htmlFor="berth-color">
              <div className="flex gap-2">
                <Input
                  id="berth-color"
                  type="color"
                  value={COLOR_HEX_PATTERN.test(form.color) ? form.color : "#3B82F6"}
                  onChange={(event) => updateForm("color", event.target.value.toUpperCase())}
                  disabled={saving}
                  className="h-10 w-14 rounded-md border px-1 py-1"
                />
                <Input
                  type="text"
                  value={form.color}
                  onChange={(event) => updateForm("color", event.target.value.toUpperCase())}
                  required
                  pattern="#[0-9A-Fa-f]{6}"
                  placeholder="#3B82F6"
                  maxLength={7}
                  disabled={saving}
                  className="font-mono uppercase"
                />
              </div>
            </FormField>

            <FormField label="Zero Origin Side" htmlFor="berth-zero-origin">
              <Select
                id="berth-zero-origin"
                value={form.zeroOriginSide}
                onChange={(event) => updateForm("zeroOriginSide", event.target.value as "left" | "right")}
                disabled={saving}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </Select>
            </FormField>

            <FormField label="Sort Order" htmlFor="berth-sort-order" required>
              <Input
                id="berth-sort-order"
                type="number"
                value={form.sortOrder}
                onChange={(event) => updateForm("sortOrder", event.target.value)}
                min="0"
                step="1"
                required
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
            aria-labelledby="berth-status-confirm-title"
            aria-describedby="berth-status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="berth-status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Berth?" : "Activate Berth?"}
            </h2>
            <p id="berth-status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "This berth will no longer be available for new operations."
                : "This berth will become available for new operations."}
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
                {statusTarget.isActive ? "Deactivate Berth" : "Activate Berth"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
