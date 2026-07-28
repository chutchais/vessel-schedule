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
import { TableContainer } from "@/components/ui/table-container";
import { Textarea } from "@/components/ui/textarea";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";

const SCHEDULE_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
] as const;

type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

type Vessel = {
  id: string;
  code: string;
  name: string;
  imo: string | null;
  callSign: string | null;
  isActive: boolean;
};

type Terminal = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  port: {
    id: string;
    code: string;
    name: string;
    timezone?: string | null;
  };
};

type Berth = {
  id: string;
  terminalId: string;
  code: string;
  name: string;
  color: string;
  zeroOriginSide: "LEFT" | "RIGHT";
  isActive: boolean;
};

type Service = {
  id: string;
  code: string;
  name: string;
  color: string;
  isActive: boolean;
  company: {
    id: string;
    code: string;
    name: string;
  };
};

type Schedule = {
  id: string;
  vesselId: string;
  terminalId: string;
  berthId: string | null;
  serviceId: string | null;
  voyageNumber: string | null;
  eta: string;
  etb: string | null;
  etd: string;
  ata: string | null;
  atb: string | null;
  atd: string | null;
  status: ScheduleStatus;
  remarks: string | null;
  berthPositionMeters: number | null;
  headingReverse: boolean;
  createdAt: string;
  updatedAt: string;
  vessel: {
    id: string;
    imoNumber: string | null;
    name: string;
    callSign: string | null;
  };
  terminal: {
    id: string;
    code: string;
    name: string;
    port: {
      id: string;
      code: string;
      name: string;
      timezone: string | null;
    };
  };
  berth: {
    id: string;
    code: string;
    name: string;
    color: string;
    zeroOriginSide: "LEFT" | "RIGHT";
  } | null;
  service: Service | null;
};

type ScheduleForm = {
  vesselId: string;
  serviceId: string;
  voyageNumber: string;
  terminalId: string;
  berthId: string;
  eta: string;
  etb: string;
  etd: string;
  ata: string;
  atb: string;
  atd: string;
  status: ScheduleStatus;
  remarks: string;
  berthPositionMeters: string;
  headingReverse: boolean;
};

type SchedulesResponse = {
  data?: Schedule[];
  error?: string;
};

type SchedulesSingleResponse = {
  data?: Schedule;
  error?: string;
};

type VesselsResponse = {
  data?: Vessel[];
  error?: string;
};

type TerminalsResponse = {
  data?: Terminal[];
  error?: string;
};

type BerthsResponse = {
  data?: Berth[];
  error?: string;
};

type ServicesResponse = {
  data?: Service[];
  error?: string;
};

const INITIAL_FORM: ScheduleForm = {
  vesselId: "",
  serviceId: "",
  voyageNumber: "",
  terminalId: "",
  berthId: "",
  eta: "",
  etb: "",
  etd: "",
  ata: "",
  atb: "",
  atd: "",
  status: "PLANNED",
  remarks: "",
  berthPositionMeters: "",
  headingReverse: false,
};

function formatStatus(status: ScheduleStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toDateTimeLocalValue(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIsoUtc(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatDateInTimezone(iso: string | null, timezone?: string | null) {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  if (timezone) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone: timezone,
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    }
  }

  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function statusBadgeClass(status: ScheduleStatus) {
  if (status === "PLANNED") return "bg-blue-100 text-blue-700";
  if (status === "CONFIRMED") return "bg-indigo-100 text-indigo-700";
  if (status === "ARRIVED") return "bg-amber-100 text-amber-700";
  if (status === "BERTHED") return "bg-purple-100 text-purple-700";
  if (status === "DEPARTED") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function formatScheduleHistoryLabel(schedule: Schedule): string {
  const serviceCode = schedule.service?.code ?? "—";
  const voyageNumber = schedule.voyageNumber || "—";
  return `${schedule.vessel.name} · ${serviceCode} · ${voyageNumber}`;
}

export function ScheduleManager() {
  const isMountedRef = useRef(true);
  const canViewAuditLogs = useCanViewAuditLogs();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [form, setForm] = useState<ScheduleForm>(INITIAL_FORM);
  const [initialFormState, setInitialFormState] = useState<ScheduleForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [terminalFilter, setTerminalFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSchedulesOnly = useCallback(async () => {
    try {
      const response = await fetch("/api/schedules", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as SchedulesResponse;
      if (!response.ok) {
        throw new Error(result.error || "Failed to load schedules");
      }

      if (isMountedRef.current) {
        setSchedules(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to load schedules");
      }
    }
  }, []);

  const loadAllData = useCallback(async () => {
    if (isMountedRef.current) {
      setLoading(true);
      setPageError("");
    }

    try {
      const [schedulesResponse, vesselsResponse, terminalsResponse, berthsResponse, servicesResponse] =
        await Promise.all([
          fetch("/api/schedules", { method: "GET", cache: "no-store" }),
          fetch("/api/vessels", { method: "GET", cache: "no-store" }),
          fetch("/api/terminals", { method: "GET", cache: "no-store" }),
          fetch("/api/berths", { method: "GET", cache: "no-store" }),
          fetch("/api/services", { method: "GET", cache: "no-store" }),
        ]);

      const schedulesResult = (await schedulesResponse.json()) as SchedulesResponse;
      const vesselsResult = (await vesselsResponse.json()) as VesselsResponse;
      const terminalsResult = (await terminalsResponse.json()) as TerminalsResponse;
      const berthsResult = (await berthsResponse.json()) as BerthsResponse;
      const servicesResult = (await servicesResponse.json()) as ServicesResponse;

      if (!schedulesResponse.ok) throw new Error(schedulesResult.error || "Failed to load schedules");
      if (!vesselsResponse.ok) throw new Error(vesselsResult.error || "Failed to load vessels");
      if (!terminalsResponse.ok) throw new Error(terminalsResult.error || "Failed to load terminals");
      if (!berthsResponse.ok) throw new Error(berthsResult.error || "Failed to load berths");
      if (!servicesResponse.ok) throw new Error(servicesResult.error || "Failed to load services");

      if (isMountedRef.current) {
        setSchedules(Array.isArray(schedulesResult.data) ? schedulesResult.data : []);
        setVessels(Array.isArray(vesselsResult.data) ? vesselsResult.data : []);
        setTerminals(Array.isArray(terminalsResult.data) ? terminalsResult.data : []);
        setBerths(Array.isArray(berthsResult.data) ? berthsResult.data : []);
        setServices(Array.isArray(servicesResult.data) ? servicesResult.data : []);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setPageError(error instanceof Error ? error.message : "Failed to load schedule data");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAllData();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadAllData]);

  const availableVessels = useMemo(() => {
    return vessels.filter((vessel) => vessel.isActive || (editingId !== null && form.vesselId === vessel.id));
  }, [editingId, form.vesselId, vessels]);

  const availableTerminals = useMemo(() => {
    return terminals.filter((terminal) => terminal.isActive || (editingId !== null && form.terminalId === terminal.id));
  }, [editingId, form.terminalId, terminals]);

  const availableBerths = useMemo(() => {
    return berths.filter((berth) => berth.isActive || (editingId !== null && form.berthId === berth.id));
  }, [berths, editingId, form.berthId]);

  const availableServices = useMemo(() => {
    return services.filter((service) => service.isActive || (editingId !== null && form.serviceId === service.id));
  }, [editingId, form.serviceId, services]);

  const formBerths = useMemo(() => {
    return availableBerths.filter((berth) => berth.terminalId === form.terminalId);
  }, [availableBerths, form.terminalId]);

  const filteredSchedules = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return schedules.filter((schedule) => {
      const matchesSearch =
        !searchText ||
        schedule.vessel.name.toLowerCase().includes(searchText) ||
        (schedule.vessel.imoNumber || "").toLowerCase().includes(searchText) ||
        (schedule.voyageNumber || "").toLowerCase().includes(searchText) ||
        (schedule.service?.code || "").toLowerCase().includes(searchText) ||
        (schedule.service?.name || "").toLowerCase().includes(searchText) ||
        (schedule.service?.company.code || "").toLowerCase().includes(searchText) ||
        (schedule.service?.company.name || "").toLowerCase().includes(searchText) ||
        schedule.terminal.code.toLowerCase().includes(searchText) ||
        schedule.terminal.name.toLowerCase().includes(searchText) ||
        schedule.terminal.port.code.toLowerCase().includes(searchText) ||
        schedule.terminal.port.name.toLowerCase().includes(searchText) ||
        (schedule.berth?.code || "").toLowerCase().includes(searchText) ||
        (schedule.berth?.name || "").toLowerCase().includes(searchText);

      const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;
      const matchesTerminal = terminalFilter === "all" || schedule.terminalId === terminalFilter;

      const etaDate = new Date(schedule.eta);
      const matchesDateFrom = dateFrom ? etaDate >= new Date(`${dateFrom}T00:00:00`) : true;
      const matchesDateTo = dateTo ? etaDate <= new Date(`${dateTo}T23:59:59.999`) : true;

      return matchesSearch && matchesStatus && matchesTerminal && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, schedules, search, statusFilter, terminalFilter]);

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || terminalFilter !== "all" || dateFrom !== "" || dateTo !== "";
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialFormState);

  function updateForm<Field extends keyof ScheduleForm>(field: Field, value: ScheduleForm[Field]) {
    if (field === "terminalId") {
      setForm((current) => {
        const hasBerthForTerminal = berths.some(
          (berth) => berth.id === current.berthId && berth.terminalId === value,
        );

        return {
          ...current,
          terminalId: value as string,
          berthId: hasBerthForTerminal ? current.berthId : "",
        };
      });
      return;
    }

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
    setForm(INITIAL_FORM);
    setInitialFormState(INITIAL_FORM);
    setEditingId(null);
    setDrawerError("");
    setPageError("");
    setSuccess("");
    setShowDiscardChanges(false);
    setIsDrawerOpen(true);
  }

  function startEdit(schedule: Schedule) {
    const editForm: ScheduleForm = {
      vesselId: schedule.vesselId,
      serviceId: schedule.serviceId || "",
      voyageNumber: schedule.voyageNumber || "",
      terminalId: schedule.terminalId,
      berthId: schedule.berthId || "",
      eta: toDateTimeLocalValue(schedule.eta),
      etb: toDateTimeLocalValue(schedule.etb),
      etd: toDateTimeLocalValue(schedule.etd),
      ata: toDateTimeLocalValue(schedule.ata),
      atb: toDateTimeLocalValue(schedule.atb),
      atd: toDateTimeLocalValue(schedule.atd),
      status: schedule.status,
      remarks: schedule.remarks || "",
      berthPositionMeters: schedule.berthPositionMeters?.toString() || "",
      headingReverse: schedule.headingReverse,
    };

    setEditingId(schedule.id);
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
    setTerminalFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDrawerError("");
    setSuccess("");

    const etaIso = toIsoUtc(form.eta);
    const etdIso = toIsoUtc(form.etd);
    const etbIso = toIsoUtc(form.etb);
    const ataIso = toIsoUtc(form.ata);
    const atbIso = toIsoUtc(form.atb);
    const atdIso = toIsoUtc(form.atd);

    if (!etaIso) {
      setDrawerError("ETA is required and must be valid");
      return;
    }

    if (!etdIso) {
      setDrawerError("ETD is required and must be valid");
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/schedules/${editingId}` : "/api/schedules", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vesselId: form.vesselId,
          serviceId: form.serviceId,
          voyageNumber: form.voyageNumber,
          terminalId: form.terminalId,
          berthId: form.berthId,
          eta: etaIso,
          etb: etbIso ?? "",
          etd: etdIso,
          ata: ataIso ?? "",
          atb: atbIso ?? "",
          atd: atdIso ?? "",
          status: form.status,
          remarks: form.remarks,
          berthPositionMeters: form.berthPositionMeters,
          headingReverse: form.headingReverse,
        }),
      });

      const result = (await response.json()) as SchedulesSingleResponse;
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingId ? "update" : "create"} schedule`);
      }

      await loadSchedulesOnly();

      if (isMountedRef.current) {
        closeDrawerImmediately();
        setSuccess(editingId ? "Schedule updated successfully." : "Schedule created successfully.");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDrawerError(error instanceof Error ? error.message : "Failed to save schedule");
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  return (
    <section>
      <PageHeader
        title="Vessel Schedule Management"
        description="Create and edit vessel schedules by terminal and berth"
        actions={<Button onClick={openCreateDrawer}>Add Schedule</Button>}
      />

      {success ? <AlertMessage type="success" message={success} className="mb-4" /> : null}
      {pageError ? <AlertMessage type="error" message={pageError} className="mb-4" /> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <FormField label="Search" htmlFor="schedule-search" className="md:col-span-2">
            <Input
              id="schedule-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Vessel, voyage, terminal, berth"
            />
          </FormField>

          <FormField label="Status" htmlFor="schedule-status-filter">
            <Select id="schedule-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {SCHEDULE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Terminal" htmlFor="schedule-terminal-filter">
            <Select id="schedule-terminal-filter" value={terminalFilter} onChange={(event) => setTerminalFilter(event.target.value)}>
              <option value="all">All</option>
              {terminals.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminal.port.code}/{terminal.code}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Date From" htmlFor="schedule-date-from">
            <Input id="schedule-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </FormField>

          <FormField label="Date To" htmlFor="schedule-date-to">
            <Input id="schedule-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </FormField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Showing {filteredSchedules.length} of {schedules.length} schedules
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <TableContainer footer={`${filteredSchedules.length} ${filteredSchedules.length === 1 ? "schedule" : "schedules"}`}>
        {loading ? (
          <LoadingState message="Loading schedules..." />
        ) : filteredSchedules.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No schedules found" description="Try adjusting your search or filter settings." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Vessel</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">IMO Number</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Voyage</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Service</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Port</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Terminal</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Berth</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">ETA</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">ETB</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">ETD</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{schedule.vessel.name}</td>
                    <td className="px-4 py-3 text-slate-700">{schedule.vessel.imoNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{schedule.voyageNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {schedule.service ? `${schedule.service.code} - ${schedule.service.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {schedule.terminal.port.code} - {schedule.terminal.port.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {schedule.terminal.code} - {schedule.terminal.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {schedule.berth ? `${schedule.berth.code} - ${schedule.berth.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateInTimezone(schedule.eta, schedule.terminal.port.timezone)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateInTimezone(schedule.etb, schedule.terminal.port.timezone)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateInTimezone(schedule.etd, schedule.terminal.port.timezone)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(schedule.status)}`}>
                        {formatStatus(schedule.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => startEdit(schedule)}>
                          Edit
                        </Button>
                        {canViewAuditLogs ? (
                          <HistoryLink
                            entityType={AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE}
                            entityId={schedule.id}
                            entityLabel={formatScheduleHistoryLabel(schedule)}
                          />
                        ) : null}
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
        title={editingId ? "Edit Schedule" : "Create Schedule"}
        description="Add or update vessel schedules."
        onRequestClose={requestCloseDrawer}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="schedule-form" disabled={saving}>
              {saving ? (editingId ? "Updating..." : "Creating...") : editingId ? "Update Schedule" : "Create Schedule"}
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

        <form id="schedule-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Vessel" htmlFor="schedule-vessel" required>
              <Select
                id="schedule-vessel"
                value={form.vesselId}
                onChange={(event) => updateForm("vesselId", event.target.value)}
                required
                disabled={saving}
              >
                <option value="">Select Vessel</option>
                {availableVessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}
                    {vessel.imo ? ` (${vessel.imo})` : ""}
                    {!vessel.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Service" htmlFor="schedule-service">
              <Select
                id="schedule-service"
                value={form.serviceId}
                onChange={(event) => updateForm("serviceId", event.target.value)}
                disabled={saving}
              >
                <option value="">No Service</option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.code} - {service.name}
                    {!service.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Voyage Number" htmlFor="schedule-voyage">
              <Input
                id="schedule-voyage"
                value={form.voyageNumber}
                onChange={(event) => updateForm("voyageNumber", event.target.value)}
                maxLength={50}
                disabled={saving}
              />
            </FormField>

            <FormField label="Terminal" htmlFor="schedule-terminal" required>
              <Select
                id="schedule-terminal"
                value={form.terminalId}
                onChange={(event) => updateForm("terminalId", event.target.value)}
                required
                disabled={saving}
              >
                <option value="">Select Terminal</option>
                {availableTerminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.port.code}/{terminal.code} - {terminal.name}
                    {!terminal.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Berth" htmlFor="schedule-berth">
              <Select
                id="schedule-berth"
                value={form.berthId}
                onChange={(event) => updateForm("berthId", event.target.value)}
                disabled={saving || !form.terminalId}
              >
                <option value="">{form.terminalId ? "No Berth" : "Select Terminal First"}</option>
                {formBerths.map((berth) => (
                  <option key={berth.id} value={berth.id}>
                    {berth.code} - {berth.name}
                    {!berth.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="ETA" htmlFor="schedule-eta" required>
              <Input
                id="schedule-eta"
                type="datetime-local"
                value={form.eta}
                onChange={(event) => updateForm("eta", event.target.value)}
                required
                disabled={saving}
              />
            </FormField>

            <FormField label="ETB" htmlFor="schedule-etb">
              <Input
                id="schedule-etb"
                type="datetime-local"
                value={form.etb}
                onChange={(event) => updateForm("etb", event.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="ETD" htmlFor="schedule-etd" required>
              <Input
                id="schedule-etd"
                type="datetime-local"
                value={form.etd}
                onChange={(event) => updateForm("etd", event.target.value)}
                required
                disabled={saving}
              />
            </FormField>

            <FormField label="ATA" htmlFor="schedule-ata">
              <Input
                id="schedule-ata"
                type="datetime-local"
                value={form.ata}
                onChange={(event) => updateForm("ata", event.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="ATB" htmlFor="schedule-atb">
              <Input
                id="schedule-atb"
                type="datetime-local"
                value={form.atb}
                onChange={(event) => updateForm("atb", event.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="ATD" htmlFor="schedule-atd">
              <Input
                id="schedule-atd"
                type="datetime-local"
                value={form.atd}
                onChange={(event) => updateForm("atd", event.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="Status" htmlFor="schedule-status">
              <Select
                id="schedule-status"
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value as ScheduleStatus)}
                disabled={saving}
              >
                {SCHEDULE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Berth Position (meters)" htmlFor="schedule-berth-position">
              <Input
                id="schedule-berth-position"
                type="number"
                min="0"
                step="1"
                value={form.berthPositionMeters}
                onChange={(event) => updateForm("berthPositionMeters", event.target.value)}
                disabled={saving}
              />
            </FormField>

            <FormField label="Remarks" htmlFor="schedule-remarks" className="md:col-span-2">
              <Textarea
                id="schedule-remarks"
                value={form.remarks}
                onChange={(event) => updateForm("remarks", event.target.value)}
                rows={3}
                disabled={saving}
              />
            </FormField>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.headingReverse}
                  onChange={(event) => updateForm("headingReverse", event.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Heading Reverse
              </label>
            </div>
          </div>
        </form>
      </Drawer>
    </section>
  );
}
