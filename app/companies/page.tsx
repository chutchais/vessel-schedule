import { CompanyManager } from "@/components/companies/company-manager";

export default function CompaniesPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <CompanyManager />
      </div>
    </main>
  );
}