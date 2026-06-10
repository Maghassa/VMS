"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Camera {
  id: string;
  name: string;
  location: string;
  online: boolean;
  lastSeen?: string;
}

export default function HealthPage() {
  const { data: cameras } = useQuery({
    queryKey: ["health-cameras"],
    queryFn: () => api.get("/health/cameras").then((r) => r.data.cameras as Camera[]),
    refetchInterval: 30_000,
  });

  const { data: aiStatus } = useQuery({
    queryKey: ["health-ai"],
    queryFn: () => api.get("/health/ai").then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Health</h1>

      {/* AI Engine */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">AI Engine</h2>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${aiStatus?.status === "running" ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm">{aiStatus?.status === "running" ? "Running" : "Unreachable"}</span>
          {aiStatus?.uptime_seconds && (
            <span className="text-xs text-gray-400">Uptime: {Math.round(aiStatus.uptime_seconds / 60)}min</span>
          )}
          {aiStatus?.frames_processed_today !== undefined && (
            <span className="text-xs text-gray-400">Frames today: {aiStatus.frames_processed_today}</span>
          )}
        </div>
      </div>

      {/* Cameras */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Cameras</h2>
        <div className="grid grid-cols-3 gap-3">
          {cameras?.map((c: Camera) => (
            <div key={c.id} className={`border rounded-lg p-3 ${c.online ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${c.online ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <p className="text-xs text-gray-500">{c.location}</p>
              <p className="text-xs text-gray-400 mt-1">
                {c.online ? "Online" : "Offline"}
                {c.lastSeen && ` · ${new Date(c.lastSeen).toLocaleTimeString()}`}
              </p>
            </div>
          ))}
          {cameras?.length === 0 && <p className="text-sm text-gray-400 col-span-3">No cameras configured</p>}
        </div>
      </div>
    </div>
  );
}
