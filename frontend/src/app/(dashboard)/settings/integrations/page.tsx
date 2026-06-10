"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function IntegrationsPage() {
  const [copyFeedback, setCopyFeedback] = useState<"url" | "token" | null>(null);

  const { data: vmsConfig } = useQuery({
    queryKey: ["integrations-config"],
    queryFn: () => api.get("/integrations/config").then((r) => r.data),
  });

  const handleCopy = (text: string, type: "url" | "token") => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Staging Database Integration Setup</h1>
        <p className="text-gray-600">
          Connect Zoho CRM to the Staging Database for visitor data synchronization
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <div className="bg-white rounded border border-blue-200 p-4 text-center">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-sm font-medium">Zoho CRM</p>
            <p className="text-xs text-gray-500 mt-1">Contact Data</p>
          </div>

          <div className="flex justify-center">
            <div className="text-2xl text-blue-600">→</div>
          </div>

          <div className="bg-white rounded border border-green-200 p-4 text-center">
            <div className="text-2xl mb-2">📥</div>
            <p className="text-sm font-medium">Staging DB</p>
            <p className="text-xs text-gray-500 mt-1">Review & Store</p>
          </div>

          <div className="flex justify-center">
            <div className="text-2xl text-blue-600">→</div>
          </div>

          <div className="bg-white rounded border border-purple-200 p-4 text-center">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-sm font-medium">Main VMS</p>
            <p className="text-xs text-gray-500 mt-1">Live Data</p>
          </div>
        </div>

        <p className="text-sm text-blue-900 mt-4 text-center font-medium">
          Zoho CRM → Staging Database → VMS (One-way data flow with manual review)
        </p>
      </div>

      {/* Staging Database Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Copy Your Staging Database Credentials</h2>
        <p className="text-sm text-gray-600 mb-4">
          Copy these credentials and paste them into your Zoho CRM webhook configuration. Zoho will use these to send visitor data to the staging database.
        </p>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staging Database Webhook URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs break-all">
                {vmsConfig?.webhookUrl || "Loading..."}
              </div>
              <button
                onClick={() => handleCopy(vmsConfig?.webhookUrl || "", "url")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  copyFeedback === "url"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {copyFeedback === "url" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Paste this as the Webhook URL in Zoho CRM
            </p>
          </div>

          {/* API Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staging Database API Token
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs break-all">
                {vmsConfig?.apiToken ? vmsConfig.apiToken.substring(0, 20) + "..." : "Loading..."}
              </div>
              <button
                onClick={() => handleCopy(vmsConfig?.apiToken || "", "token")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  copyFeedback === "token"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {copyFeedback === "token" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Add this as a header in Zoho CRM webhook: <code className="bg-gray-100 px-1 rounded">X-Staging-Token</code>
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Next Step:</strong> Copy both values above and use them to configure Zoho CRM webhook (see instructions below).
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Configure Zoho CRM Webhook</h2>

        <details className="cursor-pointer">
          <summary className="font-medium text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2">
            📋 Step-by-Step Setup Guide
          </summary>
          <div className="mt-4 space-y-4 text-sm text-gray-600">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>
                <strong className="text-gray-900">Login to Zoho CRM</strong>
              </li>

              <li>
                <strong className="text-gray-900">Go to Settings → Automation → Webhooks</strong>
              </li>

              <li>
                <strong className="text-gray-900">Click "Create Webhook"</strong>
              </li>

              <li>
                <strong className="text-gray-900">Fill in the webhook details:</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                  <li><strong>Name:</strong> "VMS Staging Database"</li>
                  <li><strong>Trigger:</strong> "Contact Create or Update"</li>
                  <li><strong>URL:</strong> Paste the Staging Database Webhook URL (from above)</li>
                  <li><strong>Method:</strong> POST</li>
                  <li><strong>Header Key:</strong> <code className="bg-gray-100 px-1 rounded">X-Staging-Token</code></li>
                  <li><strong>Header Value:</strong> Paste the Staging Database API Token (from above)</li>
                </ul>
              </li>

              <li>
                <strong className="text-gray-900">Configure Payload:</strong>
                <p className="mt-2 bg-gray-50 p-3 rounded text-xs font-mono">
                  {`{
  "zoho_contact_id": "\${contactId}",
  "first_name": "\${firstName}",
  "last_name": "\${lastName}",
  "email": "\${email}",
  "phone": "\${phone}",
  "company": "\${company}",
  "visitor_type": "\${visitorType}",
  "photo_url": "\${photoUrl}"
}`}
                </p>
              </li>

              <li>
                <strong className="text-gray-900">Click "Save"</strong>
              </li>

              <li>
                <strong className="text-gray-900">Test the webhook</strong>
                <p className="mt-2">Create or update a contact in Zoho CRM to trigger the webhook. Then check <strong>Settings → CRM Sync</strong> in VMS to see if data arrived.</p>
              </li>
            </ol>
          </div>
        </details>
      </div>

      {/* Data Flow */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3">📊 Complete Data Flow</h3>
        <div className="space-y-2 text-sm text-indigo-800">
          <p><strong>Step 1:</strong> Contact created or updated in Zoho CRM</p>
          <p className="ml-4">↓ Zoho sends webhook with contact data</p>
          <p><strong>Step 2:</strong> Staging Database receives data</p>
          <p className="ml-4">↓ Data stored and awaits review</p>
          <p><strong>Step 3:</strong> VMS Admin reviews in Settings → CRM Sync</p>
          <p className="ml-4">↓ Admin clicks "Import" to approve</p>
          <p><strong>Step 4:</strong> Visitor imported to Main VMS</p>
          <p className="ml-4">↓ Face recognition becomes available</p>
          <p><strong>Step 5:</strong> Visitor available for check-in</p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Integration Tips</h3>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li><strong>One-way sync:</strong> Data flows from Zoho → Staging Database only</li>
          <li><strong>Review step:</strong> All data goes to staging first for admin review</li>
          <li><strong>Manual approval:</strong> Nothing automatically imported into VMS</li>
          <li><strong>Staging prevents bad data:</strong> Admin can reject or fix records before import</li>
          <li><strong>Check Settings → CRM Sync</strong> to see pending visitors from Zoho</li>
          <li><strong>Test first:</strong> Create a test contact in Zoho after configuring webhook</li>
        </ul>
      </div>

      {/* Visual Payload Example */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📤 What Zoho Sends to Staging Database</h3>
        <p className="text-sm text-gray-600 mb-3">When a contact is created/updated in Zoho, it will send this data:</p>
        <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-auto">
          <pre className="text-xs font-mono text-gray-800">{`POST ${vmsConfig?.webhookUrl || "http://localhost:4000/api/staging/sync"}

Header:
  X-Staging-Token: [your-api-token]
  Content-Type: application/json

Body:
{
  "zoho_contact_id": "12345678",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@acme.com",
  "phone": "+971501234567",
  "company": "Acme Corporation",
  "visitor_type": "Customer",
  "photo_url": "https://..."
}`}</pre>
        </div>
      </div>

      {/* Support */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Troubleshooting</h3>
        <ul className="text-sm text-yellow-800 space-y-2 list-disc list-inside">
          <li><strong>Data not appearing?</strong> Check Zoho webhook delivery logs</li>
          <li><strong>Invalid token error?</strong> Verify X-Staging-Token header value matches exactly</li>
          <li><strong>Can't find data?</strong> Go to Settings → CRM Sync to view staging database</li>
          <li><strong>Webhook failed?</strong> Test with a simple contact in Zoho first</li>
        </ul>
      </div>
    </div>
  );
}
