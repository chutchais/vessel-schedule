export function buildPlannerScheduleScope(args: {
  organizationId: string;
  terminalId: string;
  berthIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
}) {
  return {
    organizationId: args.organizationId,
    terminalId: args.terminalId,
    berthId: { in: args.berthIds },
    eta: { lt: args.rangeEnd },
    etd: { gt: args.rangeStart },
  };
}

