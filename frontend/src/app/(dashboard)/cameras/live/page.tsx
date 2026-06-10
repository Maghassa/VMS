"use client";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

interface Camera {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  rtspUrl: string;
}

// Camera feed card shows a placeholder for RTSP stream
function CameraCard({
  camera,
  index,
}: {
  camera: Camera;
  index: number;
}) {
  const [status, setStatus] = useState<"online" | "offline" | "connecting">("connecting");
  const statusColor =
    status === "online"
      ? "bg-green-500"
      : status === "offline"
        ? "bg-red-500"
        : "bg-yellow-500";
  const statusLabel = status === "connecting" ? "Connecting..." : status;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      {/* Video Feed Area */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 aspect-video flex items-center justify-center">
        {/* Placeholder for RTSP stream */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <div className="text-5xl mb-2">📹</div>
          <p className="text-sm font-medium">{camera.name}</p>
          <p className="text-xs text-gray-500 mt-2">{camera.location}</p>
          <p className="text-xs text-gray-600 mt-4">RTSP Stream</p>
          <p className="text-xs text-gray-600">{camera.rtspUrl.substring(0, 30)}...</p>
        </div>

        {/* Connection Status Overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded">
          <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-xs text-white font-medium capitalize">{statusLabel}</span>
        </div>

        {/* Camera Number Badge */}
        <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
          Camera {index + 1}
        </div>
      </div>

      {/* Camera Info Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">{camera.name}</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor} text-white`}>
            {status === "connecting" ? "Connecting" : status === "online" ? "Live" : "Offline"}
          </span>
        </div>
        <p className="text-xs text-gray-500">{camera.location}</p>
      </div>
    </div>
  );
}

export default function LiveCamerasPage() {
  const { data: cameras, isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.get("/cameras").then((r) => r.data.cameras as Camera[]),
  });

  const activeCameras = cameras?.filter((c) => c.isActive) || [];

  // Show exactly 4 camera boxes (even if empty)
  const displayCameras = [...activeCameras];
  while (displayCameras.length < 4) {
    displayCameras.push({
      id: `empty-${displayCameras.length}`,
      name: `Camera ${displayCameras.length + 1}`,
      location: "Not Configured",
      isActive: false,
      rtspUrl: "rtsp://...",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live Cameras</h1>
        <p className="text-gray-600 mt-1">
          Real-time video feeds from {activeCameras.length} connected camera{activeCameras.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Status Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-sm text-gray-600">
              <strong>{activeCameras.length}</strong> Online
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-300"></span>
            <span className="text-sm text-gray-600">
              <strong>{4 - activeCameras.length}</strong> Offline
            </span>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            Last updated: just now
          </div>
        </div>
      </div>

      {/* Camera Grid - 2x2 Layout */}
      <div className="grid grid-cols-2 gap-6">
        {isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-200 rounded-xl aspect-video animate-pulse"
              />
            ))}
          </>
        ) : (
          displayCameras.slice(0, 4).map((camera, index) => (
            <CameraCard key={camera.id} camera={camera} index={index} />
          ))
        )}
      </div>

      {/* Empty State Info */}
      {activeCameras.length === 0 && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-sm text-blue-900">
            No cameras configured yet.{" "}
            <a href="/cameras" className="font-semibold hover:underline">
              Go to Camera Management
            </a>{" "}
            to add cameras.
          </p>
        </div>
      )}

      {/* Features Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl mb-2">🎬</div>
          <h3 className="text-sm font-semibold text-gray-900">Real-time Streaming</h3>
          <p className="text-xs text-gray-600 mt-1">RTSP streams display live</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="text-sm font-semibold text-gray-900">Face Detection</h3>
          <p className="text-xs text-gray-600 mt-1">Real-time recognition</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl mb-2">⚙️</div>
          <h3 className="text-sm font-semibold text-gray-900">Camera Management</h3>
          <p className="text-xs text-gray-600 mt-1">
            <a href="/cameras" className="text-blue-600 hover:underline">
              Configure cameras
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
