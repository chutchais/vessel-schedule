"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type CompanyType =
  | "SHIPPING_LINE"
  | "SHIPPING_AGENT"
  | "TERMINAL_OPERATOR"
  | "PORT_AUTHORITY"
  | "OTHER";

type Company = {
  id: string;
  code: string;
  name: string;
  type: CompanyType;
  isActive: boolean;
};

type Service = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    code: string;
    name: string;
    type: CompanyType;
    isActive: boolean;
  };
};

type ServiceForm = {
  companyId: string;
  code: string;
  name: string;
  description: string;
  color: string;
  isActive: boolean;
};

type ServicesResponse = {
  data?: Service[];
  error?: string;
};

type CompaniesResponse = {
  data?: Company[];
  error?: string;
};

type ServiceResponse = {
  data?: Service;
  error?: string;
};

const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/i;

const initialForm: ServiceForm = {
  companyId: "",
  code: "",
  name: "",
  description: "",
  color: "#3B82F6",
  isActive: true,
};

export function ServiceManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [form, setForm] = useState<ServiceForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [shippingLineFilter, setShippingLineFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] =
    useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadServices() {
    try {
      const response = await fetch("/api/services", {
        method: "GET",
        cache: "no-store",
      });

      const result =
        (await response.json()) as ServicesResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load services",
        );
      }

      setServices(
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load services",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [servicesResponse, companiesResponse] =
          await Promise.all([
            fetch("/api/services", {
              method: "GET",
              cache: "no-store",
            }),
            fetch("/api/companies", {
              method: "GET",
              cache: "no-store",
            }),
          ]);

        const servicesResult =
          (await servicesResponse.json()) as ServicesResponse;
        const companiesResult =
          (await companiesResponse.json()) as CompaniesResponse;

        if (!servicesResponse.ok) {
          throw new Error(
            servicesResult.error ||
              "Failed to load services",
          );
        }

        if (!companiesResponse.ok) {
          throw new Error(
            companiesResult.error ||
              "Failed to load companies",
          );
        }

        if (!cancelled) {
          const serviceList = Array.isArray(
            servicesResult.data,
          )
            ? servicesResult.data
            : [];
          const companyList = Array.isArray(
            companiesResult.data,
          )
            ? companiesResult.data
            : [];

          setServices(serviceList);
          setCompanies(companyList);

          setForm((current) => {
            if (current.companyId) {
              return current;
            }

            const firstActiveShippingLine =
              companyList.find(
                (company) =>
                  company.type ===
                    "SHIPPING_LINE" &&
                  company.isActive,
              );

            if (!firstActiveShippingLine) {
              return current;
            }

            return {
              ...current,
              companyId: firstActiveShippingLine.id,
            };
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load service data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setCompaniesLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const shippingLineCompanies = useMemo(() => {
    return companies.filter(
      (company) => company.type === "SHIPPING_LINE",
    );
  }, [companies]);

  const availableShippingLines = useMemo(() => {
    return shippingLineCompanies.filter((company) => {
      if (company.isActive) {
        return true;
      }

      return (
        editingId !== null &&
        form.companyId === company.id
      );
    });
  }, [shippingLineCompanies, editingId, form.companyId]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const description = service.description || "";

      const matchesSearch =
        !query ||
        service.code.toLowerCase().includes(query) ||
        service.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        service.company.code
          .toLowerCase()
          .includes(query) ||
        service.company.name
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          service.isActive) ||
        (statusFilter === "inactive" &&
          !service.isActive);

      const matchesShippingLine =
        shippingLineFilter === "all" ||
        service.companyId === shippingLineFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesShippingLine
      );
    });
  }, [
    services,
    search,
    statusFilter,
    shippingLineFilter,
  ]);

  function updateForm<Field extends keyof ServiceForm>(
    field: Field,
    value: ServiceForm[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    const firstActiveShippingLine =
      shippingLineCompanies.find(
        (company) => company.isActive,
      );

    setForm({
      ...initialForm,
      companyId: firstActiveShippingLine
        ? firstActiveShippingLine.id
        : "",
    });
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      companyId: service.companyId,
      code: service.code,
      name: service.name,
      description: service.description || "",
      color: service.color,
      isActive: service.isActive,
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
      companyId: form.companyId,
      code: form.code,
      name: form.name,
      description: form.description,
      color: form.color,
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
          ? `/api/services/${editingId}`
          : "/api/services",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toPayload()),
        },
      );

      const result =
        (await response.json()) as ServiceResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to ${
              editingId ? "update" : "create"
            } service`,
        );
      }

      setSuccess(
        editingId
          ? "Service updated successfully"
          : "Service created successfully",
      );

      resetForm();
      await loadServices();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save service",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(service: Service) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/services/${service.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId: service.companyId,
            code: service.code,
            name: service.name,
            description: service.description,
            color: service.color,
            isActive: !service.isActive,
          }),
        },
      );

      const result =
        (await response.json()) as ServiceResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update service status",
        );
      }

      setSuccess(
        service.isActive
          ? "Service deactivated successfully"
          : "Service activated successfully",
      );

      await loadServices();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Failed to update service status",
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <section>
        <h1 className="text-3xl font-bold">
          Service Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Create, edit, activate, and deactivate
          shipping services.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId
                ? "Edit Service"
                : "Create Service"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingId
                ? "Update the selected service."
                : "Add a new service for a shipping line."}
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
              htmlFor="companyId"
              className="mb-1 block text-sm font-medium"
            >
              Shipping line
            </label>
            <select
              id="companyId"
              value={form.companyId}
              onChange={(event) =>
                updateForm(
                  "companyId",
                  event.target.value,
                )
              }
              disabled={companiesLoading || saving}
              required
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">
                {companiesLoading
                  ? "Loading shipping lines..."
                  : "Select Shipping Line"}
              </option>
              {availableShippingLines.map((company) => (
                <option
                  key={company.id}
                  value={company.id}
                >
                  {company.code} - {company.name}
                  {!company.isActive
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
              Service Code
            </label>
            <input
              id="code"
              type="text"
              value={form.code}
              onChange={(event) =>
                updateForm(
                  "code",
                  event.target.value.toUpperCase(),
                )
              }
              required
              maxLength={30}
              placeholder="FP1"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2 uppercase"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium"
            >
              Service Name
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
              placeholder="Far East Pendulum 1"
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium"
            >
              Description
            </label>
            <input
              id="description"
              type="text"
              value={form.description}
              onChange={(event) =>
                updateForm(
                  "description",
                  event.target.value,
                )
              }
              maxLength={500}
              placeholder="Asia to Europe weekly loop"
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
              disabled={saving || companiesLoading}
              className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Service"
                  : "Create Service"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Services
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredServices.length} service
              {filteredServices.length === 1 ? "" : "s"}
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
                placeholder="Code, name, description, shipping line"
                className="w-full rounded-md border px-3 py-2 sm:w-72"
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

            <div>
              <label
                htmlFor="shippingLineFilter"
                className="mb-1 block text-sm font-medium"
              >
                Shipping line
              </label>
              <select
                id="shippingLineFilter"
                value={shippingLineFilter}
                onChange={(event) =>
                  setShippingLineFilter(
                    event.target.value,
                  )
                }
                className="w-full rounded-md border px-3 py-2 sm:w-64"
              >
                <option value="all">
                  All shipping lines
                </option>
                {shippingLineCompanies.map((company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.code} - {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading services...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-gray-500">
            No services found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 font-semibold">
                    Color
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Service Code
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Service Name
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Shipping line
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Description
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
                {filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border"
                          style={{
                            backgroundColor: service.color,
                          }}
                        />
                        <span className="font-mono text-xs text-gray-700">
                          {service.color}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {service.code}
                    </td>
                    <td className="px-4 py-3">
                      {service.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {service.company.code}
                      </div>
                      <div className="text-xs text-gray-500">
                        {service.company.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {service.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          service.isActive
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                        }
                      >
                        {service.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(service)
                          }
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void toggleStatus(service)
                          }
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          {service.isActive
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
