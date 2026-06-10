"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Camera {
  id: string;
  name: string;
  location?: string;
  role?: string;
  rtspUrl: string;
  isActive: boolean;
  createdAt: string;
}

export default function CamerasPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    role: "",
    rtspUrl: "",
  });
  const [testResult, setTestResult] = useState<{ id: string; message: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.get("/cameras").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (newCamera: typeof formData) =>
      api.post("/cameras", newCamera).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      setFormData({ name: "", location: "", role: "", rtspUrl: "" });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updatedCamera: typeof formData) =>
      api.patch(`/cameras/${editId}`, updatedCamera).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      setFormData({ name: "", location: "", role: "", rtspUrl: "" });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cameras/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/cameras/${id}/test`, {}),
    onSuccess: (_, id) => {
      setTestResult({ id, message: "Connection successful!" });
      setTimeout(() => setTestResult(null), 3000);
    },
    onError: () => {
      setTestResult({ id: editId || "", message: "Connection failed" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rtspUrl) {
      alert("Name and RTSP URL are required");
      return;
    }

    if (editId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (camera: Camera) => {
    setEditId(camera.id);
    setFormData({
      name: camera.name,
      location: camera.location || "",
      role: camera.role || "",
      rtspUrl: camera.rtspUrl,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setFormData({ name: "", location: "", role: "", rtspUrl: "" });
  };

  if (isLoading) return <div className="p-6">Loading cameras...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Camera Management</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Camera
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editId ? "Edit Camera" : "Add New Camera"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Camera Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Entry Gate"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Building A, Main Entrance"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a role</option>
                  <option value="entrance">Entrance</option>
                  <option value="exit">Exit</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="security">Security</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RTSP URL *
              </label>
              <input
                type="text"
                value={formData.rtspUrl}
                onChange={(e) => setFormData({ ...formData, rtspUrl: e.target.value })}
                placeholder="rtsp://username:password@camera-ip:554/stream"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                RTSP stream URL format: rtsp://[user:pass@]host:port/stream
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {editId ? "Update Camera" : "Add Camera"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.cameras?.length > 0 ? (
              data.cameras.map((camera: Camera) => (
                <tr key={camera.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{camera.name}</td>
                  <td className="px-4 py-3 text-gray-500">{camera.location || "—"}</td>
                  <td className="px-4 py-3">
                    {camera.role ? (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full capitalize">
                        {camera.role}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        camera.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {camera.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(camera)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Deactivate this camera?")) {
                            deleteMutation.mutate(camera.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                      <button
                        onClick={() => testMutation.mutate(camera.id)}
                        disabled={testMutation.isPending}
                        className="text-green-600 hover:text-green-700 text-xs font-medium disabled:opacity-50"
                      >
                        Test
                      </button>
                      {testResult?.id === camera.id && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            testResult.message.includes("successful")
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {testResult.message}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No cameras configured. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
