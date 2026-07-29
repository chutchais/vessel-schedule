"use client";

import { useState } from "react";

interface OrganizationRequestDetail {
  id: string;
  organizationName: string;
  slug: string | null;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  message: string | null;
  status: string;
  organizationId: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvalStartedAt: string | null;
  invitationSentAt: string | null;
  approvalClaimedAt: string | null;
  approvalVersion: number;
  approvalStage: string | null;
  reviewNotes: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface Props {
  request: OrganizationRequestDetail;
  onClose: () => void;
  onUpdated: () => void;
}

export function OrganizationRequestManager({ request, onClose, onUpdated }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"view" | "approve" | "reject" | "retry">("view");
  const [formData, setFormData] = useState({
    organizationName: request.organizationName,
    slug: request.slug || "",
    reviewNotes: request.reviewNotes || "",
  });

  const canApprove = request.status === "PENDING";
  const canReject = request.status === "PENDING";
  const canRetry = request.status === "APPROVAL_FAILED" || request.status === "APPROVING";

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/organization-requests/${request.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationName: formData.organizationName,
            slug: formData.slug,
            reviewNotes: formData.reviewNotes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve request");
      }

      setActionMode("view");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!formData.reviewNotes.trim()) {
      setError("Review notes are required");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/organization-requests/${request.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewNotes: formData.reviewNotes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject request");
      }

      setActionMode("view");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-800";
      case "APPROVING":
        return "bg-blue-100 text-blue-800";
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "APPROVAL_FAILED":
        return "bg-red-100 text-red-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {actionMode === "view" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Status</h3>
                  <p className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Created</h3>
                  <p className="mt-1 text-gray-900">
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Organization</h3>
                <p className="mt-1 text-gray-900 text-lg font-medium">
                  {request.organizationName}
                </p>
                {request.organization && (
                  <p className="text-gray-600 text-sm">
                    ID: {request.organization.id}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Requester Name</h3>
                  <p className="mt-1 text-gray-900">{request.requesterName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Email</h3>
                  <p className="mt-1 text-gray-900">{request.requesterEmail}</p>
                </div>
              </div>

              {request.phone && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Phone</h3>
                  <p className="mt-1 text-gray-900">{request.phone}</p>
                </div>
              )}

              {request.message && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Message</h3>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{request.message}</p>
                </div>
              )}

              {request.failureReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-800 uppercase">Failure Reason</h3>
                  <p className="mt-1 text-red-700 text-sm">{request.failureReason}</p>
                </div>
              )}

              {request.reviewNotes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Review Notes</h3>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{request.reviewNotes}</p>
                </div>
              )}

              {request.reviewedAt && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    Reviewed on {new Date(request.reviewedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}

          {actionMode === "approve" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) =>
                    setFormData({ ...formData, organizationName: e.target.value })
                  }
                  maxLength={200}
                  disabled={isProcessing}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  maxLength={100}
                  placeholder="organization-slug"
                  disabled={isProcessing}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Review Notes (optional)
                </label>
                <textarea
                  value={formData.reviewNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, reviewNotes: e.target.value })
                  }
                  maxLength={2000}
                  rows={3}
                  disabled={isProcessing}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>
          )}

          {actionMode === "reject" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Review Notes (required) *
                </label>
                <textarea
                  value={formData.reviewNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, reviewNotes: e.target.value })
                  }
                  maxLength={2000}
                  rows={4}
                  placeholder="Reason for rejection..."
                  disabled={isProcessing}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>
          )}

          {actionMode === "retry" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <p className="text-blue-800 text-sm">
                Retrying will use the existing organization and attempt to complete the approval process.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <p className="mt-1 text-gray-900">{request.organizationName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Review Notes (optional)
                </label>
                <textarea
                  value={formData.reviewNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, reviewNotes: e.target.value })
                  }
                  maxLength={2000}
                  rows={3}
                  disabled={isProcessing}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          {actionMode === "view" && (
            <>
              {canApprove && (
                <button
                  onClick={() => setActionMode("approve")}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                >
                  Approve
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => setActionMode("reject")}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
                >
                  Reject
                </button>
              )}

              {canRetry && (
                <button
                  onClick={() => setActionMode("retry")}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  Retry
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
              >
                Close
              </button>
            </>
          )}

          {actionMode === "approve" && (
            <>
              <button
                onClick={() => setActionMode("view")}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                {isProcessing ? "Approving..." : "Confirm Approval"}
              </button>
            </>
          )}

          {actionMode === "reject" && (
            <>
              <button
                onClick={() => setActionMode("view")}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
              >
                {isProcessing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </>
          )}

          {actionMode === "retry" && (
            <>
              <button
                onClick={() => setActionMode("view")}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
              >
                {isProcessing ? "Retrying..." : "Retry Approval"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
