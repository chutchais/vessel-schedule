"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

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
  const isMountedRef = useRef(true);
  const canViewAuditLogs = useCanViewAuditLogs();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [form, setForm] = useState<CompanyFormData>(INITIAL_FORM);
  const [initialFormState, setInitialFormState] = useState<CompanyFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Company | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const loadCompanies = useCallback(async () => {
    if (isMountedRef.current) {
      setIsLoading(true);
      setPageError("");
    }

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

      const result = (await response.json()) as CompanyListResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result ? result.error || "Unable to load companies" : "Unable to load companies",
        );
      }

      if (!("data" in result)) {
        throw new Error("Invalid response from companies API");
      }

      if (isMountedRef.current) {
        setCompanies(result.data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setCompanies([]);
        setPageError(error instanceof Error ? error.message : "Unable to load companies");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeFilter, search, typeFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCompanies();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadCompanies]);

  const hasActiveFilters = search.trim() !== "" || typeFilter !== "" || activeFilter !== "";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<K extends keyof CompanyFormData>(field: K, value: CompanyFormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function closeDrawerImmediately() {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setInitialFormState(INITIAL_FORM);
    setDrawerError("");
    setShowDiscardChanges(false);
  }

  function requestCloseDrawer() {
    if (isSubmitting) {
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
    setSuccessMessage("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(company: Company) {
    const editForm: CompanyFormData = {
      code: company.code,
      name: company.name,
      shortName: company.shortName ?? "",
      type: company.type,
      email: company.email ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
      isActive: company.isActive,
    };

    setEditingId(company.id);
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
    setTypeFilter("");
    setActiveFilter("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isMountedRef.current) {
      return;
    }

    const isEditing = editingId !== null;

    setIsSubmitting(true);
    setDrawerError("");
    setSuccessMessage("");

    try {
      const response = await fetch(isEditing ? `/api/companies/${editingId}` : "/api/companies", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { data?: Company; error?: string };

      if (!response.ok) {
        throw new Error(result.error || (isEditing ? "Unable to update company" : "Unable to create company"));
      }

      await loadCompanies();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccessMessage(isEditing ? "Company updated successfully." : "Company created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Unable to save company");
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
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
      const response = await fetch(`/api/companies/${statusTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: statusTarget.code,
          name: statusTarget.name,
          shortName: statusTarget.shortName ?? "",
          type: statusTarget.type,
          email: statusTarget.email ?? "",
          phone: statusTarget.phone ?? "",
          address: statusTarget.address ?? "",
          isActive: nextIsActive,
        }),
      });

      const result = (await response.json()) as { data?: Company; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Unable to update company status");
      }

      await loadCompanies();

      if (isMountedRef.current) {
        setSuccessMessage(nextIsActive ? "Company activated successfully." : "Company deactivated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Unable to update company status");
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
        title="Company Management"
        description="Manage shipping lines, agents, terminal operators, and port authorities"
        actions={<Button onClick={openCreateDrawer}>Add Company</Button>}
      />

      {successMessage ? <AlertMessage type="success" message={successMessage} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Search" htmlFor="company-search" className="md:col-span-2">
            <Input
              id="company-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, name, or short name"
            />
          </FormField>

          <FormField label="Company type" htmlFor="company-type-filter">
            <Select
              id="company-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {COMPANY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatCompanyType(type)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" htmlFor="company-active-filter">
            <Select
              id="company-active-filter"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {companies.length} {companies.length === 1 ? "company" : "companies"}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${companies.length} ${companies.length === 1 ? "company" : "companies"}`}>
        {isLoading ? (
          <LoadingState message="Loading companies..." />
        ) : companies.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No companies found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Contact</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{company.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{company.name}</div>
                      {company.shortName ? <div className="text-xs text-slate-500">{company.shortName}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatCompanyType(company.type)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{company.email || "—"}</div>
                      {company.phone ? <div className="text-xs text-slate-500">{company.phone}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge active={company.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(company)}>
                          Edit
                        </Button>
                        {canViewAuditLogs ? (
                          <HistoryLink
                            entityType={AUDIT_ENTITY_TYPES.COMPANY}
                            entityId={company.id}
                            entityLabel={company.name}
                          />
                        ) : null}
                        <Button
                          variant={company.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === company.id}
                          onClick={() => setStatusTarget(company)}
                        >
                          {statusUpdatingId === company.id
                            ? "Updating..."
                            : company.isActive
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
        title={editingId ? "Edit Company" : "Create Company"}
        description="Manage company details used across vessel operations."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="company-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingId ? "Update Company" : "Create Company"}
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

        <form id="company-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" htmlFor="company-code" required>
              <Input
                id="company-code"
                required
                maxLength={20}
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                placeholder="ONE"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Short name" htmlFor="company-short-name">
              <Input
                id="company-short-name"
                maxLength={100}
                value={form.shortName}
                onChange={(event) => updateForm("shortName", event.target.value)}
                placeholder="ONE"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Company name" htmlFor="company-name" required className="sm:col-span-2">
              <Input
                id="company-name"
                required
                maxLength={200}
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Ocean Network Express"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Type" htmlFor="company-type">
              <Select
                id="company-type"
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value as CompanyType)}
                disabled={isSubmitting}
              >
                {COMPANY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatCompanyType(type)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Email" htmlFor="company-email">
              <Input
                id="company-email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                placeholder="operations@example.com"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Phone" htmlFor="company-phone">
              <Input
                id="company-phone"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="+66..."
                disabled={isSubmitting}
              />
            </FormField>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm("isActive", event.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Active
              </label>
            </div>

            <FormField label="Address" htmlFor="company-address" className="sm:col-span-2">
              <Textarea
                id="company-address"
                rows={3}
                value={form.address}
                onChange={(event) => updateForm("address", event.target.value)}
                disabled={isSubmitting}
              />
            </FormField>
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
            aria-labelledby="company-status-confirm-title"
            aria-describedby="company-status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="company-status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Company?" : "Activate Company?"}
            </h2>
            <p id="company-status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "This company will no longer be available for new operations."
                : "This company will become available for new operations."}
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
                {statusTarget.isActive ? "Deactivate Company" : "Activate Company"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
