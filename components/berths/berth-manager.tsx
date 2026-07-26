"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const initialForm: BerthForm = {
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
  const [berths, setBerths] = useState<Berth[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  const [form, setForm] = useState<BerthForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [terminalsLoading, setTerminalsLoading] =
    useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadBerths() {
    try {
      const response = await fetch("/api/berths", {
        method: "GET",
        cache: "no-store",
      });

      const result =
        (await response.json()) as BerthsResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load berths",
        );
      }

      setBerths(
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load berths",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [berthsResponse, terminalsResponse] =
          await Promise.all([
            fetch("/api/berths", {
              method: "GET",
              cache: "no-store",
            }),
            fetch("/api/terminals", {
              method: "GET",
              cache: "no-store",
            }),
          ]);

        const berthsResult =
          (await berthsResponse.json()) as BerthsResponse;
        const terminalsResult =
          (await terminalsResponse.json()) as TerminalsResponse;

        if (!berthsResponse.ok) {
          throw new Error(
            berthsResult.error ||
              "Failed to load berths",
          );
        }

        if (!terminalsResponse.ok) {
          throw new Error(
            terminalsResult.error ||
              "Failed to load terminals",
          );
        }

        if (!cancelled) {
          setBerths(
            Array.isArray(berthsResult.data)
              ? berthsResult.data
              : [],
          );
          setTerminals(
            Array.isArray(terminalsResult.data)
              ? terminalsResult.data
              : [],
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load berth data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTerminalsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableTerminals = useMemo(() => {
    return terminals.filter((terminal) => {
      if (terminal.isActive) {
        return true;
      }

      return (
        editingId !== null &&
        form.terminalId === terminal.id
      );
    });
  }, [terminals, editingId, form.terminalId]);

  const filteredBerths = useMemo(() => {
    const query = search.trim().toLowerCase();

    return berths.filter((berth) => {
      const matchesSearch =
        !query ||
        berth.code.toLowerCase().includes(query) ||
        berth.name.toLowerCase().includes(query) ||
        berth.terminal.code
          .toLowerCase()
          .includes(query) ||
        berth.terminal.name
          .toLowerCase()
          .includes(query) ||
        berth.terminal.port.code
          .toLowerCase()
          .includes(query) ||
        berth.terminal.port.name
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          berth.isActive) ||
        (statusFilter === "inactive" &&
          !berth.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [berths, search, statusFilter]);

  function updateForm<Field extends keyof BerthForm>(
    field: Field,
    value: BerthForm[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function startEdit(berth: Berth) {
    setEditingId(berth.id);
    setForm({
      terminalId: berth.terminalId,
      code: berth.code,
      name: berth.name,
      berthLength: berth.berthLength.toString(),
      color: berth.color,
      zeroOriginSide:
        berth.zeroOriginSide === "RIGHT"
          ? "right"
          : "left",
      sortOrder: berth.sortOrder.toString(),
      isActive: berth.isActive,
    });
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!COLOR_HEX_PATTERN.test(form.color)) {
      setError("Color must match #RRGGBB");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        editingId
          ? `/api/berths/${editingId}`
          : "/api/berths",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toPayload()),
        },
      );

      const result =
        (await response.json()) as BerthResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to ${
              editingId ? "update" : "create"
            } berth`,
        );
      }

      setSuccess(
        editingId
          ? "Berth updated successfully"
          : "Berth created successfully",
      );

      setForm(initialForm);
      setEditingId(null);
      await loadBerths();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save berth",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(berth: Berth) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/berths/${berth.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            terminalId: berth.terminalId,
            code: berth.code,
            name: berth.name,
            berthLength: berth.berthLength,
            color: berth.color,
            zeroOriginSide:
              berth.zeroOriginSide === "RIGHT"
                ? "right"
                : "left",
            sortOrder: berth.sortOrder,
            isActive: !berth.isActive,
          }),
        },
      );

      const result =
        (await response.json()) as BerthResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update berth status",
        );
      }

      setSuccess(
        berth.isActive
          ? "Berth deactivated successfully"
          : "Berth activated successfully",
      );

      await loadBerths();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Failed to update berth status",
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <section>
        <h1 className="text-3xl font-bold">
          Berth Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Create, edit, activate, and deactivate berths.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit Berth" : "Create Berth"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingId
                ? "Update the selected berth."
                : "Add a berth to an existing terminal."}
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
        >
          <div>
            <label
              htmlFor="terminalId"
              className="mb-1 block text-sm font-medium"
            >
              Terminal
            </label>
            <select
              id="terminalId"
              value={form.terminalId}
              onChange={(event) =>
                updateForm(
                  "terminalId",
                  event.target.value,
                )
              }
              disabled={terminalsLoading || saving}
              required
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">
                {terminalsLoading
                  ? "Loading terminals..."
                  : "Select Terminal"}
              </option>
              {availableTerminals.map((terminal) => (
                <option
                  key={terminal.id}
                  value={terminal.id}
                >
                  {terminal.port.code}/{terminal.code} -{" "}
                  {terminal.name}
                  {!terminal.isActive
                    ? " (Inactive)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-1 block text-sm font-medium"
            >
              Berth Code
            </label>
            <input
              id="code"
              type="text"
              value={form.code}
              onChange={(event) =>
                updateForm(
                  "code",
                  event.target.value,
                )
              }
              required
              maxLength={20}
              placeholder="B01"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2 uppercase"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium"
            >
              Berth Name
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(event) =>
                updateForm(
                  "name",
                  event.target.value,
                )
              }
              required
              maxLength={200}
              placeholder="Main Berth"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="berthLength"
              className="mb-1 block text-sm font-medium"
            >
              Berth Length (m)
            </label>
            <input
              id="berthLength"
              type="number"
              value={form.berthLength}
              onChange={(event) =>
                updateForm(
                  "berthLength",
                  event.target.value,
                )
              }
              required
              min="0.01"
              step="0.01"
              placeholder="350"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="color"
              className="mb-1 block text-sm font-medium"
            >
              Color
            </label>
            <div className="flex gap-2">
              <input
                id="color"
                type="color"
                value={
                  COLOR_HEX_PATTERN.test(form.color)
                    ? form.color
                    : "#3B82F6"
                }
                onChange={(event) =>
                  updateForm(
                    "color",
                    event.target.value.toUpperCase(),
                  )
                }
                disabled={saving}
                className="h-10 w-14 rounded-md border px-1 py-1"
              />
              <input
                type="text"
                value={form.color}
                onChange={(event) =>
                  updateForm(
                    "color",
                    event.target.value.toUpperCase(),
                  )
                }
                required
                pattern="#[0-9A-Fa-f]{6}"
                placeholder="#3B82F6"
                maxLength={7}
                disabled={saving}
                className="w-full rounded-md border px-3 py-2 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="zeroOriginSide"
              className="mb-1 block text-sm font-medium"
            >
              Zero Origin Side
            </label>
            <select
              id="zeroOriginSide"
              value={form.zeroOriginSide}
              onChange={(event) =>
                updateForm(
                  "zeroOriginSide",
                  event.target.value as
                    | "left"
                    | "right",
                )
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="sortOrder"
              className="mb-1 block text-sm font-medium"
            >
              Sort Order
            </label>
            <input
              id="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                updateForm(
                  "sortOrder",
                  event.target.value,
                )
              }
              min="0"
              step="1"
              required
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  updateForm(
                    "isActive",
                    event.target.checked,
                  )
                }
                disabled={saving}
              />
              <span className="text-sm font-medium">
                Active
              </span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || terminalsLoading}
              className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Berth"
                  : "Create Berth"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Berths
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredBerths.length} berth
              {filteredBerths.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div>
              <label
                htmlFor="search"
                className="mb-1 block text-sm font-medium"
              >
                Search
              </label>
              <input
                id="search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Code, name, terminal, port"
                className="w-full rounded-md border px-3 py-2 sm:w-64"
              />
            </div>

            <div>
              <label
                htmlFor="statusFilter"
                className="mb-1 block text-sm font-medium"
              >
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                className="w-full rounded-md border px-3 py-2 sm:w-40"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading berths...
          </div>
        ) : filteredBerths.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-gray-500">
            No berths found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Terminal
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Length (m)
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Zero Origin
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Sort
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredBerths.map((berth) => (
                  <tr
                    key={berth.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {berth.code}
                    </td>
                    <td className="px-4 py-3">
                      <div>{berth.name}</div>
                      <div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className="inline-block h-3 w-3 rounded-full border"
                          style={{
                            backgroundColor: berth.color,
                          }}
                        />
                        <span className="font-mono">
                          {berth.color}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {berth.terminal.code} -{" "}
                        {berth.terminal.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {berth.terminal.port.code} -{" "}
                        {berth.terminal.port.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {formatLength(berth.berthLength)}
                    </td>
                    <td className="px-4 py-3">
                      {berth.zeroOriginSide === "RIGHT"
                        ? "Right"
                        : "Left"}
                    </td>
                    <td className="px-4 py-3">
                      {berth.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          berth.isActive
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                        }
                      >
                        {berth.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(berth)}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void toggleStatus(berth)
                          }
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          {berth.isActive
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
