"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const COMPANY_TYPES = [
  "SHIPPING_LINE",
  "SHIPPING_AGENT",
  "TERMINAL_OPERATOR",
  "PORT_AUTHORITY",
  "OTHER",
] as const;

type CompanyType = (typeof COMPANY_TYPES)[number];

type Company = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: CompanyType;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CompanyListResponse = {
  data: Company[];
  count: number;
};

type CompanyFormData = {
  code: string;
  name: string;
  shortName: string;
  type: CompanyType;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
};

const INITIAL_FORM: CompanyFormData = {
  code: "",
  name: "",
  shortName: "",
  type: "SHIPPING_LINE",
  email: "",
  phone: "",
  address: "",
  isActive: true,
};

function formatCompanyType(type: CompanyType): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CompanyManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [form, setForm] = useState<CompanyFormData>(INITIAL_FORM);
  const [showForm, setShowForm] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (typeFilter) {
        params.set("type", typeFilter);
      }

      if (activeFilter) {
        params.set("isActive", activeFilter);
      }

      const query = params.toString();
      const url = query ? `/api/companies?${query}` : "/api/companies";

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as
        | CompanyListResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result
            ? result.error || "Unable to load companies"
            : "Unable to load companies",
        );
      }

      if (!("data" in result)) {
        throw new Error("Invalid response from companies API");
      }

      setCompanies(result.data);
    } catch (error) {
      setCompanies([]);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load companies",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCompanies();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadCompanies]);

  function updateForm<K extends keyof CompanyFormData>(
    field: K,
    value: CompanyFormData[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setShowForm(false);
    setForm(INITIAL_FORM);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as {
        data?: Company;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Unable to create company");
      }

      setSuccessMessage("Company created successfully.");
      setForm(INITIAL_FORM);
      setShowForm(false);

      await loadCompanies();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create company",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Companies
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Manage shipping lines, agents, terminal operators, and port
            authorities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setError("");
            setSuccessMessage("");
          }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New Company
        </button>
      </div>

      {successMessage ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
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
            htmlFor="company-search"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Search
          </label>

          <input
            id="company-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Code, name, or short name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="company-type-filter"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Company type
          </label>

          <select
            id="company-type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="">All types</option>

            {COMPANY_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatCompanyType(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="company-active-filter"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Status
          </label>

          <select
            id="company-active-filter"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
                  Company
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Type
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Contact
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    No companies found.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {company.code}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {company.name}
                      </div>

                      {company.shortName ? (
                        <div className="text-xs text-gray-500">
                          {company.shortName}
                        </div>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatCompanyType(company.type)}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{company.email || "—"}</div>

                      {company.phone ? (
                        <div className="text-xs text-gray-500">
                          {company.phone}
                        </div>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          company.isActive
                            ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                            : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                        }
                      >
                        {company.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {companies.length}{" "}
          {companies.length === 1 ? "company" : "companies"}
        </div>
      </div>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-company-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2
                id="new-company-title"
                className="text-lg font-semibold text-gray-900"
              >
                New Company
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
                    htmlFor="company-code"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Code
                  </label>

                  <input
                    id="company-code"
                    required
                    maxLength={20}
                    value={form.code}
                    onChange={(event) =>
                      updateForm(
                        "code",
                        event.target.value.toUpperCase(),
                      )
                    }
                    placeholder="ONE"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company-short-name"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Short name
                  </label>

                  <input
                    id="company-short-name"
                    maxLength={100}
                    value={form.shortName}
                    onChange={(event) =>
                      updateForm("shortName", event.target.value)
                    }
                    placeholder="ONE"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="company-name"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Company name
                  </label>

                  <input
                    id="company-name"
                    required
                    maxLength={200}
                    value={form.name}
                    onChange={(event) =>
                      updateForm("name", event.target.value)
                    }
                    placeholder="Ocean Network Express"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company-type"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Type
                  </label>

                  <select
                    id="company-type"
                    value={form.type}
                    onChange={(event) =>
                      updateForm(
                        "type",
                        event.target.value as CompanyType,
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    {COMPANY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatCompanyType(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="company-email"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>

                  <input
                    id="company-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    placeholder="operations@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company-phone"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Phone
                  </label>

                  <input
                    id="company-phone"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm("phone", event.target.value)
                    }
                    placeholder="+66..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        updateForm("isActive", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="company-address"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Address
                  </label>

                  <textarea
                    id="company-address"
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      updateForm("address", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                {error ? (
                  <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}