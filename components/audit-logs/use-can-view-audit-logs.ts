"use client";

import { useEffect, useState } from "react";

type CurrentUserResponse = {
  data?: {
    membership?: {
      role?: string;
    };
  };
};

function isAuditLogRole(role: string | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function useCanViewAuditLogs() {
  const [canViewAuditLogs, setCanViewAuditLogs] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await response.json()) as CurrentUserResponse;
        const role = payload.data?.membership?.role;

        if (active) {
          setCanViewAuditLogs(response.ok && isAuditLogRole(role));
        }
      } catch {
        if (active) {
          setCanViewAuditLogs(false);
        }
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  return canViewAuditLogs;
}
