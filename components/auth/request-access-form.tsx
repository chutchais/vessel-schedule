"use client";

import { useState } from "react";
import Link from "next/link";

export function RequestAccessForm({ emailAvailable }: { emailAvailable: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    organizationName: "",
    requesterName: "",
    requesterEmail: "",
    phone: "",
    message: "",
    website: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/organization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setSubmitted(true);
      setFormData({
        organizationName: "",
        requesterName: "",
        requesterEmail: "",
        phone: "",
        message: "",
        website: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">Request Submitted Successfully</p>
          <p className="text-green-700 text-sm mt-1">{emailAvailable ? "Your organization request has been received. Our team will review it and contact you by email." : "Your organization request has been recorded. Automated email delivery is unavailable, so no confirmation email was sent. Contact support@getflowport.com for follow-up."}</p>
        </div>
        <div>
          <Link
            href="/auth/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
          Organization Name *
        </label>
        <input
          type="text"
          id="organizationName"
          name="organizationName"
          value={formData.organizationName}
          onChange={handleChange}
          maxLength={200}
          placeholder="Your Organization"
          required
          disabled={isLoading}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label htmlFor="requesterName" className="block text-sm font-medium text-gray-700">
          Your Name *
        </label>
        <input
          type="text"
          id="requesterName"
          name="requesterName"
          value={formData.requesterName}
          onChange={handleChange}
          maxLength={200}
          placeholder="Full Name"
          required
          disabled={isLoading}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label htmlFor="requesterEmail" className="block text-sm font-medium text-gray-700">
          Email *
        </label>
        <input
          type="email"
          id="requesterEmail"
          name="requesterEmail"
          value={formData.requesterEmail}
          onChange={handleChange}
          maxLength={255}
          placeholder="you@example.com"
          required
          disabled={isLoading}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone Number (optional)
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          maxLength={50}
          placeholder="+1 (555) 000-0000"
          disabled={isLoading}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700">
          Message (optional)
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          maxLength={2000}
          placeholder="Tell us about your organization..."
          rows={4}
          disabled={isLoading}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <input
        type="text"
        name="website"
        value={formData.website}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
      >
        {isLoading ? "Submitting..." : "Submit Request"}
      </button>

      <div className="text-center text-sm text-gray-600">
        <p>
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </form>
  );
}
