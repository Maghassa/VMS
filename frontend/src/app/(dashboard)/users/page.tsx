"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface User { id: string; email: string; fullName: string; isActive: boolean; createdAt: string; }
const MODULES = ["visitors", "queue", "cameras", "reports", "users", "settings"];
const ACTIONS = ["canView", "canCreate", "canEdit", "canDelete", "canExport"];

export default function UsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});

  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data.users as User[]),
  });

  const create = useMutation({
    mutationFn: () => api.post("/users", { ...form, permissions: perms }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowForm(false); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => setShowForm(true)} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg">+ Add User</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.map((u: User) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive && (
                    <button onClick={() => deactivate.mutate(u.id)} className="text-red-500 hover:underline text-xs">Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-4 max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-lg">Create User</h2>
            {["fullName", "email", "password"].map((f) => (
              <input
                key={f}
                type={f === "password" ? "password" : "text"}
                placeholder={f}
                value={(form as Record<string, string>)[f]}
                onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            ))}
            <div>
              <p className="text-sm font-medium mb-2">Permissions</p>
              <table className="w-full text-xs">
                <thead><tr><th className="text-left py-1">Module</th>{ACTIONS.map((a) => <th key={a} className="text-center">{a.replace("can","")}</th>)}</tr></thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m}>
                      <td className="py-1 capitalize">{m}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="text-center">
                          <input
                            type="checkbox"
                            checked={perms[m]?.[a] ?? false}
                            onChange={(e) => setPerms((p) => ({ ...p, [m]: { ...p[m], [a]: e.target.checked } }))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={() => create.mutate()} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">Create</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
