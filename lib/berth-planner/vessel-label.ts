import { formatTime } from "./timezone";

export type VesselLabelFontWeight = "REGULAR" | "BOLD";
export type VesselLabelFontSize = "AUTO" | "SMALL" | "NORMAL" | "BIG" | "BIGGER";
export type VesselLabelTextAlign = "LEFT" | "CENTER" | "RIGHT";
export type VesselLabelTextColor = "AUTO" | "LIGHT" | "DARK";

export type VesselLabelLine = {
  template: string;
  fontWeight: VesselLabelFontWeight;
  fontSize: VesselLabelFontSize;
  textAlign: VesselLabelTextAlign;
  textColor: VesselLabelTextColor;
};

export type VesselLabelConfig = {
  schemaVersion: 1;
  lines: VesselLabelLine[];
};

export type VesselLabelTemplateContext = {
  vesselName: string;
  serviceName: string | null;
  voyageNumber: string | null;
  berthName: string;
  vesselLoa?: number | null;
  serviceColor?: string | null;
  berthLength?: number;
  berthZeroOriginSide?: "LEFT" | "RIGHT";
  scheduleStatus?: string;
  berthPositionStart?: number;
  berthPositionEnd?: number;
  headingReverse?: boolean;
  remarks?: string | null;
  eta?: Date;
  etb?: Date | null;
  etd?: Date;
  updatedAt?: string;
  timezone?: string;
};

export type VesselLabelPlaceholderGroup = {
  model: string;
  placeholders: Array<{ key: string; description: string }>;
};

export type ResolvedVesselLabelLine = VesselLabelLine & {
  text: string;
};

const MAX_LINE_COUNT = 6;
const MAX_TEMPLATE_LENGTH = 80;
const UNSAFE_TEMPLATE_PATTERNS = [
  /</,
  />/,
  /javascript:/i,
  /style=/i,
  /class=/i,
  /\[[^\]]+\]\([^)]+\)/,
  /!\[[^\]]*]\([^)]+\)/,
  /https?:\/\//i,
];

const FONT_WEIGHTS: VesselLabelFontWeight[] = ["REGULAR", "BOLD"];
const FONT_SIZES: VesselLabelFontSize[] = ["AUTO", "SMALL", "NORMAL", "BIG", "BIGGER"];
const TEXT_ALIGNS: VesselLabelTextAlign[] = ["LEFT", "CENTER", "RIGHT"];
const TEXT_COLORS: VesselLabelTextColor[] = ["AUTO", "LIGHT", "DARK"];

const DEFAULT_LINES: VesselLabelLine[] = [
  {
    template: "{{vesselName}}",
    fontWeight: "BOLD",
    fontSize: "AUTO",
    textAlign: "CENTER",
    textColor: "AUTO",
  },
  {
    template: "{{serviceName}}",
    fontWeight: "REGULAR",
    fontSize: "AUTO",
    textAlign: "CENTER",
    textColor: "AUTO",
  },
  {
    template: "{{voyageNumber}}",
    fontWeight: "REGULAR",
    fontSize: "AUTO",
    textAlign: "CENTER",
    textColor: "AUTO",
  },
];

const DEFAULT_CONFIG: VesselLabelConfig = {
  schemaVersion: 1,
  lines: DEFAULT_LINES,
};

export const VESSEL_LABEL_PLACEHOLDER_GROUPS: VesselLabelPlaceholderGroup[] = [
  {
    model: "Vessel",
    placeholders: [
      { key: "{{vesselName}}", description: "Vessel.name" },
      { key: "{{vesselLoa}}", description: "Vessel.lengthOverall" },
    ],
  },
  {
    model: "Service",
    placeholders: [
      { key: "{{serviceName}}", description: "Service.name" },
      { key: "{{serviceColor}}", description: "Service.color" },
      { key: "{{voyageNumber}}", description: "VesselSchedule.voyageNumber" },
    ],
  },
  {
    model: "Berth",
    placeholders: [
      { key: "{{berthName}}", description: "Berth.name" },
      { key: "{{berthLength}}", description: "Berth.berthLength" },
      { key: "{{berthZeroOriginSide}}", description: "Berth.zeroOriginSide" },
    ],
  },
  {
    model: "VesselSchedule",
    placeholders: [
      { key: "{{status}}", description: "VesselSchedule.status" },
      { key: "{{eta}}", description: "VesselSchedule.eta (time)" },
      { key: "{{etb}}", description: "VesselSchedule.etb (time)" },
      { key: "{{etd}}", description: "VesselSchedule.etd (time)" },
      { key: "{{berthPositionStart}}", description: "Calculated start position (m)" },
      { key: "{{berthPositionEnd}}", description: "Calculated end position (m)" },
      { key: "{{headingReverse}}", description: "VesselSchedule.headingReverse" },
      { key: "{{remarks}}", description: "VesselSchedule.remarks" },
      { key: "{{berthDuration}}", description: "Calculated duration between ETA and ETD" },
      { key: "{{updatedAt}}", description: "VesselSchedule.updatedAt (ISO)" },
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function trimTemplate(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function hasUnsafeTemplatePattern(value: string): boolean {
  return UNSAFE_TEMPLATE_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeLine(input: unknown, index: number): VesselLabelLine | null {
  if (!isRecord(input)) return null;
  const rawTemplate = typeof input.template === "string" ? trimTemplate(input.template) : "";
  if (!rawTemplate) return null;
  if (rawTemplate.length > MAX_TEMPLATE_LENGTH) return null;
  if (hasUnsafeTemplatePattern(rawTemplate)) return null;

  const fontWeight = isEnumValue(input.fontWeight, FONT_WEIGHTS)
    ? input.fontWeight
    : index === 0
      ? "BOLD"
      : "REGULAR";
  const fontSize = isEnumValue(input.fontSize, FONT_SIZES) ? input.fontSize : "AUTO";
  const textAlign = isEnumValue(input.textAlign, TEXT_ALIGNS) ? input.textAlign : "CENTER";
  const textColor = isEnumValue(input.textColor, TEXT_COLORS) ? input.textColor : "AUTO";

  return { template: rawTemplate, fontWeight, fontSize, textAlign, textColor };
}

function normalizeLines(inputs: unknown[]): VesselLabelLine[] {
  const result: VesselLabelLine[] = [];
  for (let index = 0; index < inputs.length && result.length < MAX_LINE_COUNT; index += 1) {
    const normalized = normalizeLine(inputs[index], result.length);
    if (normalized) result.push(normalized);
  }
  return result;
}

function normalizeFromLegacyTemplate(value: string): VesselLabelConfig {
  const rows = value.replace(/\r\n?/g, "\n").split("\n");
  const normalized = rows
    .slice(0, MAX_LINE_COUNT)
    .map((line, index) => {
      const template = trimTemplate(line);
      if (!template || template.length > MAX_TEMPLATE_LENGTH || hasUnsafeTemplatePattern(template)) {
        return null;
      }
      const normalizedLine: VesselLabelLine = {
        template,
        fontWeight: index === 0 ? "BOLD" : "REGULAR",
        fontSize: "AUTO",
        textAlign: "CENTER",
        textColor: "AUTO",
      };
      return normalizedLine;
    })
    .filter((line): line is VesselLabelLine => Boolean(line));

  return {
    schemaVersion: 1,
    lines: normalized.length > 0 ? normalized : DEFAULT_CONFIG.lines,
  };
}

function normalizeFromObject(value: Record<string, unknown>): VesselLabelConfig | null {
  if (!Array.isArray(value.lines)) return null;
  const lines = normalizeLines(value.lines);
  if (lines.length === 0) return null;
  return { schemaVersion: 1, lines };
}

export function defaultVesselLabelConfig(): VesselLabelConfig {
  return {
    schemaVersion: 1,
    lines: DEFAULT_CONFIG.lines.map((line) => ({ ...line })),
  };
}

export function normalizeStoredVesselLabelConfig(rawValue: unknown): {
  config: VesselLabelConfig;
  migratedFromLegacy: boolean;
} {
  if (typeof rawValue === "string") {
    return { config: normalizeFromLegacyTemplate(rawValue), migratedFromLegacy: true };
  }
  if (isRecord(rawValue)) {
    const normalized = normalizeFromObject(rawValue);
    if (normalized) return { config: normalized, migratedFromLegacy: false };
  }
  return { config: defaultVesselLabelConfig(), migratedFromLegacy: false };
}

export function validateVesselLabelConfigInput(rawValue: unknown): {
  ok: true;
  config: VesselLabelConfig;
} | {
  ok: false;
  error: string;
} {
  if (!isRecord(rawValue)) {
    return { ok: false, error: "Configuration must be an object." };
  }
  if (!Array.isArray(rawValue.lines)) {
    return { ok: false, error: "Configuration lines are required." };
  }
  if (rawValue.lines.length === 0) {
    return { ok: false, error: "At least one label line is required." };
  }
  if (rawValue.lines.length > MAX_LINE_COUNT) {
    return { ok: false, error: `A maximum of ${MAX_LINE_COUNT} lines is allowed.` };
  }

  const lines: VesselLabelLine[] = [];
  for (let index = 0; index < rawValue.lines.length; index += 1) {
    const line = rawValue.lines[index];
    if (!isRecord(line)) {
      return { ok: false, error: `Line ${index + 1} must be an object.` };
    }
    if (typeof line.template !== "string" || trimTemplate(line.template).length === 0) {
      return { ok: false, error: `Line ${index + 1} template is required.` };
    }
    const template = trimTemplate(line.template);
    if (template.length > MAX_TEMPLATE_LENGTH) {
      return { ok: false, error: `Line ${index + 1} template is too long.` };
    }
    if (hasUnsafeTemplatePattern(template)) {
      return { ok: false, error: `Line ${index + 1} contains unsupported markup.` };
    }
    if (!isEnumValue(line.fontWeight, FONT_WEIGHTS)) {
      return { ok: false, error: `Line ${index + 1} has invalid fontWeight.` };
    }
    if (!isEnumValue(line.fontSize, FONT_SIZES)) {
      return { ok: false, error: `Line ${index + 1} has invalid fontSize.` };
    }
    if (!isEnumValue(line.textAlign, TEXT_ALIGNS)) {
      return { ok: false, error: `Line ${index + 1} has invalid textAlign.` };
    }
    if (!isEnumValue(line.textColor, TEXT_COLORS)) {
      return { ok: false, error: `Line ${index + 1} has invalid textColor.` };
    }
    lines.push({
      template,
      fontWeight: line.fontWeight,
      fontSize: line.fontSize,
      textAlign: line.textAlign,
      textColor: line.textColor,
    });
  }

  return { ok: true, config: { schemaVersion: 1, lines } };
}

function replaceToken(token: string, context: VesselLabelTemplateContext): string {
  const formatNumber = (value: number | null | undefined): string => {
    if (typeof value !== "number" || Number.isNaN(value)) return "";
    return `${value}`;
  };
  const formatDuration = (start?: Date, end?: Date): string => {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return "";
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) return "";
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
    const days = Math.floor(minutes / 1_440);
    const hours = Math.floor((minutes % 1_440) / 60);
    const mins = minutes % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return parts.join(" ");
  };

  switch (token) {
    case "vesselName":
      return context.vesselName;
    case "vesselLoa":
      return formatNumber(context.vesselLoa);
    case "serviceName":
      return context.serviceName ?? "";
    case "serviceColor":
      return context.serviceColor ?? "";
    case "voyageNumber":
      return context.voyageNumber ?? "";
    case "berthName":
      return context.berthName;
    case "berthLength":
      return formatNumber(context.berthLength);
    case "berthZeroOriginSide":
      return context.berthZeroOriginSide ?? "";
    case "status":
      return context.scheduleStatus ?? "";
    case "eta":
      return context.eta && context.timezone ? formatTime(context.eta, context.timezone) : "";
    case "etb":
      return context.etb && context.timezone ? formatTime(context.etb, context.timezone) : "";
    case "etd":
      return context.etd && context.timezone ? formatTime(context.etd, context.timezone) : "";
    case "berthPositionStart":
      return formatNumber(context.berthPositionStart);
    case "berthPositionEnd":
      return formatNumber(context.berthPositionEnd);
    case "headingReverse":
      return typeof context.headingReverse === "boolean" ? (context.headingReverse ? "true" : "false") : "";
    case "remarks":
      return context.remarks ?? "";
    case "berthDuration":
      return formatDuration(context.eta, context.etd);
    case "updatedAt":
      return context.updatedAt ?? "";
    default:
      return "";
  }
}

function resolveTemplate(template: string, context: VesselLabelTemplateContext): string {
  return template
    .replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_, token: string) =>
      replaceToken(token, context),
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveVesselLabelLines(
  config: VesselLabelConfig,
  context: VesselLabelTemplateContext,
): ResolvedVesselLabelLine[] {
  return config.lines
    .map((line) => ({ ...line, text: resolveTemplate(line.template, context) }))
    .filter((line) => line.text.length > 0);
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]): number {
  return (
    0.2126 * srgbToLinear(rgb[0]) +
    0.7152 * srgbToLinear(rgb[1]) +
    0.0722 * srgbToLinear(rgb[2])
  );
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveTextColor(mode: VesselLabelTextColor, backgroundRgb: [number, number, number]): string {
  const light: [number, number, number] = [248, 250, 252];
  const dark: [number, number, number] = [15, 23, 42];
  if (mode === "LIGHT") return "rgb(248,250,252)";
  if (mode === "DARK") return "rgb(15,23,42)";
  return contrastRatio(light, backgroundRgb) >= contrastRatio(dark, backgroundRgb)
    ? "rgb(248,250,252)"
    : "rgb(15,23,42)";
}

function getFontLimit(
  line: VesselLabelLine,
  maxAutoSize: number,
  smallSize: number,
  normalSize: number,
  bigSize: number,
  biggerSize: number,
): number {
  if (line.fontSize === "SMALL") return smallSize;
  if (line.fontSize === "NORMAL") return normalSize;
  if (line.fontSize === "BIG") return bigSize;
  if (line.fontSize === "BIGGER") return biggerSize;
  return maxAutoSize;
}

function getAlign(line: VesselLabelLine): CanvasTextAlign {
  if (line.textAlign === "LEFT") return "left";
  if (line.textAlign === "RIGHT") return "right";
  return "center";
}

export function blendRgb(
  foreground: [number, number, number],
  alpha: number,
  background: [number, number, number] = [255, 255, 255],
): [number, number, number] {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
  ];
}

export function drawVesselLabelLines(params: {
  ctx: CanvasRenderingContext2D;
  polygon: [number, number][];
  bounds: { left: number; right: number; top: number; bottom: number };
  config: VesselLabelConfig;
  resolvedLines?: ResolvedVesselLabelLine[];
  context: VesselLabelTemplateContext;
  backgroundRgb: [number, number, number];
  labelScalePercent?: number;
  fontFamily?: string;
  minFontSize: number;
  maxFontSize: number;
  smallFontSize: number;
  normalFontSize: number;
  bigFontSize: number;
  biggerFontSize: number;
  lineGap: number;
  horizontalPadding: number;
  verticalPadding: number;
  topInset?: number;
}) {
  const {
    ctx,
    polygon,
    bounds,
    config,
    resolvedLines,
    context,
    backgroundRgb,
    labelScalePercent = 100,
    fontFamily = "system-ui, sans-serif",
    minFontSize,
    maxFontSize,
    smallFontSize,
    normalFontSize,
    bigFontSize,
    biggerFontSize,
    lineGap,
    horizontalPadding,
    verticalPadding,
    topInset = 0,
  } = params;

  const lines = resolvedLines ?? resolveVesselLabelLines(config, context);
  if (lines.length === 0) return;

  const availableWidth = Math.max(0, bounds.right - bounds.left - horizontalPadding * 2);
  const availableHeight = Math.max(0, bounds.bottom - bounds.top - topInset - verticalPadding * 2);
  if (availableWidth <= 0 || availableHeight <= 0) return;

  const drawable: Array<{
    line: ResolvedVesselLabelLine;
    size: number;
    text: string;
  }> = [];
  let consumedHeight = 0;
  const scaleRatio = Math.max(0.8, Math.min(1.4, labelScalePercent / 100));

  function ellipsizeToWidth(text: string, font: string): string {
    const ellipsis = "…";
    ctx.font = font;
    if (ctx.measureText(text).width <= availableWidth) return text;
    if (ctx.measureText(ellipsis).width > availableWidth) return "";
    let current = text;
    while (current.length > 0) {
      current = current.slice(0, -1);
      const candidate = `${current}${ellipsis}`;
      if (ctx.measureText(candidate).width <= availableWidth) return candidate;
    }
    return ellipsis;
  }

  for (const line of lines) {
    const basePreferredSize = Math.min(
      maxFontSize,
      Math.max(
        minFontSize,
        getFontLimit(line, maxFontSize, smallFontSize, normalFontSize, bigFontSize, biggerFontSize),
      ),
    );
    const scaledPreferredSize = Math.min(maxFontSize, Math.max(minFontSize, basePreferredSize * scaleRatio));
    const minAllowedSize = line.fontSize === "AUTO"
      ? Math.max(minFontSize, scaledPreferredSize * 0.82)
      : scaledPreferredSize;
    let size = scaledPreferredSize;
    const fontPrefix = line.fontWeight === "BOLD" ? "bold " : "";
    while (size > minAllowedSize) {
      ctx.font = `${fontPrefix}${size}px ${fontFamily}`;
      if (ctx.measureText(line.text).width <= availableWidth) break;
      size -= 0.5;
    }
    size = Math.max(minAllowedSize, size);
    const font = `${fontPrefix}${size}px ${fontFamily}`;
    const fittedText = ellipsizeToWidth(line.text, font);
    if (!fittedText) continue;

    const requiredHeight = size + (drawable.length > 0 ? lineGap : 0);
    if (consumedHeight + requiredHeight > availableHeight) break;
    consumedHeight += requiredHeight;
    drawable.push({ line, size, text: fittedText });
  }

  if (drawable.length === 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...polygon[0]!);
  for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(...polygon[index]!);
  ctx.closePath();
  ctx.clip();

  ctx.textBaseline = "middle";
  let y = bounds.top + topInset + verticalPadding + (availableHeight - consumedHeight) / 2;
  drawable.forEach(({ line, size, text }, index) => {
    ctx.font = `${line.fontWeight === "BOLD" ? "bold " : ""}${size}px ${fontFamily}`;
    ctx.fillStyle = resolveTextColor(line.textColor, backgroundRgb);
    ctx.textAlign = getAlign(line);
    const x = line.textAlign === "LEFT"
      ? bounds.left + horizontalPadding
      : line.textAlign === "RIGHT"
        ? bounds.right - horizontalPadding
        : bounds.left + (bounds.right - bounds.left) / 2;
    ctx.fillText(text, x, y + size / 2, availableWidth);
    y += size + (index < drawable.length - 1 ? lineGap : 0);
  });

  ctx.restore();
}
