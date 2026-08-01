"use client";

import { useEffect, useState } from "react";
import {
  defaultExportTableConfig,
  validateExportTableConfigInput,
  type ExportTableColumn,
  type ExportTableConfig,
  type ExportColumnWidth,
  type ExportColumnAlign,
} from "@/lib/berth-planner/export-table-config";
import { VESSEL_LABEL_PLACEHOLDER_GROUPS as PLACEHOLDER_GROUPS } from "@/lib/berth-planner/vessel-label";

const WIDTH_OPTIONS: ExportColumnWidth[] = ["AUTO", "COMPACT", "NORMAL", "WIDE"];
const ALIGN_OPTIONS: ExportColumnAlign[] = ["AUTO", "LEFT", "CENTER", "RIGHT"];
const FALLBACK_STORAGE_KEY = "organization-export-table-config-fallback";

// All available column ids from the placeholder groups + composite position
const AVAILABLE_PLACEHOLDERS: Array<{ id: string; placeholder: string; defaultHeading: string }> = [
  { id: "vesselName",       placeholder: "{{vesselName}}",       defaultHeading: "Vessel"    },
  { id: "vesselLoa",        placeholder: "{{vesselLoa}}",        defaultHeading: "LOA (m)"   },
  { id: "voyageNumber",     placeholder: "{{voyageNumber}}",     defaultHeading: "Voyage"    },
  { id: "serviceName",      placeholder: "{{serviceName}}",      defaultHeading: "Service"   },
  { id: "berthName",        placeholder: "{{berthName}}",        defaultHeading: "Berth"     },
  { id: "berthLength",      placeholder: "{{berthLength}}",      defaultHeading: "Berth Len" },
  { id: "position",         placeholder: "{{position}}",         defaultHeading: "Position"  },
  { id: "eta",              placeholder: "{{eta}}",              defaultHeading: "ETA"       },
  { id: "etb",              placeholder: "{{etb}}",              defaultHeading: "ETB"       },
  { id: "etd",              placeholder: "{{etd}}",              defaultHeading: "ETD"       },
  { id: "berthDuration",    placeholder: "{{berthDuration}}",    defaultHeading: "Duration"  },
  { id: "status",           placeholder: "{{status}}",           defaultHeading: "Status"    },
  { id: "remarks",          placeholder: "{{remarks}}",          defaultHeading: "Remarks"   },
  { id: "headingReverse",   placeholder: "{{headingReverse}}",   defaultHeading: "Reversed"  },
  { id: "updatedAt",        placeholder: "{{updatedAt}}",        defaultHeading: "Updated"   },
];

function readFallback(): ExportTableConfig | null {
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const result = validateExportTableConfigInput(parsed);
    return result.ok ? result.config : null;
  } catch { return null; }
}

function writeFallback(config: ExportTableConfig) {
  try { window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

export function OrganizationExportTableSettings() {
  const [config, setConfig] = useState<ExportTableConfig>(defaultExportTableConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/organization/settings/export-table", { cache: "no-store" });
        const payload = await res.json() as { data?: ExportTableConfig; error?: string; warning?: string; persistence?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to load settings");
        if (!mounted) return;
        if (payload.persistence === "local-only") {
          setConfig(readFallback() ?? payload.data ?? defaultExportTableConfig());
          setWarning("Database migration is pending. Changes will be stored locally in this browser for now.");
        } else {
          setConfig(payload.data ?? defaultExportTableConfig());
          setWarning(null);
        }
        setError(null);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function save() {
    setSaving(true); setSuccess(""); setError(null); setWarning(null);
    try {
      const res = await fetch("/api/organization/settings/export-table", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const payload = await res.json() as { data?: ExportTableConfig; error?: string; warning?: string; persistence?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save settings");
      if (payload.data) setConfig(payload.data);
      if (payload.persistence === "local-only") {
        writeFallback(payload.data ?? config);
        setWarning(payload.warning ?? "Saved locally in this browser only.");
      }
      setSuccess("Export table settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function restoreDefault() {
    setConfig(defaultExportTableConfig());
    setSuccess(""); setError(null);
  }

  function updateColumn(index: number, patch: Partial<ExportTableColumn>) {
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) => i === index ? { ...col, ...patch } : col),
    }));
    setSuccess("");
  }

  function moveColumn(index: number, direction: -1 | 1) {
    setConfig((c) => {
      const cols = [...c.columns].sort((a, b) => a.order - b.order);
      const target = index + direction;
      if (target < 0 || target >= cols.length) return c;
      // Swap order values
      const aOrder = cols[index]!.order;
      const bOrder = cols[target]!.order;
      const updated = cols.map((col, i) => {
        if (i === index) return { ...col, order: bOrder };
        if (i === target) return { ...col, order: aOrder };
        return col;
      });
      return { ...c, columns: updated };
    });
    setSuccess("");
  }

  function addColumn(avail: { id: string; placeholder: string; defaultHeading: string }) {
    if (config.columns.some((c) => c.id === avail.id)) return;
    const maxOrder = config.columns.reduce((m, c) => Math.max(m, c.order), 0);
    setConfig((c) => ({
      ...c,
      columns: [...c.columns, {
        id: avail.id,
        placeholder: avail.placeholder,
        heading: avail.defaultHeading,
        visible: true,
        order: maxOrder + 1,
        width: "AUTO",
        align: "AUTO",
      }],
    }));
    setSuccess("");
  }

  function removeColumn(id: string) {
    setConfig((c) => ({ ...c, columns: c.columns.filter((col) => col.id !== id) }));
    setSuccess("");
  }

  const sortedColumns = [...config.columns].sort((a, b) => a.order - b.order);
  const usedIds = new Set(config.columns.map((c) => c.id));
  const addableColumns = AVAILABLE_PLACEHOLDERS.filter((a) => !usedIds.has(a.id));

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading export table settings…</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Export Vessel Table</h2>
          <p className="mt-0.5 text-sm text-slate-500">Configure the vessel-details table appended to printed and PDF exports.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={restoreDefault} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Restore default</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="min-h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {warning && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{warning}</div>}
      {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{success}</div>}

      {/* Include table toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <input
          id="include-table"
          type="checkbox"
          checked={config.includeTable}
          onChange={(e) => { setConfig((c) => ({ ...c, includeTable: e.target.checked })); setSuccess(""); }}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          aria-label="Include vessel table in export"
        />
        <label htmlFor="include-table" className="text-sm font-medium text-slate-800">Include vessel-details table in print / PDF export</label>
      </div>

      {config.includeTable && (
        <>
          {/* Column configuration table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Visible</th>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Heading</th>
                  <th className="px-3 py-2">Width</th>
                  <th className="px-3 py-2">Align</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedColumns.map((col, idx) => (
                  <tr key={col.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 tabular-nums text-slate-500">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveColumn(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Move ${col.heading} up`}
                          className="min-h-7 min-w-7 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >↑</button>
                        <button
                          type="button"
                          onClick={() => moveColumn(idx, 1)}
                          disabled={idx === sortedColumns.length - 1}
                          aria-label={`Move ${col.heading} down`}
                          className="min-h-7 min-w-7 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >↓</button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) => updateColumn(config.columns.findIndex((c) => c.id === col.id), { visible: e.target.checked })}
                        aria-label={`Show ${col.heading} column`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{col.placeholder}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={col.heading}
                        maxLength={60}
                        onChange={(e) => updateColumn(config.columns.findIndex((c) => c.id === col.id), { heading: e.target.value })}
                        aria-label={`Heading for ${col.id} column`}
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={col.width}
                        onChange={(e) => updateColumn(config.columns.findIndex((c) => c.id === col.id), { width: e.target.value as ExportColumnWidth })}
                        aria-label={`Width for ${col.heading} column`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {WIDTH_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={col.align}
                        onChange={(e) => updateColumn(config.columns.findIndex((c) => c.id === col.id), { align: e.target.value as ExportColumnAlign })}
                        aria-label={`Align for ${col.heading} column`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ALIGN_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeColumn(col.id)}
                        aria-label={`Remove ${col.heading} column`}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add column */}
          {addableColumns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs font-medium text-slate-500">Add column:</span>
              {addableColumns.map((avail) => (
                <button
                  key={avail.id}
                  type="button"
                  onClick={() => addColumn(avail)}
                  aria-label={`Add ${avail.defaultHeading} column`}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >+ {avail.defaultHeading}</button>
              ))}
            </div>
          )}

          {/* Live sample preview */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Preview (sample data)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {sortedColumns.filter((c) => c.visible).map((col) => (
                      <th
                        key={col.id}
                        scope="col"
                        className={`px-3 py-2 font-semibold text-slate-700 ${col.align === "RIGHT" ? "text-right" : col.align === "CENTER" ? "text-center" : "text-left"}`}
                      >{col.heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 bg-white">
                    {sortedColumns.filter((c) => c.visible).map((col) => (
                      <td
                        key={col.id}
                        className={`px-3 py-2 text-slate-600 ${col.align === "RIGHT" ? "text-right" : col.align === "CENTER" ? "text-center" : "text-left"}`}
                      >{SAMPLE_ROW[col.id] ?? "—"}</td>
                    ))}
                  </tr>
                  <tr className="bg-slate-50">
                    {sortedColumns.filter((c) => c.visible).map((col) => (
                      <td
                        key={col.id}
                        className={`px-3 py-2 text-slate-500 ${col.align === "RIGHT" ? "text-right" : col.align === "CENTER" ? "text-center" : "text-left"}`}
                      >{SAMPLE_ROW2[col.id] ?? "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Placeholder catalog */}
      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Available placeholders</summary>
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {PLACEHOLDER_GROUPS.map((group) => (
            <div key={group.model}>
              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">{group.model}</p>
              <div className="flex flex-wrap gap-2">
                {group.placeholders.map((p) => (
                  <span key={p.key} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                    <code className="font-mono text-blue-700">{p.key}</code>
                    <span className="text-slate-500">{p.description}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Composite</p>
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
              <code className="font-mono text-blue-700">{"{{position}}"}</code>
              <span className="text-slate-500">positionStart–positionEnd m</span>
            </span>
          </div>
        </div>
      </details>
    </section>
  );
}

const SAMPLE_ROW: Record<string, string> = {
  vesselName: "MV Ocean Star",
  voyageNumber: "AE-091",
  serviceName: "Asia-Europe Loop",
  berthName: "Berth 1",
  position: "50–250 m",
  eta: "08 Aug 10:00",
  etb: "08 Aug 11:00",
  etd: "09 Aug 06:00",
  status: "CONFIRMED",
  remarks: "Awaiting customs clearance",
  vesselLoa: "300",
  berthLength: "400",
  berthZeroOriginSide: "LEFT",
  berthDuration: "20h 0m",
  headingReverse: "false",
  updatedAt: "2026-08-08T10:00:00.000Z",
};

const SAMPLE_ROW2: Record<string, string> = {
  vesselName: "MV Pacific Dawn",
  voyageNumber: "PD-045",
  serviceName: "Pacific Service",
  berthName: "Berth 2",
  position: "100–320 m",
  eta: "09 Aug 02:00",
  etb: "09 Aug 03:30",
  etd: "09 Aug 18:00",
  status: "PLANNED",
  remarks: "—",
  vesselLoa: "220",
  berthLength: "350",
  berthZeroOriginSide: "LEFT",
  berthDuration: "16h 0m",
  headingReverse: "false",
  updatedAt: "2026-08-07T08:00:00.000Z",
};
