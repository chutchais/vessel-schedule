export function getPlannerUndoUnavailableReason(input: {
  now: Date;
  expiresAt: Date;
  usedAt: Date | null;
  expectedUpdatedAt: Date;
  currentUpdatedAt: Date;
}) {
  if (input.usedAt) return "used" as const;
  if (input.expiresAt <= input.now) return "expired" as const;
  if (input.expectedUpdatedAt.getTime() !== input.currentUpdatedAt.getTime()) return "stale" as const;
  return null;
}
