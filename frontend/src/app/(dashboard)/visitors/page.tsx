"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  photoUrl?: string;
  visitorType?: { name: string };
  embeddingReady: boolean;
  _count?: { sessions: number };
}

export default function VisitorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["visitors", debouncedSearch, page],
    queryFn: () =>
      api.get(`/visitors?name=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`).then((r) => r.data),
    placeholderData: (prev: unknown) => prev,
  });

  const totalPages = data?.total ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Visitors</h1>
        <div className="flex gap-2">
          <Link href="/visitors/bulk" className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition">Bulk Upload</Link>
          <Link href="/visitors/new" className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">+ Add Visitor</Link>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Visitor</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Face Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Loading visitors…</td></tr>
              )}
              {isError && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-red-500">Failed to load visitors. Check your connection and refresh.</td></tr>
              )}
              {!isLoading && !isError && data?.visitors?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    {debouncedSearch ? `No visitors match “${debouncedSearch}”` : "No visitors yet. Click “+ Add Visitor” to create one."}
                  </td>
                </tr>
              )}
              {data?.visitors?.map((v: Visitor) => (
                <tr
                  key={v.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/visitors/${v.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.photoUrl ? (
                        <img src={v.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                          {v.firstName?.[0] ?? "?"}{v.lastName?.[0] ?? ""}
                        </div>
                      )}
                      <span className="font-medium">{v.firstName} {v.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{v.company || "—"}</td>
                  <td className="px-4 py-3">
                    {v.visitorType && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{v.visitorType.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.embeddingReady ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {v.embeddingReady ? "Ready" : "Pending scan"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-500 border-t">
            <span>{data.total} visitor{data.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
