"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function DailyReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data } = useQuery({
    queryKey: ["report-daily", date],
    queryFn: () => api.get(`/reports/daily?date=${date}`).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Summary</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Visitors", value: data?.total },
          { label: "Unique Individuals", value: data?.uniqueVisitors },
          { label: "Avg Duration (min)", value: data?.avgDuration },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value ?? "—"}</p>
          </div>
        ))}
      </div>

      {data?.typeBreakdown && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Visitor Type Breakdown</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs uppercase border-b">
              <tr><th className="text-left py-2">Type</th><th className="text-right py-2">Count</th></tr>
            </thead>
            <tbody>
              {data.typeBreakdown.map((t: { type: string; count: number }) => (
                <tr key={t.type} className="border-b last:border-0">
                  <td className="py-2">{t.type}</td>
                  <td className="py-2 text-right font-medium">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
