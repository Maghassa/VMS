"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDistanceToNow } from "date-fns";

interface QueueEntry {
  id: string;
  faceSnapshot?: string;
  detectedAt: string;
  status: string;
  camera?: { name: string };
  dismissReason?: string;
}

export default function QueuePage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<QueueEntry | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", company: "" });
  const [dismissReason, setDismissReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  function openEntry(e: QueueEntry) {
    setSelected(e);
    setForm({ firstName: "", lastName: "", phone: "", email: "", company: "" });
    setDismissReason("");
    setModalError("");
  }

  const { data, refetch } = useQuery({
    queryKey: ["queue"],
    queryFn: () => api.get("/queue?status=pending").then((r) => r.data),
  });

  useWebSocket({
    queue_new: () => { refetch(); qc.invalidateQueries({ queryKey: ["queue-count"] }); },
    queue_update: () => { refetch(); qc.invalidateQueries({ queryKey: ["queue-count"] }); },
  });

  async function complete() {
    if (!selected) return;
    setSubmitting(true);
    setModalError("");
    try {
      await api.patch(`/queue/${selected.id}/complete`, form);
      setSelected(null);
      refetch();
    } catch (err) {
      setModalError(apiErrorMessage(err, "Failed to save visitor"));
    } finally {
      setSubmitting(false);
    }
  }

  async function dismiss() {
    if (!selected || !dismissReason) return;
    setModalError("");
    try {
      await api.post(`/queue/${selected.id}/dismiss`, { reason: dismissReason });
      setSelected(null);
      refetch();
    } catch (err) {
      setModalError(apiErrorMessage(err, "Failed to dismiss entry"));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Unrecognised Queue <span className="text-base font-normal text-gray-500">({data?.total ?? 0} pending)</span></h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Face</th>
              <th className="px-4 py-3 text-left">Detected</th>
              <th className="px-4 py-3 text-left">Camera</th>
              <th className="px-4 py-3 text-left">In Queue</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.entries?.map((e: QueueEntry) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {e.faceSnapshot ? (
                    <img src={e.faceSnapshot} className="w-10 h-10 rounded object-cover" alt="Face" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">?</div>
                  )}
                </td>
                <td className="px-4 py-3">{new Date(e.detectedAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{e.camera?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{formatDistanceToNow(new Date(e.detectedAt))}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openEntry(e)}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    Complete
                  </button>
                </td>
              </tr>
            ))}
            {data?.entries?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No pending entries</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Complete modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Complete Record</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">x</button>
            </div>
            {selected.faceSnapshot && (
              <img src={selected.faceSnapshot} className="w-24 h-24 rounded object-cover mx-auto" alt="" />
            )}
            {modalError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{modalError}</p>
            )}
            {["firstName", "lastName", "phone", "email", "company"].map((field) => (
              <input
                key={field}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(form as Record<string, string>)[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            ))}
            <div className="flex gap-2">
              <button
                onClick={complete}
                disabled={!form.firstName || !form.lastName || submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {submitting ? "Saving…" : "Save Visitor"}
              </button>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">Dismiss instead</p>
              <div className="flex gap-2">
                <select
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Select reason...</option>
                  <option value="duplicate_detection">Duplicate detection</option>
                  <option value="poor_image_quality">Poor image quality</option>
                  <option value="not_a_visitor">Not a visitor</option>
                  <option value="other">Other</option>
                </select>
                <button onClick={dismiss} disabled={!dismissReason} className="px-3 py-1.5 border rounded-lg text-sm text-red-600 disabled:opacity-40">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
