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

const VESSEL_TYPES = [
  "CONTAINER_SHIP",
  "BULK_CARRIER",
  "TANKER",
  "GENERAL_CARGO",
  "RO_RO",
  "OTHER",
] as const;

type VesselType = (typeof VESSEL_TYPES)[number];

type Vessel = {
  id: string;
  code: string;
  name: string;
  imo: string | null;
  callSign: string | null;
  flag: string | null;
  type: VesselType;
  lengthOverall: number | string | null;
  beam: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type VesselForm = {
  code: string;
  name: string;
  imo: string;
  callSign: string;
  flag: string;
  type: VesselType;
  lengthOverall: string;
  beam: string;
  isActive: boolean;
};

type VesselsResponse = {
  data: Vessel[];
  count: number;
};

const emptyForm: VesselForm = {
  code: "",
  name: "",
  imo: "",
  callSign: "",
  flag: "",
  type: "CONTAINER_SHIP",
  lengthOverall: "",
  beam: "",
  isActive: true,
};

function formatVesselType(type: VesselType): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toInputValue(value: number | string | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function VesselManager() {
  const isMountedRef = useRef(true);
  const [vessels, setVessels] = useState<Vessel[]>([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState<VesselForm>(emptyForm);
  const [initialFormState, setInitialFormState] = useState<VesselForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Vessel | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadVessels() {
    if (isMountedRef.current) {
      setLoading(true);
      setPageError("");
    }

    try {
      const response = await fetch("/api/vessels", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as VesselsResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result ? result.error || "Unable to load vessels" : "Unable to load vessels",
        );
      }

      if (!("data" in result)) {
        throw new Error("Invalid response from vessels API");
      }

      if (isMountedRef.current) {
        setVessels(result.data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setVessels([]);
        setPageError(error instanceof Error ? error.message : "Unable to load vessels");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVessels();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const filteredVessels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vessels.filter((vessel) => {
      const matchesSearch =
        !query ||
        vessel.code.toLowerCase().includes(query) ||
        vessel.name.toLowerCase().includes(query) ||
        vessel.imo?.toLowerCase().includes(query) ||
        vessel.callSign?.toLowerCase().includes(query) ||
        vessel.flag?.toLowerCase().includes(query);

      const matchesType = !typeFilter || vessel.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && vessel.isActive) ||
        (statusFilter === "inactive" && !vessel.isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [search, statusFilter, typeFilter, vessels]);

  const hasActiveFilters = search.trim() !== "" || typeFilter !== "" || statusFilter !== "all";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<K extends keyof VesselForm>(field: K, value: VesselForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function closeDrawerImmediately() {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setInitialFormState(emptyForm);
    setDrawerError("");
    setShowDiscardChanges(false);
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
    setForm(emptyForm);
    setInitialFormState(emptyForm);
    setEditingId(null);
    setPageError("");
    setPageSuccess("");
    setDrawerError("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(vessel: Vessel) {
    const editForm: VesselForm = {
      code: vessel.code,
      name: vessel.name,
      imo: vessel.imo ?? "",
      callSign: vessel.callSign ?? "",
      flag: vessel.flag ?? "",
      type: vessel.type,
      lengthOverall: toInputValue(vessel.lengthOverall),
      beam: toInputValue(vessel.beam),
      isActive: vessel.isActive,
    };

    setForm(editForm);
    setInitialFormState(editForm);
    setEditingId(vessel.id);
    setPageError("");
    setPageSuccess("");
    setDrawerError("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("all");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isMountedRef.current) {
      return;
    }

    const isEditing = editingId !== null;

    setSaving(true);
    setDrawerError("");
    setPageSuccess("");

    try {
      const response = await fetch(isEditing ? `/api/vessels/${editingId}` : "/api/vessels", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { data?: Vessel; error?: string };

      if (!response.ok) {
        throw new Error(result.error || (isEditing ? "Unable to update vessel" : "Unable to create vessel"));
      }

      await loadVessels();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setPageSuccess(isEditing ? "Vessel updated successfully." : "Vessel created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Unable to save vessel");
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

    const nextStatus = !statusTarget.isActive;
    setStatusUpdatingId(statusTarget.id);
    setPageError("");
    setPageSuccess("");

    try {
      const response = await fetch(`/api/vessels/${statusTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: statusTarget.code,
          name: statusTarget.name,
          imo: statusTarget.imo ?? "",
          callSign: statusTarget.callSign ?? "",
          flag: statusTarget.flag ?? "",
          type: statusTarget.type,
          lengthOverall: toInputValue(statusTarget.lengthOverall),
          beam: toInputValue(statusTarget.beam),
          isActive: nextStatus,
        }),
      });

      const result = (await response.json()) as { data?: Vessel; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Unable to update vessel status");
      }

      await loadVessels();

      if (isMountedRef.current) {
        setPageSuccess(nextStatus ? "Vessel activated successfully." : "Vessel deactivated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Unable to update vessel status");
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
        title="Vessel Management"
        description="Manage vessel master data"
        actions={<Button onClick={openCreateDrawer}>Add Vessel</Button>}
      />

      {pageSuccess ? <AlertMessage type="success" message={pageSuccess} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Search" htmlFor="vessel-search" className="md:col-span-2">
            <Input
              id="vessel-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, name, IMO, call sign, or flag"
            />
          </FormField>

          <FormField label="Vessel type" htmlFor="vessel-type-filter">
            <Select
              id="vessel-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {VESSEL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatVesselType(type)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" htmlFor="vessel-status-filter">
            <Select
              id="vessel-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredVessels.length} of {vessels.length} vessels
          </p>

          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredVessels.length} ${filteredVessels.length === 1 ? "vessel" : "vessels"}`}>
        {loading ? (
          <LoadingState message="Loading vessels..." />
        ) : filteredVessels.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No vessels found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Vessel</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">IMO / Call Sign</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Flag</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">LOA / Beam (m)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVessels.map((vessel) => (
                  <tr key={vessel.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{vessel.code}</td>
                    <td className="px-4 py-3 text-slate-900">{vessel.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatVesselType(vessel.type)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{vessel.imo || "—"}</div>
                      {vessel.callSign ? <div className="text-xs text-slate-500">{vessel.callSign}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{vessel.flag || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      <div>{vessel.lengthOverall !== null ? String(vessel.lengthOverall) : "—"}</div>
                      {vessel.beam !== null ? <div className="text-xs text-slate-500">{String(vessel.beam)}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge active={vessel.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(vessel)}>
                          Edit
                        </Button>
                        <Button
                          variant={vessel.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === vessel.id}
                          onClick={() => setStatusTarget(vessel)}
                        >
                          {statusUpdatingId === vessel.id
                            ? "Updating..."
                            : vessel.isActive
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
        title={editingId ? "Edit Vessel" : "Create Vessel"}
        description="Update vessel details used for schedule planning."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="vessel-form" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Vessel" : "Create Vessel"}
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

        <form id="vessel-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" htmlFor="vessel-code" required>
              <Input
                id="vessel-code"
                maxLength={20}
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                placeholder="EVER_GIVEN"
                required
                disabled={saving}
              />
            </FormField>

            <FormField label="Type" htmlFor="vessel-type" required>
              <Select
                id="vessel-type"
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value as VesselType)}
                disabled={saving}
              >
                {VESSEL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatVesselType(type)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Vessel name" htmlFor="vessel-name" required className="sm:col-span-2">
              <Input
                id="vessel-name"
                maxLength={200}
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Ever Given"
                required
                disabled={saving}
              />
            </FormField>

            <FormField label="IMO number" htmlFor="vessel-imo">
              <Input
                id="vessel-imo"
                maxLength={10}
                value={form.imo}
                onChange={(event) => updateForm("imo", event.target.value)}
                placeholder="9811000"
                disabled={saving}
              />
            </FormField>

            <FormField label="Call sign" htmlFor="vessel-callsign">
              <Input
                id="vessel-callsign"
                maxLength={10}
                value={form.callSign}
                onChange={(event) => updateForm("callSign", event.target.value.toUpperCase())}
                placeholder="H3RC"
                disabled={saving}
              />
            </FormField>

            <FormField label="Flag (country code)" htmlFor="vessel-flag">
              <Input
                id="vessel-flag"
                maxLength={3}
                value={form.flag}
                onChange={(event) => updateForm("flag", event.target.value.toUpperCase())}
                placeholder="PAN"
                disabled={saving}
              />
            </FormField>

            <FormField label="Length Overall (m)" htmlFor="vessel-loa">
              <Input
                id="vessel-loa"
                type="number"
                min="0"
                step="0.01"
                value={form.lengthOverall}
                onChange={(event) => updateForm("lengthOverall", event.target.value)}
                placeholder="399.99"
                disabled={saving}
              />
            </FormField>

            <FormField label="Beam (m)" htmlFor="vessel-beam">
              <Input
                id="vessel-beam"
                type="number"
                min="0"
                step="0.01"
                value={form.beam}
                onChange={(event) => updateForm("beam", event.target.value)}
                placeholder="58.80"
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
            aria-labelledby="status-confirm-title"
            aria-describedby="status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Vessel?" : "Activate Vessel?"}
            </h2>
            <p id="status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "The vessel will no longer be available for new schedules."
                : "The vessel will become available for new schedules."}
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
                {statusTarget.isActive ? "Deactivate Vessel" : "Activate Vessel"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
