"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cameras/live", label: "Live Cameras" },
  { href: "/cameras", label: "Camera Management" },
  { href: "/visitors", label: "Visitors" },
  { href: "/queue", label: "Queue", badge: true },
  { href: "/reports/daily", label: "Reports" },
  { href: "/health", label: "System Health" },
  { href: "/users", label: "User Management" },
  { href: "/settings/integrations", label: "CRM Integration" },
  { href: "/settings/crm", label: "CRM Sync" },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data } = useQuery({
    queryKey: ["queue-count"],
    queryFn: () => api.get("/queue?status=pending&limit=1").then((r) => r.data.total),
    refetchInterval: 30_000,
  });

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700">
        <span className="text-lg font-bold tracking-tight">Meydan VMS</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV.map((item) => {
          // Check if this nav item is a leaf node (multi-segment path like /cameras/live)
          const pathSegments = item.href.split('/').filter(Boolean);
          const isLeafNode = pathSegments.length > 1;

          // Check if current pathname has an exact match in NAV
          const hasExactMatch = NAV.some(nav => pathname === nav.href);

          // Active if:
          // 1. Exact match, OR
          // 2. Parent route match (startsWith) only if no exact match exists in NAV
          //    This prevents /cameras from highlighting when on /cameras/live
          const active = pathname === item.href ||
            (!isLeafNode && pathname.startsWith(item.href + "/") && !hasExactMatch);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                active ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && data > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{data}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-gray-700">
        <button
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
