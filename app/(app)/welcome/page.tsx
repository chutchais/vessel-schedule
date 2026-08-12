import { requireCurrentUser } from "@/lib/auth/current-user";
import Link from "next/link";

export default async function WelcomePage() {
  const currentUser = await requireCurrentUser();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Welcome, {currentUser.displayName}!</h1>
          <p className="text-lg text-gray-600 mt-2">
            You&apos;re now part of <span className="font-semibold">{currentUser.activeOrganization.name}</span>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold">
                ✓
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Account Created</h3>
              <p className="text-blue-800 mt-1">
                Your account has been successfully created with OWNER role for your organization.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Next Steps</h2>
          <p className="text-gray-600">
            Begin setting up your organization by creating your first port and company.
          </p>
          <div className="flex gap-3">
            <Link
              href="/berth-planner"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Organization Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Organization:</dt>
              <dd className="font-medium text-gray-900">{currentUser.activeOrganization.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Role:</dt>
              <dd className="font-medium text-gray-900">{currentUser.membership.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Email:</dt>
              <dd className="font-medium text-gray-900">{currentUser.email}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
