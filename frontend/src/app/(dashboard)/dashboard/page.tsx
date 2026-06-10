"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDistanceToNow } from "date-fns";

interface ActiveSession {
  id: string;
  entryTime: string;
  visitor: { id: string; firstName: string; lastName: string; company: string; photoUrl?: string; visitorType?: { name: string } };
}

interface Event {
  type: "entry" | "exit";
  name: string;
  time: string;
  cameraId: string;
}

interface Detection {
  name: string;
  visitCount: number;
  lastVisit: string | null;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [toasts, setToasts] = useState<Detection[]>([]);

  const { data: active, refetch: refetchActive } = useQuery({
    queryKey: ["sessions-active"],
    queryFn: () => api.get("/sessions/active").then((r) => r.data.sessions as ActiveSession[]),
    refetchInterval: 60_000,
  });

  const { data: daily } = useQuery({
    queryKey: ["report-daily"],
    queryFn: () => api.get(`/reports/daily?date=${new Date().toISOString().split("T")[0]}`).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: queueCount } = useQuery({
    queryKey: ["queue-count"],
    queryFn: () => api.get("/queue?status=pending&limit=1").then((r) => r.data.total as number),
    refetchInterval: 15_000,
  });

  useWebSocket({
    entry: (data: unknown) => {
      const d = data as { name: string; entryTime: string; cameraId: string };
      setEvents((prev) => [{ type: "entry", name: d.name, time: d.entryTime, cameraId: d.cameraId }, ...prev.slice(0, 49)]);
      refetchActive();
    },
    exit: (data: unknown) => {
      const d = data as { name: string; exitTime: string; cameraId: string };
      setEvents((prev) => [{ type: "exit", name: d.name, time: d.exitTime, cameraId: d.cameraId }, ...prev.slice(0, 49)]);
      refetchActive();
    },
    detection: (data: unknown) => {
      const d = data as Detection;
      setToasts((prev) => [d, ...prev].slice(0, 3));
      setTimeout(() => setToasts((prev) => prev.slice(1)), 5000);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Inside Now", value: active?.length ?? "—" },
          { label: "Total Today", value: daily?.total ?? "—" },
          { label: "Unique Today", value: daily?.uniqueVisitors ?? "—" },
          { label: "Queue Pending", value: queueCount ?? "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Live visitor log */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Visitors Inside Now</h2>
          <div className="space-y-2 max-h-96 overflow-auto">
            {active?.length === 0 && <p className="text-sm text-gray-400">No visitors inside</p>}
            {active?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                {s.visitor.photoUrl ? (
                  <img src={s.visitor.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                    {s.visitor.firstName[0]}{s.visitor.lastName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.visitor.firstName} {s.visitor.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{s.visitor.company || s.visitor.visitorType?.name}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(s.entryTime), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Event feed */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Live Event Feed</h2>
          <div className="space-y-2 max-h-96 overflow-auto">
            {events.length === 0 && <p className="text-sm text-gray-400">No events yet</p>}
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.type === "entry" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm flex-1">{e.name}</span>
                <span className={`text-xs font-medium ${e.type === "entry" ? "text-green-600" : "text-red-600"}`}>
                  {e.type === "entry" ? "IN" : "OUT"}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(e.time), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detection toasts */}
      <div className="fixed bottom-6 right-6 space-y-2 z-50">
        {toasts.map((t, i) => (
          <div key={i} className="bg-gray-900 text-white rounded-lg px-4 py-3 shadow-lg min-w-[220px]">
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-gray-300 mt-0.5">
              Visit #{t.visitCount}{t.lastVisit ? ` · last ${formatDistanceToNow(new Date(t.lastVisit), { addSuffix: true })}` : " · first visit"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
