"use client";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const SCHEDULE_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export type ScheduleFormValues = {
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

export type ScheduleFormVessel = {
  id: string;
  name: string;
  imo: string | null;
  isActive: boolean;
};

export type ScheduleFormService = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type ScheduleFormTerminal = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  port: {
    code: string;
  };
};

export type ScheduleFormBerth = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type ScheduleFormFieldsProps = {
  form: ScheduleFormValues;
  saving: boolean;
  availableVessels: ScheduleFormVessel[];
  availableServices: ScheduleFormService[];
  availableTerminals: ScheduleFormTerminal[];
  formBerths: ScheduleFormBerth[];
  fitError?: string;
  conflictWarning?: string;
  onChange: <K extends keyof ScheduleFormValues>(field: K, value: ScheduleFormValues[K]) => void;
};

function formatStatus(status: ScheduleStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ScheduleFormFields({
  form,
  saving,
  availableVessels,
  availableServices,
  availableTerminals,
  formBerths,
  fitError,
  conflictWarning,
  onChange,
}: ScheduleFormFieldsProps) {
  return (
    <>
      {fitError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fitError}
        </div>
      ) : null}

      {conflictWarning ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠ {conflictWarning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Vessel" htmlFor="schedule-vessel" required>
          <Select
            id="schedule-vessel"
            value={form.vesselId}
            onChange={(event) => onChange("vesselId", event.target.value)}
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
            onChange={(event) => onChange("serviceId", event.target.value)}
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
            onChange={(event) => onChange("voyageNumber", event.target.value)}
            maxLength={50}
            disabled={saving}
          />
        </FormField>

        <FormField label="Terminal" htmlFor="schedule-terminal" required>
          <Select
            id="schedule-terminal"
            value={form.terminalId}
            onChange={(event) => onChange("terminalId", event.target.value)}
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
            onChange={(event) => onChange("berthId", event.target.value)}
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
            onChange={(event) => onChange("eta", event.target.value)}
            required
            disabled={saving}
          />
        </FormField>

        <FormField label="ETB" htmlFor="schedule-etb">
          <Input
            id="schedule-etb"
            type="datetime-local"
            value={form.etb}
            onChange={(event) => onChange("etb", event.target.value)}
            disabled={saving}
          />
        </FormField>

        <FormField label="ETD" htmlFor="schedule-etd" required>
          <Input
            id="schedule-etd"
            type="datetime-local"
            value={form.etd}
            onChange={(event) => onChange("etd", event.target.value)}
            required
            disabled={saving}
          />
        </FormField>

        <FormField label="ATA" htmlFor="schedule-ata">
          <Input
            id="schedule-ata"
            type="datetime-local"
            value={form.ata}
            onChange={(event) => onChange("ata", event.target.value)}
            disabled={saving}
          />
        </FormField>

        <FormField label="ATB" htmlFor="schedule-atb">
          <Input
            id="schedule-atb"
            type="datetime-local"
            value={form.atb}
            onChange={(event) => onChange("atb", event.target.value)}
            disabled={saving}
          />
        </FormField>

        <FormField label="ATD" htmlFor="schedule-atd">
          <Input
            id="schedule-atd"
            type="datetime-local"
            value={form.atd}
            onChange={(event) => onChange("atd", event.target.value)}
            disabled={saving}
          />
        </FormField>

        <FormField label="Status" htmlFor="schedule-status">
          <Select
            id="schedule-status"
            value={form.status}
            onChange={(event) => onChange("status", event.target.value as ScheduleStatus)}
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
            onChange={(event) => onChange("berthPositionMeters", event.target.value)}
            disabled={saving}
          />
        </FormField>

        <FormField label="Remarks" htmlFor="schedule-remarks" className="md:col-span-2">
          <Textarea
            id="schedule-remarks"
            value={form.remarks}
            onChange={(event) => onChange("remarks", event.target.value)}
            rows={3}
            disabled={saving}
          />
        </FormField>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.headingReverse}
              onChange={(event) => onChange("headingReverse", event.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Heading Reverse
          </label>
        </div>
      </div>
    </>
  );
}
