"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Invitation = {
  id: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  inviterDisplayName: string;
  expiresAt: string;
  deliveryStatus: string;
};

type AcceptState = { id: string; needsDisplayName: boolean };

export function InvitationList() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<AcceptState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/invitations/mine", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          if (active) setError(body.error ?? "Failed to load invitations");
          if (active) setLoading(false);
          return;
        }
        const body = (await res.json()) as { data: Invitation[] };
        if (active) setInvitations(body.data ?? []);
      } catch {
        if (active) setError("Failed to load invitations");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleAccept(invitation: Invitation) {
    setActionError(null);

    // Try without displayName first
    setProcessing(true);
    try {
      const res = await fetch(`/api/invitations/${invitation.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as {
        success?: boolean;
        organizationSlug?: string;
        error?: string;
      };

      if (res.ok && body.success) {
        router.push("/");
        router.refresh();
        return;
      }

      if (body.error?.includes("displayName is required")) {
        setAccepting({ id: invitation.id, needsDisplayName: true });
        setProcessing(false);
        return;
      }

      setActionError(body.error ?? "Failed to accept invitation");
    } catch {
      setActionError("Failed to accept invitation");
    } finally {
      setProcessing(false);
    }
  }

  async function handleAcceptWithDisplayName() {
    if (!accepting) return;
    if (!displayName.trim()) {
      setActionError("Display name is required");
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/invitations/${accepting.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && body.success) {
        router.push("/");
        router.refresh();
        return;
      }
      setActionError(body.error ?? "Failed to accept invitation");
    } catch {
      setActionError("Failed to accept invitation");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDecline(id: string) {
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/invitations/${id}/decline`, { method: "POST" });
      if (res.ok) {
        setDecliningId(null);
        setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      } else {
        const body = (await res.json()) as { error?: string };
        setActionError(body.error ?? "Failed to decline invitation");
      }
    } catch {
      setActionError("Failed to decline invitation");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">Loading invitations...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organization Invitations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Accept or decline invitations to join organizations.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Display name modal */}
      {accepting?.needsDisplayName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Set your display name</h2>
            <p className="mb-4 text-sm text-slate-500">
              Enter your name to complete accepting this invitation.
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {actionError && (
              <p className="mb-3 text-sm text-red-600">{actionError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => void handleAcceptWithDisplayName()}
                disabled={processing}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {processing ? "Accepting..." : "Accept invitation"}
              </button>
              <button
                onClick={() => {
                  setAccepting(null);
                  setDisplayName("");
                  setActionError(null);
                }}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline confirmation modal */}
      {decliningId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Decline invitation?</h2>
            <p className="mb-4 text-sm text-slate-500">
              This will decline the invitation. You can always request access again later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleDecline(decliningId)}
                disabled={processing}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {processing ? "Declining..." : "Decline"}
              </button>
              <button
                onClick={() => setDecliningId(null)}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">No active invitations</p>
          <p className="mt-1 text-sm text-slate-500">
            Contact an organization admin or{" "}
            <Link href="/request-access" className="text-blue-600 hover:underline">
              request access
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {invitations.map((inv) => (
            <li
              key={inv.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{inv.organizationName}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Role: <span className="font-medium text-slate-700">{inv.role}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Invited by{" "}
                    <span className="font-medium text-slate-700">{inv.inviterDisplayName}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={() => void handleAccept(inv)}
                    disabled={processing}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setDecliningId(inv.id)}
                    disabled={processing}
                    className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
