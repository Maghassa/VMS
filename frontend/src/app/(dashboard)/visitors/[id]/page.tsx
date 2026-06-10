"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  photoUrl?: string;
  visitorType?: { id: string; name: string };
  embeddingReady: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number };
}

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const visitorId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Visitor>>({});

  const { data: visitor, isLoading } = useQuery({
    queryKey: ["visitor", visitorId],
    queryFn: () =>
      api.get(`/visitors/${visitorId}`).then((r) => r.data),
  });

  // Update form data when visitor loads
  if (visitor && !formData.firstName) {
    setFormData(visitor);
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Visitor>) =>
      api.patch(`/visitors/${visitorId}`, data),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["visitor", visitorId] });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/visitors/${visitorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      router.push("/visitors");
    },
  });

  if (isLoading) {
    return <div className="p-6 text-center">Loading visitor details...</div>;
  }

  if (!visitor) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Visitor not found</p>
      </div>
    );
  }

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {visitor.firstName} {visitor.lastName}
          </h1>
          <p className="text-gray-600 mt-1">{visitor.company || "No company"}</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this visitor?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                Delete
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Photo & Status */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Photo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1">
          {visitor.photoUrl ? (
            <img
              src={visitor.photoUrl}
              alt={visitor.firstName}
              className="w-full aspect-square rounded-lg object-cover"
            />
          ) : (
            <div className="w-full aspect-square rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-4xl">
              📷
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Face Recognition Status</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  visitor.embeddingReady ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              <span className="font-medium text-gray-900">
                {visitor.embeddingReady ? "Ready for Recognition" : "Pending Face Scan"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Visitor Type</p>
            <p className="font-medium text-gray-900 mt-2">
              {visitor.visitorType?.name || "Not set"}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Sessions</p>
            <p className="font-medium text-gray-900 mt-2">
              {visitor._count?.sessions || 0} visits
            </p>
          </div>
        </div>
      </div>

      {/* Details Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.firstName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-gray-900">{visitor.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.lastName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-gray-900">{visitor.lastName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            {isEditing ? (
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-gray-900">{visitor.email || "—"}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-gray-900">{visitor.phone || "—"}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          {isEditing ? (
            <input
              type="text"
              value={formData.company || ""}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          ) : (
            <p className="text-gray-900">{visitor.company || "—"}</p>
          )}
        </div>

        <div className="pt-4 border-t text-xs text-gray-500">
          <p>Created: {new Date(visitor.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(visitor.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
