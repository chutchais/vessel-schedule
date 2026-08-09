"use client";

import { useEffect, useState, useCallback } from "react";
import { OrganizationRequestManager } from "./organization-request-manager";

interface OrganizationRequest {
  id: string;
  organizationName: string;
  requesterName: string;
  requesterEmail: string;
  phone: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

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

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function OrganizationRequestsList() {
  const [requests, setRequests] = useState<OrganizationRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<OrganizationRequestDetail | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchRequests = useCallback(async (page: number) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "25",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/organization-requests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch requests");

      const data = await response.json();
      setRequests(data.data);
      setPagination(data.pagination);
    } catch {
      console.error("Error fetching requests");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRequests(1);
  }, [fetchRequests]);

  const handleRowClick = async (request: OrganizationRequest) => {
    try {
      const response = await fetch(`/api/admin/organization-requests/${request.id}`);
      if (!response.ok) throw new Error("Failed to fetch request details");

      const details = await response.json();
      setSelectedRequest(details);
      setIsDrawerOpen(true);
    } catch {
      console.error("Error fetching request details");
    }
  };

  const handleRequestUpdated = () => {
    setIsDrawerOpen(false);
    setSelectedRequest(null);
    fetchRequests(pagination.page);
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
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search org name, requester, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVING">Approving</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="APPROVAL_FAILED">Approval Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No requests found</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Requester
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Reviewed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    onClick={() => handleRowClick(request)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {request.organizationName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {request.requesterName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {request.requesterEmail}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {request.reviewedAt
                        ? new Date(request.reviewedAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {requests.length} of {pagination.total} requests
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchRequests(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchRequests(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isDrawerOpen && selectedRequest && (
        <OrganizationRequestManager
          request={selectedRequest}
          onClose={() => setIsDrawerOpen(false)}
          onUpdated={handleRequestUpdated}
        />
      )}
    </div>
  );
}
