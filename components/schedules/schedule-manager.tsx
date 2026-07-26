"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type Schedule = {
  id: string;
  vesselId: string;
  terminalId: string;
  berthId: string | null;
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
};

type ScheduleForm = {
  vesselId: string;
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

const initialForm: ScheduleForm = {
  vesselId: "",
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

function formatDateInTimezone(
  iso: string | null,
  timezone?: string | null,
) {
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
      return new Intl.DateTimeFormat(
        undefined,
        options,
      ).format(date);
    }
  }

  return new Intl.DateTimeFormat(undefined, options).format(
    date,
  );
}

function statusBadgeClass(status: ScheduleStatus) {
  if (status === "PLANNED") {
    return "bg-blue-100 text-blue-700";
  }
  if (status === "CONFIRMED") {
    return "bg-indigo-100 text-indigo-700";
  }
  if (status === "ARRIVED") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "BERTHED") {
    return "bg-purple-100 text-purple-700";
  }
  if (status === "DEPARTED") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-gray-100 text-gray-700";
}

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);

  const [form, setForm] = useState<ScheduleForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [terminalFilter, setTerminalFilter] =
    useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSchedulesOnly() {
    try {
      const response = await fetch("/api/schedules", {
        method: "GET",
        cache: "no-store",
      });

      const result =
        (await response.json()) as SchedulesResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load schedules",
        );
      }

      setSchedules(
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load schedules",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [
          schedulesResponse,
          vesselsResponse,
          terminalsResponse,
          berthsResponse,
        ] = await Promise.all([
          fetch("/api/schedules", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/vessels", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/terminals", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/berths", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        const schedulesResult =
          (await schedulesResponse.json()) as SchedulesResponse;
        const vesselsResult =
          (await vesselsResponse.json()) as VesselsResponse;
        const terminalsResult =
          (await terminalsResponse.json()) as TerminalsResponse;
        const berthsResult =
          (await berthsResponse.json()) as BerthsResponse;

        if (!schedulesResponse.ok) {
          throw new Error(
            schedulesResult.error ||
              "Failed to load schedules",
          );
        }

        if (!vesselsResponse.ok) {
          throw new Error(
            vesselsResult.error || "Failed to load vessels",
          );
        }

        if (!terminalsResponse.ok) {
          throw new Error(
            terminalsResult.error ||
              "Failed to load terminals",
          );
        }

        if (!berthsResponse.ok) {
          throw new Error(
            berthsResult.error || "Failed to load berths",
          );
        }

        if (!cancelled) {
          setSchedules(
            Array.isArray(schedulesResult.data)
              ? schedulesResult.data
              : [],
          );
          setVessels(
            Array.isArray(vesselsResult.data)
              ? vesselsResult.data
              : [],
          );
          setTerminals(
            Array.isArray(terminalsResult.data)
              ? terminalsResult.data
              : [],
          );
          setBerths(
            Array.isArray(berthsResult.data)
              ? berthsResult.data
              : [],
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load schedule data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableVessels = useMemo(() => {
    return vessels.filter((vessel) => {
      if (vessel.isActive) {
        return true;
      }

      return (
        editingId !== null && form.vesselId === vessel.id
      );
    });
  }, [vessels, editingId, form.vesselId]);

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

  const availableBerths = useMemo(() => {
    return berths.filter((berth) => {
      if (berth.isActive) {
        return true;
      }

      return (
        editingId !== null && form.berthId === berth.id
      );
    });
  }, [berths, editingId, form.berthId]);

  const formBerths = useMemo(() => {
    return availableBerths.filter(
      (berth) => berth.terminalId === form.terminalId,
    );
  }, [availableBerths, form.terminalId]);

  const filteredSchedules = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return schedules.filter((schedule) => {
      const matchesSearch =
        !searchText ||
        schedule.vessel.name
          .toLowerCase()
          .includes(searchText) ||
        (schedule.vessel.imoNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        (schedule.voyageNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        schedule.terminal.code
          .toLowerCase()
          .includes(searchText) ||
        schedule.terminal.name
          .toLowerCase()
          .includes(searchText) ||
        schedule.terminal.port.code
          .toLowerCase()
          .includes(searchText) ||
        schedule.terminal.port.name
          .toLowerCase()
          .includes(searchText) ||
        (schedule.berth?.code || "")
          .toLowerCase()
          .includes(searchText) ||
        (schedule.berth?.name || "")
          .toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        schedule.status === statusFilter;

      const matchesTerminal =
        terminalFilter === "all" ||
        schedule.terminalId === terminalFilter;

      const etaDate = new Date(schedule.eta);
      const matchesDateFrom = dateFrom
        ? etaDate >= new Date(`${dateFrom}T00:00:00`)
        : true;
      const matchesDateTo = dateTo
        ? etaDate <= new Date(`${dateTo}T23:59:59.999`)
        : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesTerminal &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    schedules,
    search,
    statusFilter,
    terminalFilter,
    dateFrom,
    dateTo,
  ]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setTerminalFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function updateForm<Field extends keyof ScheduleForm>(
    field: Field,
    value: ScheduleForm[Field],
  ) {
    if (field === "terminalId") {
      const hasBerthForTerminal = berths.some(
        (berth) =>
          berth.id === form.berthId &&
          berth.terminalId === value,
      );

      setForm((current) => ({
        ...current,
        terminalId: value as string,
        berthId: hasBerthForTerminal
          ? current.berthId
          : "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setForm({
      vesselId: schedule.vesselId,
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
      berthPositionMeters:
        schedule.berthPositionMeters?.toString() || "",
      headingReverse: schedule.headingReverse,
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
    setError("");
    setSuccess("");

    const etaIso = toIsoUtc(form.eta);
    const etdIso = toIsoUtc(form.etd);
    const etbIso = toIsoUtc(form.etb);
    const ataIso = toIsoUtc(form.ata);
    const atbIso = toIsoUtc(form.atb);
    const atdIso = toIsoUtc(form.atd);

    if (!etaIso) {
      setError("ETA is required and must be valid");
      return;
    }

    if (!etdIso) {
      setError("ETD is required and must be valid");
      return;
    }

    setSaving(true);
    setSavingLabel(
      editingId ? "Updating..." : "Creating...",
    );

    try {
      const response = await fetch(
        editingId
          ? `/api/schedules/${editingId}`
          : "/api/schedules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vesselId: form.vesselId,
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
            berthPositionMeters:
              form.berthPositionMeters,
            headingReverse: form.headingReverse,
          }),
        },
      );

      const result =
        (await response.json()) as SchedulesSingleResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to ${
              editingId ? "update" : "create"
            } schedule`,
        );
      }

      setSuccess(
        editingId
          ? "Schedule updated successfully"
          : "Schedule created successfully",
      );
      resetForm();
      await loadSchedulesOnly();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save schedule",
      );
    } finally {
      setSaving(false);
      setSavingLabel("");
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <section>
        <h1 className="text-3xl font-bold">
          Vessel Schedule Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Create and edit vessel schedules by terminal and
          berth.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId
                ? "Edit Schedule"
                : "Create Schedule"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingId
                ? "Update the selected schedule."
                : "Add a new vessel schedule."}
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
              htmlFor="vesselId"
              className="mb-1 block text-sm font-medium"
            >
              Vessel
            </label>
            <select
              id="vesselId"
              value={form.vesselId}
              onChange={(event) =>
                updateForm("vesselId", event.target.value)
              }
              required
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">Select Vessel</option>
              {availableVessels.map((vessel) => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.name}
                  {vessel.imo ? ` (${vessel.imo})` : ""}
                  {!vessel.isActive
                    ? " (Inactive)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="voyageNumber"
              className="mb-1 block text-sm font-medium"
            >
              Voyage Number
            </label>
            <input
              id="voyageNumber"
              type="text"
              value={form.voyageNumber}
              onChange={(event) =>
                updateForm(
                  "voyageNumber",
                  event.target.value,
                )
              }
              maxLength={50}
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

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
              required
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">Select Terminal</option>
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
              htmlFor="berthId"
              className="mb-1 block text-sm font-medium"
            >
              Berth
            </label>
            <select
              id="berthId"
              value={form.berthId}
              onChange={(event) =>
                updateForm("berthId", event.target.value)
              }
              disabled={saving || !form.terminalId}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">
                {form.terminalId
                  ? "No Berth"
                  : "Select Terminal First"}
              </option>
              {formBerths.map((berth) => (
                <option key={berth.id} value={berth.id}>
                  {berth.code} - {berth.name}
                  {!berth.isActive
                    ? " (Inactive)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="eta"
              className="mb-1 block text-sm font-medium"
            >
              ETA
            </label>
            <input
              id="eta"
              type="datetime-local"
              value={form.eta}
              onChange={(event) =>
                updateForm("eta", event.target.value)
              }
              required
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="etb"
              className="mb-1 block text-sm font-medium"
            >
              ETB
            </label>
            <input
              id="etb"
              type="datetime-local"
              value={form.etb}
              onChange={(event) =>
                updateForm("etb", event.target.value)
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="etd"
              className="mb-1 block text-sm font-medium"
            >
              ETD
            </label>
            <input
              id="etd"
              type="datetime-local"
              value={form.etd}
              onChange={(event) =>
                updateForm("etd", event.target.value)
              }
              required
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="ata"
              className="mb-1 block text-sm font-medium"
            >
              ATA
            </label>
            <input
              id="ata"
              type="datetime-local"
              value={form.ata}
              onChange={(event) =>
                updateForm("ata", event.target.value)
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="atb"
              className="mb-1 block text-sm font-medium"
            >
              ATB
            </label>
            <input
              id="atb"
              type="datetime-local"
              value={form.atb}
              onChange={(event) =>
                updateForm("atb", event.target.value)
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="atd"
              className="mb-1 block text-sm font-medium"
            >
              ATD
            </label>
            <input
              id="atd"
              type="datetime-local"
              value={form.atd}
              onChange={(event) =>
                updateForm("atd", event.target.value)
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-sm font-medium"
            >
              Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(event) =>
                updateForm(
                  "status",
                  event.target.value as ScheduleStatus,
                )
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            >
              {SCHEDULE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="remarks"
              className="mb-1 block text-sm font-medium"
            >
              Remarks
            </label>
            <textarea
              id="remarks"
              value={form.remarks}
              onChange={(event) =>
                updateForm("remarks", event.target.value)
              }
              rows={3}
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="berthPositionMeters"
              className="mb-1 block text-sm font-medium"
            >
              Berth Position (meters)
            </label>
            <input
              id="berthPositionMeters"
              type="number"
              min="0"
              step="1"
              value={form.berthPositionMeters}
              onChange={(event) =>
                updateForm(
                  "berthPositionMeters",
                  event.target.value,
                )
              }
              disabled={saving}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input
                type="checkbox"
                checked={form.headingReverse}
                onChange={(event) =>
                  updateForm(
                    "headingReverse",
                    event.target.checked,
                  )
                }
                disabled={saving}
              />
              <span className="text-sm font-medium">
                Heading Reverse
              </span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? savingLabel
                : editingId
                  ? "Update Schedule"
                  : "Create Schedule"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Schedules
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {filteredSchedules.length} schedule
                {filteredSchedules.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
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
                placeholder="Vessel, voyage, terminal, berth"
                className="w-full rounded-md border px-3 py-2"
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
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="all">All</option>
                {SCHEDULE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="terminalFilter"
                className="mb-1 block text-sm font-medium"
              >
                Terminal
              </label>
              <select
                id="terminalFilter"
                value={terminalFilter}
                onChange={(event) =>
                  setTerminalFilter(
                    event.target.value,
                  )
                }
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="all">All</option>
                {terminals.map((terminal) => (
                  <option
                    key={terminal.id}
                    value={terminal.id}
                  >
                    {terminal.port.code}/{terminal.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dateFrom"
                className="mb-1 block text-sm font-medium"
              >
                Date From
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="dateTo"
                className="mb-1 block text-sm font-medium"
              >
                Date To
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Loading schedules...
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-gray-500">
            No schedules found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 font-semibold">
                    Vessel
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    IMO Number
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Voyage
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Port
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Terminal
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Berth
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    ETA
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    ETB
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    ETD
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
                {filteredSchedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {schedule.vessel.name}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.vessel.imoNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.voyageNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.terminal.port.code} -{" "}
                      {schedule.terminal.port.name}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.terminal.code} -{" "}
                      {schedule.terminal.name}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.berth
                        ? `${schedule.berth.code} - ${schedule.berth.name}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateInTimezone(
                        schedule.eta,
                        schedule.terminal.port.timezone,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateInTimezone(
                        schedule.etb,
                        schedule.terminal.port.timezone,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateInTimezone(
                        schedule.etd,
                        schedule.terminal.port.timezone,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                          schedule.status,
                        )}`}
                      >
                        {formatStatus(schedule.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(schedule)
                        }
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      >
                        Edit
                      </button>
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
