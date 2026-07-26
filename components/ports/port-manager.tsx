"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

type ApiErrorResponse = {
  error?: string;
};

type PortsResponse = {
  data?: Port[];
  count?: number;
  error?: string;
};

type CreatePortResponse = {
  data?: Port;
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

export default function PortManager() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [form, setForm] = useState<PortForm>(initialForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

//   const loadPorts = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const response = await fetch("/api/ports", {
//         method: "GET",
//         cache: "no-store",
//       });

//       const result = (await response.json()) as PortsResponse;

//       if (!response.ok) {
//         throw new Error(result.error || "Failed to load ports");
//       }

//       setPorts(Array.isArray(result.data) ? result.data : []);
//     } catch (loadError) {
//       setError(
//         loadError instanceof Error
//           ? loadError.message
//           : "Failed to load ports",
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void loadPorts();
//   }, [loadPorts]);

const loadPorts = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const response = await fetch("/api/ports", {
      method: "GET",
      cache: "no-store",
    });

    const result = (await response.json()) as PortsResponse;

    if (!response.ok) {
      throw new Error(result.error || "Failed to load ports");
    }

    setPorts(Array.isArray(result.data) ? result.data : []);
  } catch (loadError) {
    setError(
      loadError instanceof Error
        ? loadError.message
        : "Failed to load ports",
    );
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  let cancelled = false;

  async function fetchInitialPorts() {
    try {
      const response = await fetch("/api/ports", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as PortsResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to load ports");
      }

      if (!cancelled) {
        setPorts(Array.isArray(result.data) ? result.data : []);
      }
    } catch (loadError) {
      if (!cancelled) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load ports",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchInitialPorts();

  return () => {
    cancelled = true;
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

  function updateForm<K extends keyof PortForm>(
    field: K,
    value: PortForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setError("");
    setSuccessMessage("");
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function closeCreateForm() {
    resetForm();
    setShowForm(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        code: form.code,
        unlocode: form.unlocode,
        name: form.name,
        country: form.country,
        timezone: form.timezone,
        latitude: form.latitude,
        longitude: form.longitude,
        isActive: form.isActive,
      };

      const response = await fetch("/api/ports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as CreatePortResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to create port");
      }

      setSuccessMessage("Port created successfully.");
      setForm(initialForm);

      await loadPorts();

      window.setTimeout(() => {
        setShowForm(false);
        setSuccessMessage("");
      }, 700);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create port",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Ports
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Manage ports used in vessel schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New Port
        </button>
      </div>

      {showForm && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Create Port
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Fields marked with * are required.
              </p>
            </div>

            <button
              type="button"
              onClick={closeCreateForm}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="code"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Port Code *
                </label>

                <input
                  id="code"
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    updateForm("code", event.target.value.toUpperCase())
                  }
                  maxLength={10}
                  required
                  placeholder="LCB"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="unlocode"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  UN/LOCODE
                </label>

                <input
                  id="unlocode"
                  type="text"
                  value={form.unlocode}
                  onChange={(event) =>
                    updateForm(
                      "unlocode",
                      event.target.value.toUpperCase(),
                    )
                  }
                  maxLength={5}
                  placeholder="THLCH"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Port Name *
                </label>

                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateForm("name", event.target.value)
                  }
                  required
                  placeholder="Laem Chabang"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="country"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Country *
                </label>

                <input
                  id="country"
                  type="text"
                  value={form.country}
                  onChange={(event) =>
                    updateForm("country", event.target.value)
                  }
                  required
                  placeholder="Thailand"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="timezone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Timezone *
                </label>

                <input
                  id="timezone"
                  type="text"
                  value={form.timezone}
                  onChange={(event) =>
                    updateForm("timezone", event.target.value)
                  }
                  required
                  placeholder="Asia/Bangkok"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="latitude"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Latitude
                </label>

                <input
                  id="latitude"
                  type="number"
                  value={form.latitude}
                  onChange={(event) =>
                    updateForm("latitude", event.target.value)
                  }
                  min={-90}
                  max={90}
                  step="any"
                  placeholder="13.0827"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="longitude"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Longitude
                </label>

                <input
                  id="longitude"
                  type="number"
                  value={form.longitude}
                  onChange={(event) =>
                    updateForm("longitude", event.target.value)
                  }
                  min={-180}
                  max={180}
                  step="any"
                  placeholder="100.8833"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                />
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  updateForm("isActive", event.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />

              <span className="text-sm font-medium text-gray-700">
                Active
              </span>
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Port"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-gray-200 p-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="search" className="sr-only">
              Search ports
            </label>

            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code, name, country..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>

            <select
              id="status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "all"
                    | "active"
                    | "inactive",
                )
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        {!showForm && error && (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Code
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  UN/LOCODE
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Port Name
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Country
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Timezone
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Coordinates
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
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
                    Loading ports...
                  </td>
                </tr>
              ) : filteredPorts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    No ports found.
                  </td>
                </tr>
              ) : (
                filteredPorts.map((port) => (
                  <tr key={port.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">
                      {port.code}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {port.unlocode || "—"}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-900">
                      {port.name}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {port.country}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {port.timezone}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {displayCoordinate(port.latitude)},{" "}
                      {displayCoordinate(port.longitude)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          port.isActive
                            ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                            : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                        }
                      >
                        {port.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
          Showing {filteredPorts.length} of {ports.length} ports
        </div>
      </section>
    </div>
  );
}