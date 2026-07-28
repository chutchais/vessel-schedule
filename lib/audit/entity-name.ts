export function formatServiceAuditEntityName(code: string, name: string): string {
  return `${code} — ${name}`;
}

export function formatVesselScheduleAuditEntityName(input: {
  vesselName: string;
  serviceCode: string | null;
  voyageNumber: string | null;
}): string {
  const serviceCode = input.serviceCode?.trim() || "—";
  const voyageNumber = input.voyageNumber?.trim() || "—";
  return `${input.vesselName} · ${serviceCode} · ${voyageNumber}`;
}
