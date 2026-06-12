"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";

interface User { id: string; email: string; fullName: string; isActive: boolean; createdAt: string; }
const MODULES = ["visitors", "queue", "cameras", "reports", "users", "settings"];
const ACTIONS = ["canView", "canCreate", "canEdit", "canDelete", "canExport"];

const EMPTY_FORM = { email: "", password: "", fullName: "" };

function passwordIssues(pwd: string): string[] {
  const issues: string[] = [];
  if (pwd.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(pwd)) issues.push("1 uppercase letter");
  if (!/\d/.test(pwd)) issues.push("1 number");
  return issues;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [formError, setFormError] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false, fullName: false });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data.users as User[]),
  });

  const create = useMutation({
    mutationFn: () => api.post("/users", { ...form, permissions: perms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      closeForm();
    },
    onError: (err) => setFormError(apiErrorMessage(err, "Failed to create user")),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => alert(apiErrorMessage(err, "Failed to deactivate user")),
  });

  const pwdIssues = passwordIssues(form.password);
  const emailInvalid = form.email.length > 0 && !isValidEmail(form.email);
  const formValid = form.fullName.trim().length > 0 && isValidEmail(form.email) && pwdIssues.length === 0;

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setPerms({});
    setFormError("");
    setTouched({ email: false, password: false, fullName: false });
  }

  function handleCreate() {
    setTouched({ email: true, password: true, fullName: true });
    if (!formValid) {
      setFormError("Please fix the highlighted fields before creating the user.");
      return;
    }
    setFormError("");
    create.mutate();
  }

  function toggleAllForModule(m: string, value: boolean) {
    setPerms((p) => ({ ...p, [m]: Object.fromEntries(ACTIONS.map((a) => [a, value])) }));
  }

  function toggleEverything(value: boolean) {
    setPerms(Object.fromEntries(MODULES.map((m) => [m, Object.fromEntries(ACTIONS.map((a) => [a, value]))])));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => setShowForm(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition">+ Add User</button>
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
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading users…</td></tr>
            )}
            {isError && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-red-500">Failed to load users. Check your connection and refresh.</td></tr>
            )}
            {!isLoading && !isError && data?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users yet. Click “+ Add User” to create one.</td></tr>
            )}
            {data?.map((u: User) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive && (
                    <button
                      onClick={() => { if (confirm(`Deactivate ${u.fullName}? They will no longer be able to sign in.`)) deactivate.mutate(u.id); }}
                      disabled={deactivate.isPending}
                      className="text-red-500 hover:underline text-xs disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Create User</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{formError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Magid Hassan"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${touched.fullName && !form.fullName.trim() ? "border-red-400" : "border-gray-300"}`}
              />
              {touched.fullName && !form.fullName.trim() && (
                <p className="text-xs text-red-600 mt-1">Full name is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                placeholder="user@company.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${touched.email && (emailInvalid || !form.email) ? "border-red-400" : "border-gray-300"}`}
              />
              {touched.email && !form.email && <p className="text-xs text-red-600 mt-1">Email is required</p>}
              {touched.email && emailInvalid && <p className="text-xs text-red-600 mt-1">Enter a valid email address (e.g. name@company.com)</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${touched.password && pwdIssues.length > 0 ? "border-red-400" : "border-gray-300"}`}
              />
              {form.password.length > 0 && pwdIssues.length > 0 && (
                <p className="text-xs text-red-600 mt-1">Password needs: {pwdIssues.join(", ")}</p>
              )}
              {touched.password && form.password.length === 0 && (
                <p className="text-xs text-red-600 mt-1">Password is required</p>
              )}
              {form.password.length > 0 && pwdIssues.length === 0 && (
                <p className="text-xs text-green-600 mt-1">✓ Strong password</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Permissions</p>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={() => toggleEverything(true)} className="text-blue-600 hover:underline">Select all</button>
                  <button type="button" onClick={() => toggleEverything(false)} className="text-gray-500 hover:underline">Clear all</button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1">Module</th>
                    {ACTIONS.map((a) => <th key={a} className="text-center">{a.replace("can", "")}</th>)}
                    <th className="text-center">All</th>
                  </tr>
                </thead>
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
                      <td className="text-center">
                        <button type="button" onClick={() => toggleAllForModule(m, !ACTIONS.every((a) => perms[m]?.[a]))} className="text-blue-600 hover:underline">
                          {ACTIONS.every((a) => perms[m]?.[a]) ? "None" : "All"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={create.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
              >
                {create.isPending ? "Creating…" : "Create"}
              </button>
              <button onClick={closeForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
