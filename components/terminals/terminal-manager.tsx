"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const emptyForm: TerminalForm = {
  portId: "",
  code: "",
  name: "",
  isActive: true,
};

export function TerminalManager() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);

  const [form, setForm] = useState<TerminalForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [portsLoading, setPortsLoading] =
    useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTerminals() {
    try {
      const response = await fetch("/api/terminals", {
        method: "GET",
        cache: "no-store",
      });

      const result =
        (await response.json()) as TerminalsResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load terminals",
        );
      }

      setTerminals(
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load terminals",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPorts() {
    try {
      const response = await fetch("/api/ports", {
        method: "GET",
        cache: "no-store",
      });

      const result =
        (await response.json()) as PortsResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load ports",
        );
      }

      setPorts(
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load ports",
      );
    } finally {
      setPortsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [terminalsResponse, portsResponse] =
          await Promise.all([
            fetch("/api/terminals", {
              method: "GET",
              cache: "no-store",
            }),

            fetch("/api/ports", {
              method: "GET",
              cache: "no-store",
            }),
          ]);

        const terminalsResult =
          (await terminalsResponse.json()) as TerminalsResponse;

        const portsResult =
          (await portsResponse.json()) as PortsResponse;

        if (!terminalsResponse.ok) {
          throw new Error(
            terminalsResult.error ||
              "Failed to load terminals",
          );
        }

        if (!portsResponse.ok) {
          throw new Error(
            portsResult.error || "Failed to load ports",
          );
        }

        if (!cancelled) {
          setTerminals(
            Array.isArray(terminalsResult.data)
              ? terminalsResult.data
              : [],
          );

          setPorts(
            Array.isArray(portsResult.data)
              ? portsResult.data
              : [],
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load terminal data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPortsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const activePorts = useMemo(() => {
    return ports.filter((port) => {
      if (port.isActive) {
        return true;
      }

      return (
        editingId !== null &&
        form.portId === port.id
      );
    });
  }, [ports, editingId, form.portId]);

  const filteredTerminals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return terminals.filter((terminal) => {
      const matchesSearch =
        !query ||
        terminal.code.toLowerCase().includes(query) ||
        terminal.name.toLowerCase().includes(query) ||
        terminal.port.code
          .toLowerCase()
          .includes(query) ||
        terminal.port.name
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          terminal.isActive) ||
        (statusFilter === "inactive" &&
          !terminal.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [terminals, search, statusFilter]);

  function updateForm<Field extends keyof TerminalForm>(
    field: Field,
    value: TerminalForm[Field],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function startEdit(terminal: Terminal) {
    setEditingId(terminal.id);

    setForm({
      portId: terminal.portId,
      code: terminal.code,
      name: terminal.name,
      isActive: terminal.isActive,
    });

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const url = editingId
        ? `/api/terminals/${editingId}`
        : "/api/terminals";

      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result =
        (await response.json()) as TerminalResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to ${
              editingId ? "update" : "create"
            } terminal`,
        );
      }

      setSuccess(
        editingId
          ? "Terminal updated successfully"
          : "Terminal created successfully",
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadTerminals();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save terminal",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(terminal: Terminal) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/terminals/${terminal.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            portId: terminal.portId,
            code: terminal.code,
            name: terminal.name,
            isActive: !terminal.isActive,
          }),
        },
      );

      const result =
        (await response.json()) as TerminalResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update terminal status",
        );
      }

      setSuccess(
        terminal.isActive
          ? "Terminal deactivated successfully"
          : "Terminal activated successfully",
      );

      await loadTerminals();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Failed to update terminal status",
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <section>
        <h1 className="text-3xl font-bold">
          Terminal Management
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Create, edit, activate, and deactivate
          terminals.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId
                ? "Edit Terminal"
                : "Create Terminal"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {editingId
                ? "Update the selected terminal."
                : "Add a terminal to an existing port."}
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
              htmlFor="portId"
              className="mb-1 block text-sm font-medium"
            >
              Port
            </label>

            <select
              id="portId"
              value={form.portId}
              onChange={(event) =>
                updateForm(
                  "portId",
                  event.target.value,
                )
              }
              disabled={portsLoading || saving}
              required
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">
                {portsLoading
                  ? "Loading ports..."
                  : "Select Port"}
              </option>

              {activePorts.map((port) => (
                <option
                  key={port.id}
                  value={port.id}
                >
                  {port.code} - {port.name}
                  {!port.isActive
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
              Terminal Code
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
              placeholder="A1"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2 uppercase"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium"
            >
              Terminal Name
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
              placeholder="Terminal A1"
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
              disabled={saving || portsLoading}
              className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Terminal"
                  : "Create Terminal"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Terminals
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {filteredTerminals.length} terminal
              {filteredTerminals.length === 1
                ? ""
                : "s"}
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
                placeholder="Code, name, or port"
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
                <option value="all">
                  All
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading terminals...
          </div>
        ) : filteredTerminals.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-gray-500">
            No terminals found.
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
                    Port
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
                {filteredTerminals.map(
                  (terminal) => (
                    <tr
                      key={terminal.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {terminal.code}
                      </td>

                      <td className="px-4 py-3">
                        {terminal.name}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {terminal.port.code}
                        </div>

                        <div className="text-xs text-gray-500">
                          {terminal.port.name}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            terminal.isActive
                              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                              : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                          }
                        >
                          {terminal.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(terminal)
                            }
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void toggleStatus(
                                terminal,
                              )
                            }
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                          >
                            {terminal.isActive
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}