"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  deliveryStatus: string;
  deliveryError: string | null;
  inviterName: string;
  sentAt: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const ASSIGNABLE_ROLES_BY_ROLE: Record<string, string[]> = {
  OWNER: ["ADMIN", "PLANNER", "VIEWER"],
  ADMIN: ["PLANNER", "VIEWER"],
};

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  PLANNER: "bg-green-100 text-green-700",
  VIEWER: "bg-slate-100 text-slate-600",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-yellow-100 text-yellow-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  REVOKED: "bg-red-100 text-red-700",
  DECLINED: "bg-orange-100 text-orange-700",
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  currentUserId: string;
  currentRole: string;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function MemberManager({ currentUserId, currentRole }: Props) {
  const [tab, setTab] = useState<"members" | "invitations">("members");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Member Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your organization&apos;s members and invitations.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["members", "invitations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded-t-md px-4 py-2 text-sm font-medium capitalize transition",
              tab === t
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <MembersTab currentUserId={currentUserId} currentRole={currentRole} />
      ) : (
        <InvitationsTab currentRole={currentRole} />
      )}
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ currentUserId, currentRole }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [changingRole, setChangingRole] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "activate" | "transfer";
    member: Member;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter, page]);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/organization/members?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const body = (await res.json()) as { data: Member[]; pagination: Pagination };
      setMembers(body.data);
      setPagination(body.pagination);
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange() {
    if (!changingRole || !newRole) return;
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/organization/members/${changingRole.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Failed to update role");
        return;
      }
      setChangingRole(null);
      setNewRole("");
      void loadMembers();
    } catch {
      setActionError("Failed to update role");
    } finally {
      setProcessing(false);
    }
  }

  async function handleToggleActive(member: Member, isActive: boolean) {
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/organization/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Failed to update status");
        return;
      }
      setConfirmAction(null);
      void loadMembers();
    } catch {
      setActionError("Failed to update status");
    } finally {
      setProcessing(false);
    }
  }

  async function handleTransferOwnership(member: Member) {
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/organization/members/${member.userId}/transfer-ownership`, {
        method: "POST",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Failed to transfer ownership");
        return;
      }
      setConfirmAction(null);
      void loadMembers();
    } catch {
      setActionError("Failed to transfer ownership");
    } finally {
      setProcessing(false);
    }
  }

  const assignableRoles = ASSIGNABLE_ROLES_BY_ROLE[currentRole] ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pending Invitations</h2>
        <p className="text-sm text-slate-500">Active links are shown first. Generating a new link invalidates the old one.</p>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All roles</option>
          {["OWNER", "ADMIN", "PLANNER", "VIEWER"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Role change modal */}
      {changingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Change role</h2>
            <p className="mb-4 text-sm text-slate-500">
              Change role for <strong>{changingRole.displayName}</strong>
            </p>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select role…</option>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => void handleRoleChange()}
                disabled={processing || !newRole}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {processing ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setChangingRole(null); setNewRole(""); setActionError(null); }}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            {confirmAction.type === "transfer" ? (
              <>
                <h2 className="mb-1 text-lg font-semibold text-slate-900">Transfer ownership</h2>
                <p className="mb-4 text-sm text-slate-500">
              You will become an Admin and{" "}
                  <strong>{confirmAction.member.displayName}</strong> will become the Organization
                  Owner. This cannot be undone without another transfer.
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-1 text-lg font-semibold text-slate-900">
                  {confirmAction.type === "deactivate" ? "Deactivate" : "Activate"} member
                </h2>
                <p className="mb-4 text-sm text-slate-500">
                  {confirmAction.type === "deactivate"
                    ? `${confirmAction.member.displayName} will lose access to this organization.`
                    : `${confirmAction.member.displayName} will regain access to this organization.`}
                </p>
              </>
            )}
            {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (confirmAction.type === "transfer") {
                    void handleTransferOwnership(confirmAction.member);
                  } else {
                    void handleToggleActive(confirmAction.member, confirmAction.type === "activate");
                  }
                }}
                disabled={processing}
                className={[
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60",
                  confirmAction.type === "deactivate"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700",
                ].join(" ")}
              >
                {processing ? "Processing…" : "Confirm"}
              </button>
              <button
                onClick={() => { setConfirmAction(null); setActionError(null); }}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading members…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                const canChangeThisRole =
                  !isSelf && m.role !== "OWNER" && assignableRoles.length > 0;
                const canToggle = !isSelf && m.role !== "OWNER";
                const canTransfer = !isSelf && currentRole === "OWNER" && m.isActive && m.role !== "OWNER";

                return (
                  <tr key={m.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {m.displayName}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role] ?? ""}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${m.isActive ? "text-green-700" : "text-slate-400"}`}>
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canChangeThisRole && (
                          <button
                            onClick={() => { setChangingRole(m); setNewRole(m.role); setActionError(null); }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Change Role
                          </button>
                        )}
                        {canToggle && (
                          <button
                            onClick={() => setConfirmAction({ type: m.isActive ? "deactivate" : "activate", member: m })}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {m.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {canTransfer && (
                          <button
                            onClick={() => setConfirmAction({ type: "transfer", member: m })}
                            className="rounded-md border border-purple-300 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
                          >
                            Transfer Owner
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {pagination.total} member{pagination.total !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-1">
              {page} / {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invitations Tab ──────────────────────────────────────────────────────────

function InvitationsTab({ currentRole }: { currentRole: string }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable" | "error">("idle");

  const assignableRoles = ASSIGNABLE_ROLES_BY_ROLE[currentRole] ?? [];

  useEffect(() => {
    void loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, historyVisible]);

  async function loadInvitations() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      params.set("view", historyVisible ? "history" : "active");
      const res = await fetch(`/api/organization/invitations?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const body = (await res.json()) as { data: Invitation[]; pagination: Pagination };
      setInvitations(body.data);
      setPagination(body.pagination);
    } catch {
      setError("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    setInviteError(null);
    setInviteSuccess(null);
    setProcessing(true);
    try {
      const res = await fetch("/api/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          displayName: inviteDisplayName || undefined,
          role: inviteRole,
        }),
      });
      const body = (await res.json()) as { data?: { invitationUrl?: string; deliveryFailed?: boolean }; error?: string };
      if (!res.ok) {
        setInviteError(body.error ?? "Failed to send invitation");
        return;
      }
      setInvitationUrl(body.data?.invitationUrl ?? null);
      setCopyState("idle");
      setInviteSuccess(body.data?.deliveryFailed ? "Invitation created, but email delivery failed. Copy the link now and retry delivery from the invitation list." : "Invitation email sent. Copy the link now as a backup; it will not be shown again.");
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteRole("");
      void loadInvitations();
    } catch {
      setInviteError("Failed to send invitation");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this invitation? Its link will stop working immediately.")) return;
    setActionError(null);
    setProcessing(true);
    try {
      const res = await fetch(`/api/organization/invitations/${id}/revoke`, { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Failed to revoke");
        return;
      }
      void loadInvitations();
    } catch {
      setActionError("Failed to revoke invitation");
    } finally {
      setProcessing(false);
    }
  }

  async function copyInvitationUrl() {
    if (!invitationUrl) return;
    if (!navigator.clipboard?.writeText) { setCopyState("unavailable"); return; }
    try { await navigator.clipboard.writeText(invitationUrl); setCopyState("copied"); }
    catch { setCopyState("error"); }
  }

  async function handleResend(id: string, copyAfterCreating = false) {
    if (!window.confirm("Generate a new link? This permanently invalidates the previous link.")) return;
    setActionError(null);
    setProcessing(true);
    try {
      const res = await fetch(`/api/organization/invitations/${id}/resend`, { method: "POST" });
      const body = (await res.json()) as { data?: { invitationUrl?: string; deliveryFailed?: boolean }; error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Failed to resend");
        return;
      }
      const newUrl = body.data?.invitationUrl ?? null;
      setInvitationUrl(newUrl);
      if (copyAfterCreating && newUrl && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(newUrl);
          setCopyState("copied");
        } catch {
          setCopyState("error");
        }
      } else {
        setCopyState(copyAfterCreating ? "unavailable" : "idle");
      }
      setInviteSuccess(body.data?.deliveryFailed ? "Replacement link created, but email delivery failed. Copy the link now and retry from the invitation list." : "Replacement invitation email sent. The previous link no longer works.");
      void loadInvitations();
    } catch {
      setActionError("Failed to resend invitation");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {["PENDING", "ACCEPTED", "EXPIRED", "REVOKED", "DECLINED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => { setHistoryVisible((visible) => !visible); setPage(1); }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {historyVisible ? "Show active" : "View history"}
        </button>
        {assignableRoles.length > 0 && (
          <button
            onClick={() => { setShowInviteForm((v) => !v); setInviteError(null); setInviteSuccess(null); }}
            className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showInviteForm ? "Cancel" : "Invite Member"}
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInviteForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Invite a new member</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Role *</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select role…</option>
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
          {inviteSuccess && <p className="mt-2 text-sm text-green-700">{inviteSuccess}</p>}
          {invitationUrl && <div className="mt-3"><label className="mb-1 block text-xs font-medium text-slate-700">Invitation URL (shown once)</label><div className="flex gap-2"><input readOnly value={invitationUrl} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700" aria-label="Invitation URL" /><button onClick={() => void copyInvitationUrl()} className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">Copy link</button></div>{copyState === "copied" && <p className="mt-1 text-xs text-green-700">Copied.</p>}{copyState === "unavailable" && <p className="mt-1 text-xs text-amber-700">Clipboard access is unavailable. Select and copy the link manually.</p>}{copyState === "error" && <p className="mt-1 text-xs text-red-700">Could not copy the link. Select and copy it manually.</p>}</div>}
          <button
            onClick={() => void handleInvite()}
            disabled={processing || !inviteEmail || !inviteRole}
            className="mt-3 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processing ? "Sending…" : "Send Invitation"}
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading invitations…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Email", "Role", "Status", "Delivery", "Invited by", "Created", "Expires", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    {historyVisible ? "No invitation history found" : "No active pending invitations"}
                  </td>
                </tr>
              ) : invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{inv.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[inv.role] ?? ""}`}>
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${inv.deliveryStatus === "SENT" ? "bg-green-100 text-green-700" : inv.deliveryStatus === "FAILED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {inv.deliveryStatus === "SENT" ? "Sent" : inv.deliveryStatus === "FAILED" ? "Failed" : inv.deliveryStatus === "EXISTING_ACCOUNT" ? "Existing account" : "Pending"}
                    </span>
                    {inv.deliveryStatus === "FAILED" && inv.deliveryError && <p className="mt-1 max-w-44 text-slate-500">{inv.deliveryError}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{inv.inviterName}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "ACTIVE" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleResend(inv.id)}
                          disabled={processing}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          Resend invitation
                        </button>
                        {inv.deliveryStatus === "FAILED" && (
                          <button onClick={() => void handleResend(inv.id)} disabled={processing} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60">
                            Retry delivery
                          </button>
                        )}
                        <button
                          onClick={() => void handleResend(inv.id, true)}
                          disabled={processing}
                          title="Creates and copies a replacement link; the previous link is invalidated."
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          Copy link
                        </button>
                        <button
                          onClick={() => void handleRevoke(inv.id)}
                          disabled={processing}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{pagination.total} invitation{pagination.total !== 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-1">{page} / {pagination.totalPages}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
