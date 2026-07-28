"use client";

import type { OperationalFilters } from "@/lib/berth-planner/operational-filters";
import { SCHEDULE_STATUSES, hasActiveFilters } from "@/lib/berth-planner/operational-filters";

type Option = { value: string; label: string };

type OperationalFilterBarProps = {
  filters: OperationalFilters;
  searchInput: string;
  serviceOptions: Option[];
  berthOptions: Option[];
  visibleCount: number;
  totalCount: number;
  onSearchInputChange: (value: string) => void;
  onChange: (filters: OperationalFilters) => void;
  onClear: () => void;
};

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full px-1 hover:bg-blue-100" aria-label={`Remove ${label} filter`}>
        ×
      </button>
    </span>
  );
}

export function OperationalFilterBar({
  filters,
  searchInput,
  serviceOptions,
  berthOptions,
  visibleCount,
  totalCount,
  onSearchInputChange,
  onChange,
  onClear,
}: OperationalFilterBarProps) {
  const update = <Key extends keyof OperationalFilters>(key: Key, value: OperationalFilters[Key]) =>
    onChange({ ...filters, [key]: value });
  const serviceLabel = serviceOptions.find((option) => option.value === filters.service)?.label;
  const berthLabel = berthOptions.find((option) => option.value === filters.berthId)?.label;

  return (
    <section aria-label="Planner filters" className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(130px,1fr))_auto]">
        <label className="sr-only" htmlFor="planner-search">Search schedules</label>
        <input
          id="planner-search"
          type="search"
          value={searchInput}
          maxLength={100}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Vessel, voyage or schedule reference"
          className="h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        <select aria-label="Filter by service" value={filters.service} onChange={(event) => update("service", event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
          <option value="">All services</option>
          {serviceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={(event) => update("status", event.target.value as OperationalFilters["status"])} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
          <option value="">All statuses</option>
          {SCHEDULE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select aria-label="Filter by berth" value={filters.berthId} onChange={(event) => update("berthId", event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
          <option value="">All berths</option>
          {berthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 sm:col-span-2 lg:col-span-1">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.conflictsOnly} onChange={(event) => update("conflictsOnly", event.target.checked)} /> Conflicts only</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.invalidOnly} onChange={(event) => update("invalidOnly", event.target.checked)} /> Incomplete / invalid</label>
        </div>
      </div>

      <div className="mt-2 flex min-h-7 flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-slate-600">{visibleCount} of {totalCount} schedules</span>
        {filters.search && <Chip label={`Search: ${filters.search}`} onRemove={() => { onSearchInputChange(""); update("search", ""); }} />}
        {filters.service && <Chip label={`Service: ${serviceLabel ?? filters.service}`} onRemove={() => update("service", "")} />}
        {filters.status && <Chip label={`Status: ${filters.status}`} onRemove={() => update("status", "")} />}
        {filters.berthId && <Chip label={`Berth: ${berthLabel ?? filters.berthId}`} onRemove={() => update("berthId", "")} />}
        {filters.conflictsOnly && <Chip label="Conflicts only" onRemove={() => update("conflictsOnly", false)} />}
        {filters.invalidOnly && <Chip label="Incomplete / invalid" onRemove={() => update("invalidOnly", false)} />}
        {hasActiveFilters(filters) && <button type="button" onClick={onClear} className="ml-auto text-xs font-medium text-blue-700 hover:underline">Clear all filters</button>}
      </div>
    </section>
  );
}
