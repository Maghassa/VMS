"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface StagingVisitor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  visitorType?: string;
  photoUrl?: string;
  syncedAt: string;
  imported: boolean;
}

interface SyncStatus {
  total: number;
  imported: number;
  pending: number;
}

export default function CrmSyncPage() {
  const queryClient = useQueryClient();
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: status, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ["crm-status"],
    queryFn: () => api.get("/staging/status").then((r) => r.data),
    refetchInterval: 10_000,
  });

  const { data: stagedVisitors, isLoading } = useQuery({
    queryKey: ["staging-visitors", page, search],
    queryFn: () =>
      api
        .get(`/staging/visitors?page=${page}&limit=20&status=pending&search=${search}`)
        .then((r) => r.data),
  });

  const triggerSyncMutation = useMutation({
    mutationFn: () => api.post("/staging/trigger", {}),
    onSuccess: (result) => {
      setLastSyncTime(new Date());
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["staging-visitors"] });
    },
  });

  const importVisitorMutation = useMutation({
    mutationFn: (id: string) => api.post(`/staging/visitors/${id}/import`, {}),
    onSuccess: () => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["staging-visitors"] });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: () => api.post("/staging/bulk-import", {}),
    onSuccess: () => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["staging-visitors"] });
      setSelectedIds(new Set());
    },
  });

  const deleteVisitorMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staging/visitors/${id}`),
    onSuccess: () => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["staging-visitors"] });
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.size === stagedVisitors?.visitors?.length) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set<string>();
      stagedVisitors?.visitors?.forEach((v: StagingVisitor) => newSet.add(v.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const syncPercentage = status ? ((status.imported / status.total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">CRM Integration & Staging</h1>
        <p className="text-gray-600">
          Review and import visitor data from Zoho CRM
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Total Synced
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {status?.total || 0}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            from Zoho CRM
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Pending Review
          </div>
          <div className="text-3xl font-bold text-yellow-600">
            {status?.pending || 0}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            in staging database
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Imported
          </div>
          <div className="text-3xl font-bold text-green-600">
            {status?.imported || 0}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            added to system
          </p>
        </div>
      </div>

      {/* Import Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-sm font-medium text-gray-600">
              {syncPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${syncPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sync Control */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Sync Control</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Manual Sync
            </label>
            <div className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
              {lastSyncTime ? lastSyncTime.toLocaleString() : "Not triggered in this session"}
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Zoho CRM automatically pushes updates via webhooks. Use the button below to manually import pending visitors.
          </p>

          <button
            onClick={() => triggerSyncMutation.mutate()}
            disabled={triggerSyncMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
          >
            {triggerSyncMutation.isPending ? "Syncing..." : "Trigger Full Import"}
          </button>
        </div>
      </div>

      {/* Staging Visitors Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Pending Visitors ({status?.pending || 0})</h2>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => bulkImportMutation.mutate()}
                  disabled={bulkImportMutation.isPending}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Import Selected ({selectedIds.size})
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <input
            type="search"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === stagedVisitors?.visitors?.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Synced</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : stagedVisitors?.visitors?.length > 0 ? (
                stagedVisitors.visitors.map((visitor: StagingVisitor) => (
                  <tr key={visitor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(visitor.id)}
                        onChange={() => toggleSelect(visitor.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {visitor.firstName} {visitor.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {visitor.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {visitor.company || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {visitor.visitorType ? (
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {visitor.visitorType}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(visitor.syncedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (confirm("Import this visitor?")) {
                              importVisitorMutation.mutate(visitor.id);
                            }
                          }}
                          disabled={importVisitorMutation.isPending}
                          className="text-green-600 hover:text-green-700 text-xs font-medium disabled:opacity-50"
                        >
                          Import
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this staged record?")) {
                              deleteVisitorMutation.mutate(visitor.id);
                            }
                          }}
                          disabled={deleteVisitorMutation.isPending}
                          className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No pending visitors. All synced visitors have been imported!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {stagedVisitors && (
          <div className="px-6 py-3 flex items-center justify-between text-sm text-gray-500 border-t">
            <span>{stagedVisitors.total} total pending</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <span>Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={stagedVisitors.visitors?.length < 20}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          ℹ️ About Staging Database
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Visitor data from Zoho CRM arrives via webhooks in the <strong>staging database</strong></li>
          <li>Review each visitor record and their information before importing</li>
          <li>Import individually or use "Import Selected" to batch import reviewed visitors</li>
          <li>Once imported, visitors appear in the main Visitor Management System</li>
          <li>Zoho CRM webhook endpoint: <code className="bg-white px-1 rounded text-xs">POST /api/staging/sync</code></li>
        </ul>
      </div>
    </div>
  );
}
