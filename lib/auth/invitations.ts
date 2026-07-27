const OWNER_CAN_INVITE = ["ADMIN", "PLANNER", "VIEWER"] as const;
const ADMIN_CAN_INVITE = ["PLANNER", "VIEWER"] as const;

export function canInviteRole(inviterRole: string, targetRole: string): boolean {
  if (inviterRole === "OWNER") return (OWNER_CAN_INVITE as readonly string[]).includes(targetRole);
  if (inviterRole === "ADMIN") return (ADMIN_CAN_INVITE as readonly string[]).includes(targetRole);
  return false;
}

export function canManageInvitation(inviterRole: string, invitedRole: string): boolean {
  return canInviteRole(inviterRole, invitedRole);
}

// Can inviter change target's role from currentTargetRole to newTargetRole?
export function canChangeRole(
  inviterRole: string,
  currentTargetRole: string,
  newTargetRole: string,
): boolean {
  // Nobody can assign OWNER via PATCH
  if (newTargetRole === "OWNER") return false;
  // Cannot modify OWNER members
  if (currentTargetRole === "OWNER") return false;
  if (inviterRole === "OWNER") {
    // OWNER can change ADMIN/PLANNER/VIEWER to any non-OWNER role
    return (OWNER_CAN_INVITE as readonly string[]).includes(newTargetRole);
  }
  if (inviterRole === "ADMIN") {
    // ADMIN can only change PLANNER↔VIEWER
    const allowed = ["PLANNER", "VIEWER"];
    return allowed.includes(currentTargetRole) && allowed.includes(newTargetRole);
  }
  return false;
}

export function canDeactivateMember(inviterRole: string, targetRole: string): boolean {
  if (targetRole === "OWNER") return false;
  if (inviterRole === "OWNER") return true;
  if (inviterRole === "ADMIN") return ["PLANNER", "VIEWER"].includes(targetRole);
  return false;
}
