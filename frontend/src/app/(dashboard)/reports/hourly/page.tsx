"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";

export default function HourlyReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const { data } = useQuery({
    queryKey: ["report-hourly", from, to],
    queryFn: () => api.get(`/reports/hourly?from=${from}&to=${to}`).then((r) => r.data),
  });

  const chartData = data
    ? Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        Entries: data.entries[h],
        Exits: data.exits[h],
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Hourly Traffic</h1>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Entries" fill="#22c55e" />
            <Bar dataKey="Exits" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
