"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function BulkUploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setUploadProgress(0);
      return api.post("/visitors/bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      setTimeout(() => {
        router.push("/visitors");
      }, 2000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Failed to upload file");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setError("");
    uploadMutation.mutate(formData);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Bulk Upload Visitors</h1>
        <p className="text-gray-600 mt-1">Import multiple visitors at once from a CSV or Excel file</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          ✓ File uploaded successfully! Redirecting...
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File (CSV or Excel)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
              disabled={uploadMutation.isPending}
              className="w-full"
            />
            {file && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Selected: {file.name}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Supported formats: CSV, XLSX, XLS
          </p>
        </div>

        {/* Template Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 File Format</h3>
          <p className="text-sm text-blue-800 mb-3">Your file should have these columns:</p>
          <div className="text-xs text-blue-700 space-y-1 font-mono">
            <p>• firstName (required)</p>
            <p>• lastName (required)</p>
            <p>• email</p>
            <p>• phone</p>
            <p>• company</p>
            <p>• visitorType (Employee, Customer, Partner, etc.)</p>
          </div>
        </div>

        {/* Progress Bar */}
        {uploadMutation.isPending && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Uploading...</p>
              <p className="text-sm text-gray-600">{uploadProgress}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-6 border-t">
          <button
            type="submit"
            disabled={uploadMutation.isPending || !file}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload File"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Example */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Example CSV Format</h3>
        <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-auto">
          <pre>{`firstName,lastName,email,phone,company,visitorType
John,Doe,john@acme.com,+971501234567,Acme Corp,Customer
Jane,Smith,jane@example.com,+971509876543,Tech Inc,Partner
Bob,Johnson,bob@test.com,,Global Co,Guest`}</pre>
        </div>
      </div>
    </div>
  );
}
