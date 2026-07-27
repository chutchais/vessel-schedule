type Role = "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";

export function canViewMasterData(role: Role): boolean {
  void role;
  return true;
}

export function canManageMasterData(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canViewSchedules(role: Role): boolean {
  void role;
  return true;
}

export function canManageSchedules(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "PLANNER";
}

export function canCancelSchedules(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "PLANNER";
}

export function canManageOrgMembers(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canChangeAdminRoles(role: Role): boolean {
  return role === "OWNER";
}

export function canTransferOwnership(role: Role): boolean {
  return role === "OWNER";
}
