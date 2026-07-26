"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  isActive: true,
};

function formatVesselType(type: VesselType): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function VesselManager() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState<VesselForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVessels = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/vessels", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as
        | VesselsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result
            ? result.error || "Unable to load vessels"
            : "Unable to load vessels",
        );
      }

      if (!("data" in result)) {
        throw new Error("Invalid response from vessels API");
      }

      setVessels(result.data);
    } catch (err) {
      setVessels([]);
      setError(err instanceof Error ? err.message : "Unable to load vessels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialVessels() {
      try {
        const response = await fetch("/api/vessels", {
          method: "GET",
          cache: "no-store",
        });

        const result = (await response.json()) as
          | VesselsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in result
              ? result.error || "Unable to load vessels"
              : "Unable to load vessels",
          );
        }

        if (!("data" in result)) {
          throw new Error("Invalid response from vessels API");
        }

        if (!cancelled) {
          setVessels(result.data);
        }
      } catch (err) {
        if (!cancelled) {
          setVessels([]);
          setError(
            err instanceof Error ? err.message : "Unable to load vessels",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialVessels();

    return () => {
      cancelled = true;
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
  }, [vessels, search, typeFilter, statusFilter]);

  function updateForm<K extends keyof VesselForm>(
    field: K,
    value: VesselForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    resetForm();
    setShowForm(false);
  }

  function startEdit(vessel: Vessel) {
    setEditingId(vessel.id);
    setForm({
      code: vessel.code,
      name: vessel.name,
      imo: vessel.imo ?? "",
      callSign: vessel.callSign ?? "",
      flag: vessel.flag ?? "",
      type: vessel.type,
      isActive: vessel.isActive,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `/api/vessels/${editingId}`
        : "/api/vessels";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as {
        data?: Vessel;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing ? "Unable to update vessel" : "Unable to create vessel"),
        );
      }

      setSuccess(
        isEditing ? "Vessel updated successfully." : "Vessel created successfully.",
      );

      await loadVessels();

      window.setTimeout(() => {
        resetForm();
        setShowForm(false);
        setSuccess("");
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save vessel",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vessels</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage vessels used in vessel schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New Vessel
        </button>
      </div>

      {success && !showForm ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      {error && !showForm ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <div>
          <label
            htmlFor="vessel-search"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Search
          </label>
          <input
            id="vessel-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, name, IMO, call sign..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="vessel-type-filter"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Vessel type
          </label>
          <select
            id="vessel-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="">All types</option>
            {VESSEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatVesselType(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="vessel-status-filter"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <select
            id="vessel-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Vessel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  IMO / Call Sign
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Flag
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    Loading vessels...
                  </td>
                </tr>
              ) : filteredVessels.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    No vessels found.
                  </td>
                </tr>
              ) : (
                filteredVessels.map((vessel) => (
                  <tr key={vessel.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {vessel.code}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-900">
                      {vessel.name}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatVesselType(vessel.type)}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{vessel.imo || "—"}</div>
                      {vessel.callSign ? (
                        <div className="text-xs text-gray-500">
                          {vessel.callSign}
                        </div>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {vessel.flag || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          vessel.isActive
                            ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                            : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                        }
                      >
                        {vessel.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(vessel)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {filteredVessels.length}{" "}
          {filteredVessels.length === 1 ? "vessel" : "vessels"}
        </div>
      </div>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vessel-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2
                id="vessel-form-title"
                className="text-lg font-semibold text-gray-900"
              >
                {editingId ? "Edit Vessel" : "New Vessel"}
              </h2>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vessel-code"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="vessel-code"
                    required
                    maxLength={20}
                    value={form.code}
                    onChange={(e) =>
                      updateForm("code", e.target.value.toUpperCase())
                    }
                    placeholder="EVER_GIVEN"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vessel-type"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="vessel-type"
                    value={form.type}
                    onChange={(e) =>
                      updateForm("type", e.target.value as VesselType)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    {VESSEL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatVesselType(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="vessel-name"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Vessel name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="vessel-name"
                    required
                    maxLength={200}
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Ever Given"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vessel-imo"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    IMO number
                  </label>
                  <input
                    id="vessel-imo"
                    maxLength={10}
                    value={form.imo}
                    onChange={(e) => updateForm("imo", e.target.value)}
                    placeholder="9811000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vessel-callsign"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Call sign
                  </label>
                  <input
                    id="vessel-callsign"
                    maxLength={10}
                    value={form.callSign}
                    onChange={(e) =>
                      updateForm("callSign", e.target.value.toUpperCase())
                    }
                    placeholder="H3RC"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vessel-flag"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Flag (country code)
                  </label>
                  <input
                    id="vessel-flag"
                    maxLength={3}
                    value={form.flag}
                    onChange={(e) =>
                      updateForm("flag", e.target.value.toUpperCase())
                    }
                    placeholder="PAN"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        updateForm("isActive", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>

                {error ? (
                  <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="sm:col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {success}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? editingId
                      ? "Saving..."
                      : "Creating..."
                    : editingId
                      ? "Save Changes"
                      : "Create Vessel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
