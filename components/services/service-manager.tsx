"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

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
  } | null;
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

const INITIAL_FORM: ServiceForm = {
  companyId: "",
  code: "",
  name: "",
  description: "",
  color: "#3B82F6",
  isActive: true,
};

export function ServiceManager() {
  const isMountedRef = useRef(true);
  const canViewAuditLogs = useCanViewAuditLogs();

  const [services, setServices] = useState<Service[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [form, setForm] = useState<ServiceForm>(INITIAL_FORM);
  const [initialFormState, setInitialFormState] = useState<ServiceForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Service | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shippingLineFilter, setShippingLineFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);
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

  const loadServicesAndCompanies = useCallback(async () => {
    if (isMountedRef.current) {
      setLoading(true);
      setCompaniesLoading(true);
      setPageError("");
    }

    try {
      const [servicesResponse, companiesResponse] = await Promise.all([
        fetch("/api/services", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/companies", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const servicesResult = (await servicesResponse.json()) as ServicesResponse;
      const companiesResult = (await companiesResponse.json()) as CompaniesResponse;

      if (!servicesResponse.ok) {
        throw new Error(servicesResult.error || "Failed to load services");
      }

      if (!companiesResponse.ok) {
        throw new Error(companiesResult.error || "Failed to load companies");
      }

      const serviceList = Array.isArray(servicesResult.data) ? servicesResult.data : [];
      const companyList = Array.isArray(companiesResult.data) ? companiesResult.data : [];

      if (isMountedRef.current) {
        setServices(serviceList);
        setCompanies(companyList);
      }

      return companyList;
    } catch (error) {
      if (isMountedRef.current) {
        setServices([]);
        setCompanies([]);
        setPageError(error instanceof Error ? error.message : "Failed to load service data");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setCompaniesLoading(false);
      }
    }
    return [];
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        const companyList = await loadServicesAndCompanies();
        const firstActiveShippingLine = companyList.find(
          (company) => company.type === "SHIPPING_LINE" && company.isActive,
        );

        if (isMountedRef.current && firstActiveShippingLine) {
          const shippingLineId = firstActiveShippingLine.id;

          setForm((current) => {
            if (current.companyId) {
              return current;
            }

            return {
              ...current,
              companyId: shippingLineId,
            };
          });

          setInitialFormState((current) => {
            if (current.companyId) {
              return current;
            }

            return {
              ...current,
              companyId: shippingLineId,
            };
          });
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadServicesAndCompanies]);

  const shippingLineCompanies = useMemo(() => {
    return companies.filter((company) => company.type === "SHIPPING_LINE");
  }, [companies]);

  const availableShippingLines = useMemo(() => {
    return shippingLineCompanies.filter((company) => {
      if (company.isActive) {
        return true;
      }

      return editingId !== null && form.companyId === company.id;
    });
  }, [editingId, form.companyId, shippingLineCompanies]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const description = service.description || "";
      const matchesSearch =
        !query ||
        service.code.toLowerCase().includes(query) ||
        service.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        service.company?.code.toLowerCase().includes(query) ||
        service.company?.name.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.isActive) ||
        (statusFilter === "inactive" && !service.isActive);

      const matchesShippingLine =
        shippingLineFilter === "all" || service.companyId === shippingLineFilter;

      return matchesSearch && matchesStatus && matchesShippingLine;
    });
  }, [search, services, shippingLineFilter, statusFilter]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || shippingLineFilter !== "all";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<Field extends keyof ServiceForm>(field: Field, value: ServiceForm[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function getDefaultCreateForm(companyList: Company[]): ServiceForm {
    const firstActiveShippingLine = companyList.find(
      (company) => company.type === "SHIPPING_LINE" && company.isActive,
    );

    return {
      ...INITIAL_FORM,
      companyId: firstActiveShippingLine ? firstActiveShippingLine.id : "",
    };
  }

  function closeDrawerImmediately() {
    const defaultForm = getDefaultCreateForm(companies);
    setForm(defaultForm);
    setInitialFormState(defaultForm);
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
    const defaultForm = getDefaultCreateForm(companies);
    setEditingId(null);
    setForm(defaultForm);
    setInitialFormState(defaultForm);
    setDrawerError("");
    setPageError("");
    setSuccess("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(service: Service) {
    const editForm: ServiceForm = {
      companyId: service.companyId,
      code: service.code,
      name: service.name,
      description: service.description || "",
      color: service.color,
      isActive: service.isActive,
    };

    setEditingId(service.id);
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
    setShippingLineFilter("all");
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
      const response = await fetch(editingId ? `/api/services/${editingId}` : "/api/services", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload()),
      });

      const result = (await response.json()) as ServiceResponse;

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingId ? "update" : "create"} service`);
      }

      await loadServicesAndCompanies();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccess(editingId ? "Service updated successfully." : "Service created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Failed to save service");
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
      const response = await fetch(`/api/services/${statusTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: statusTarget.companyId,
          code: statusTarget.code,
          name: statusTarget.name,
          description: statusTarget.description,
          color: statusTarget.color,
          isActive: !statusTarget.isActive,
        }),
      });

      const result = (await response.json()) as ServiceResponse;

      if (!response.ok) {
        throw new Error(result.error || "Failed to update service status");
      }

      await loadServicesAndCompanies();

      if (isMountedRef.current) {
        setSuccess(statusTarget.isActive ? "Service deactivated successfully." : "Service activated successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to update service status");
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
        title="Service Management"
        description="Create, edit, activate, and deactivate shipping services"
        actions={<Button onClick={openCreateDrawer}>Add Service</Button>}
      />

      {success ? <AlertMessage type="success" message={success} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Search" htmlFor="service-search" className="md:col-span-2">
            <Input
              id="service-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Code, name, description, or shipping line"
            />
          </FormField>

          <FormField label="Status" htmlFor="service-status-filter">
            <Select id="service-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>

          <FormField label="Shipping line" htmlFor="shipping-line-filter">
            <Select
              id="shipping-line-filter"
              value={shippingLineFilter}
              onChange={(event) => setShippingLineFilter(event.target.value)}
            >
              <option value="all">All shipping lines</option>
              {shippingLineCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.code} - {company.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredServices.length} of {services.length} services
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredServices.length} ${filteredServices.length === 1 ? "service" : "services"}`}>
        {loading ? (
          <LoadingState message="Loading services..." />
        ) : filteredServices.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No services found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Color</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Service Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Service Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Shipping line</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-block h-4 w-4 rounded-sm border" style={{ backgroundColor: service.color }} />
                        <span className="font-mono text-xs text-slate-700">{service.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{service.code}</td>
                    <td className="px-4 py-3 text-slate-900">{service.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{service.company?.code ?? "—"}</div>
                      <div className="text-xs text-slate-500">{service.company?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{service.description || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={service.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(service)}>
                          Edit
                        </Button>
                        {canViewAuditLogs ? (
                          <HistoryLink
                            entityType={AUDIT_ENTITY_TYPES.SERVICE}
                            entityId={service.id}
                            entityLabel={`${service.code} — ${service.name}`}
                          />
                        ) : null}
                        <Button
                          variant={service.isActive ? "danger" : "primary"}
                          className="h-8 px-3 text-xs"
                          disabled={statusUpdatingId === service.id}
                          onClick={() => setStatusTarget(service)}
                        >
                          {statusUpdatingId === service.id
                            ? "Updating..."
                            : service.isActive
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
        title={editingId ? "Edit Service" : "Create Service"}
        description="Add a new service for a shipping line."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="service-form" disabled={saving || companiesLoading}>
              {saving ? "Saving..." : editingId ? "Update Service" : "Create Service"}
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

        <form id="service-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Shipping line" htmlFor="service-company" required>
              <Select
                id="service-company"
                value={form.companyId}
                onChange={(event) => updateForm("companyId", event.target.value)}
                disabled={companiesLoading || saving}
                required
              >
                <option value="">{companiesLoading ? "Loading shipping lines..." : "Select Shipping Line"}</option>
                {availableShippingLines.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.code} - {company.name}
                    {!company.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Service Code" htmlFor="service-code" required>
              <Input
                id="service-code"
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                required
                maxLength={30}
                placeholder="FP1"
                disabled={saving}
                className="uppercase"
              />
            </FormField>

            <FormField label="Service Name" htmlFor="service-name" required>
              <Input
                id="service-name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                maxLength={200}
                placeholder="Far East Pendulum 1"
                disabled={saving}
              />
            </FormField>

            <FormField label="Description" htmlFor="service-description">
              <Input
                id="service-description"
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                maxLength={500}
                placeholder="Asia to Europe weekly loop"
                disabled={saving}
              />
            </FormField>

            <FormField label="Color" htmlFor="service-color">
              <div className="flex gap-2">
                <Input
                  id="service-color"
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
            aria-labelledby="service-status-confirm-title"
            aria-describedby="service-status-confirm-description"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 id="service-status-confirm-title" className="text-lg font-semibold text-slate-900">
              {statusTarget.isActive ? "Deactivate Service?" : "Activate Service?"}
            </h2>
            <p id="service-status-confirm-description" className="mt-2 text-sm text-slate-600">
              {statusTarget.isActive
                ? "This service will no longer be available for new operations."
                : "This service will become available for new operations."}
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
                {statusTarget.isActive ? "Deactivate Service" : "Activate Service"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
