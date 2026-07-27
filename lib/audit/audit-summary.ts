type SummaryInput = {
  action: string;
  entityType: string;
  entityName: string | null;
  actorDisplayName: string | null;
  metadata?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function createAuditSummary(input: SummaryInput): string {
  const target = input.entityName ?? input.entityType;
  const metadata = toRecord(input.metadata);

  switch (input.action) {
    case "CREATE":
      return `Created ${input.entityType} ${target}`;
    case "UPDATE":
      return `Updated ${input.entityType} ${target}`;
    case "ACTIVATE":
      return `Activated ${input.entityType} ${target}`;
    case "DEACTIVATE":
      return `Deactivated ${input.entityType} ${target}`;
    case "INVITE":
      return `Invited ${target}`;
    case "RESEND_INVITATION":
      return `Resent invitation to ${target}`;
    case "REVOKE_INVITATION":
      return `Revoked invitation for ${target}`;
    case "ACCEPT_INVITATION":
      return `Accepted invitation for ${target}`;
    case "DECLINE_INVITATION":
      return `Declined invitation for ${target}`;
    case "CHANGE_ROLE": {
      const fromRole = typeof metadata?.fromRole === "string" ? metadata.fromRole : null;
      const toRole = typeof metadata?.toRole === "string" ? metadata.toRole : null;
      if (fromRole && toRole) {
        return `Changed ${target} from ${fromRole} to ${toRole}`;
      }
      return `Changed role for ${target}`;
    }
    case "ACTIVATE_MEMBER":
      return `Activated member ${target}`;
    case "DEACTIVATE_MEMBER":
      return `Deactivated member ${target}`;
    case "TRANSFER_OWNERSHIP": {
      const from = typeof metadata?.fromOwnerName === "string" ? metadata.fromOwnerName : input.actorDisplayName;
      const to = typeof metadata?.toOwnerName === "string" ? metadata.toOwnerName : target;
      return `Transferred ownership from ${from ?? "previous owner"} to ${to}`;
    }
    case "APPROVE_REQUEST":
      return `Approved organization request for ${target}`;
    case "REJECT_REQUEST":
      return `Rejected organization request for ${target}`;
    default:
      return `${input.action} ${input.entityType} ${target}`;
  }
}
