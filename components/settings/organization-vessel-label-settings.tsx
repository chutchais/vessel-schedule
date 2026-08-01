"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getVesselPolygon } from "@/lib/berth-planner/geometry";
import {
  defaultVesselLabelConfig,
  drawVesselLabelLines,
  VESSEL_LABEL_PLACEHOLDER_GROUPS,
  type VesselLabelConfig,
  type VesselLabelFontSize,
  type VesselLabelFontWeight,
  type VesselLabelLine,
  type VesselLabelTextAlign,
  type VesselLabelTextColor,
} from "@/lib/berth-planner/vessel-label";

const MAX_LINES = 6;
const FONT_WEIGHT_OPTIONS: VesselLabelFontWeight[] = ["REGULAR", "BOLD"];
const FONT_SIZE_OPTIONS: VesselLabelFontSize[] = ["AUTO", "SMALL", "NORMAL", "BIG", "BIGGER"];
const TEXT_ALIGN_OPTIONS: VesselLabelTextAlign[] = ["LEFT", "CENTER", "RIGHT"];
const TEXT_COLOR_OPTIONS: VesselLabelTextColor[] = ["AUTO", "LIGHT", "DARK"];
const FALLBACK_STORAGE_KEY = "organization-vessel-label-config-fallback";
function createLine(index: number): VesselLabelLine {
  return {
    template: index === 0 ? "{{vesselName}}" : "",
    fontWeight: index === 0 ? "BOLD" : "REGULAR",
    fontSize: "AUTO",
    textAlign: "CENTER",
    textColor: "AUTO",
  };
}

export function OrganizationVesselLabelSettings() {
  const [config, setConfig] = useState<VesselLabelConfig>(defaultVesselLabelConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function readFallbackConfig(): VesselLabelConfig | null {
    try {
      const value = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (!value) return null;
      const parsed = JSON.parse(value) as unknown;
      if (
        typeof parsed === "object"
        && parsed !== null
        && "schemaVersion" in parsed
        && "lines" in parsed
      ) {
        return parsed as VesselLabelConfig;
      }
      return null;
    } catch {
      return null;
    }
  }

  function writeFallbackConfig(nextConfig: VesselLabelConfig) {
    try {
      window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(nextConfig));
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/organization/settings/vessel-label", { cache: "no-store" });
        const payload = await response.json() as {
          data?: VesselLabelConfig;
          error?: string;
          warning?: string;
          persistence?: "database" | "local-only";
        };
        if (!response.ok) throw new Error(payload.error ?? "Failed to load settings");
        if (!mounted) return;
        if (payload.persistence === "local-only") {
          const fallback = readFallbackConfig();
          setConfig(fallback ?? payload.data ?? defaultVesselLabelConfig());
          setWarning("Database migration is pending. Changes will be stored locally in this browser for now.");
        } else if (payload.data) {
          setConfig(payload.data);
          setWarning(null);
        }
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const canAddLine = config.lines.length < MAX_LINES;
  const normalizedConfig = useMemo(() => {
    const lines = config.lines.length > 0 ? config.lines : [createLine(0)];
    return { ...config, lines };
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 680;
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const polygon = getVesselPolygon(80, 620, 20, 160);
    ctx.beginPath();
    ctx.moveTo(...polygon[0]!);
    for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(...polygon[index]!);
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,246,0.35)";
    ctx.strokeStyle = "rgb(59,130,246)";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    drawVesselLabelLines({
      ctx,
      polygon,
      bounds: { left: 80, right: 620, top: 20, bottom: 160 },
      config: normalizedConfig,
      context: {
        vesselName: "MV Ocean Star",
        serviceName: "Asia-Europe Loop",
        voyageNumber: "AE-091",
        berthName: "Berth 1",
        remarks: "Awaiting customs clearance",
        eta: new Date("2026-08-01T03:00:00.000Z"),
        etd: new Date("2026-08-01T12:30:00.000Z"),
        timezone: "UTC",
      },
      backgroundRgb: [186, 211, 243],
      minFontSize: 8,
      maxFontSize: 13,
      smallFontSize: 8.5,
      normalFontSize: 10,
      bigFontSize: 11,
      biggerFontSize: 12,
      lineGap: 1.5,
      horizontalPadding: 3,
      verticalPadding: 2,
    });
  }, [normalizedConfig]);

  function updateLine(index: number, patch: Partial<VesselLabelLine>) {
    setConfig((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
    setSuccess("");
    setError(null);
  }

  function addLine() {
    if (!canAddLine) return;
    setConfig((current) => ({
      ...current,
      lines: [...current.lines, createLine(current.lines.length)],
    }));
    setSuccess("");
    setError(null);
  }

  function removeLine(index: number) {
    setConfig((current) => {
      const lines = current.lines.filter((_, lineIndex) => lineIndex !== index);
      return { ...current, lines: lines.length > 0 ? lines : [createLine(0)] };
    });
    setSuccess("");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setSuccess("");
    setError(null);
    setWarning(null);
    try {
      const response = await fetch("/api/organization/settings/vessel-label", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: normalizedConfig }),
      });
      const payload = await response.json() as {
        data?: VesselLabelConfig;
        error?: string;
        warning?: string;
        persistence?: "database" | "local-only";
      };
      if (!response.ok) throw new Error(payload.error ?? "Failed to save settings");
      if (payload.persistence === "local-only") {
        writeFallbackConfig(normalizedConfig);
        if (payload.data) setConfig(payload.data);
        setWarning(payload.warning ?? "Database migration is pending. Changes were stored locally in this browser.");
        setSuccess("Vessel label settings saved locally.");
      } else {
        if (payload.data) setConfig(payload.data);
        setSuccess("Vessel label settings saved.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading organization settings...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure structured vessel labels for planner views and weekly export.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Vessel label lines</h2>
        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Model</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Columns / placeholders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {VESSEL_LABEL_PLACEHOLDER_GROUPS.map((group) => (
                <tr key={group.model}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{group.model}</td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="space-y-1">
                      {group.placeholders.map((item) => (
                        <div key={item.key} className="flex flex-wrap items-center gap-2">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-900">{item.key}</code>
                          <span>{item.description}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3">
          {normalizedConfig.lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-md border border-slate-200 p-3 lg:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))_auto]">
              <input
                value={line.template}
                onChange={(event) => updateLine(index, { template: event.target.value })}
                placeholder="Template"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={line.fontWeight}
                onChange={(event) => updateLine(index, { fontWeight: event.target.value as VesselLabelFontWeight })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {FONT_WEIGHT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                value={line.fontSize}
                onChange={(event) => updateLine(index, { fontSize: event.target.value as VesselLabelFontSize })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {FONT_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                value={line.textAlign}
                onChange={(event) => updateLine(index, { textAlign: event.target.value as VesselLabelTextAlign })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TEXT_ALIGN_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                value={line.textColor}
                onChange={(event) => updateLine(index, { textColor: event.target.value as VesselLabelTextColor })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TEXT_COLOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={normalizedConfig.lines.length <= 1}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={addLine}
            disabled={!canAddLine}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add line
          </button>
          <span className="text-xs text-slate-500">{normalizedConfig.lines.length} / {MAX_LINES}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
        <p className="mt-1 text-xs text-slate-500">Rendered inside vessel shape with clipping and auto fitting.</p>
        <canvas ref={canvasRef} className="mt-3 w-full max-w-full rounded border border-slate-200" />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}
      {warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {warning}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
