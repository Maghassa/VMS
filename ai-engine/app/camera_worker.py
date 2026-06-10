import asyncio
import cv2
import numpy as np
import httpx
import logging
from datetime import datetime, timezone
from .face_engine import FaceEngine, CONFIRMED_THRESHOLD, CANDIDATE_THRESHOLD
from .database import search_embedding, save_embedding

logger = logging.getLogger(__name__)

API_URL = None
INTERNAL_TOKEN = None

import os
API_URL = os.getenv("API_URL", "http://api:4000")
INTERNAL_TOKEN = os.getenv("STAGING_API_TOKEN", "")

FPS_TARGET = 4       # Process N frames per second
RECONNECT_DELAY = 30  # Seconds before retry on stream drop


class CameraWorker:
    def __init__(self, camera: dict, face_engine: FaceEngine):
        self.camera = camera
        self.face_engine = face_engine
        self._running = False
        self._task = None
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(detectShadows=False)

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    async def _run_loop(self):
        while self._running:
            try:
                await self._process_stream()
            except Exception as e:
                logger.error(f"Camera {self.camera['name']} error: {e}")
                await self._send_heartbeat("error")
                await asyncio.sleep(RECONNECT_DELAY)

    async def _process_stream(self):
        cap = cv2.VideoCapture(self.camera["rtsp_url"], cv2.CAP_FFMPEG)
        if not cap.isOpened():
            raise ConnectionError(f"Cannot open RTSP stream: {self.camera['rtsp_url']}")

        logger.info(f"Camera {self.camera['name']} connected")
        await self._send_heartbeat("online")

        frame_interval = 1.0 / FPS_TARGET
        last_time = 0.0

        try:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    raise ConnectionError("Stream ended or dropped")

                now = asyncio.get_event_loop().time()
                if now - last_time < frame_interval:
                    await asyncio.sleep(0.01)
                    continue
                last_time = now

                # Motion gate — skip static frames
                fg_mask = self._bg_subtractor.apply(frame)
                if cv2.countNonZero(fg_mask) < 500:
                    continue

                # Run detection in thread pool to not block event loop
                faces = await asyncio.get_event_loop().run_in_executor(
                    None, self.face_engine.detect_and_embed, frame
                )

                for face in faces:
                    await self._handle_face(face, frame)

        finally:
            cap.release()
            await self._send_heartbeat("offline")

    async def _handle_face(self, face: dict, frame: np.ndarray):
        embedding = face["embedding"]
        candidates = await asyncio.get_event_loop().run_in_executor(
            None, search_embedding, embedding, 5
        )

        best = candidates[0] if candidates else None
        similarity = best["similarity"] if best else 0.0
        visitor_id = best["visitor_id"] if best and similarity >= CANDIDATE_THRESHOLD else None

        # Crop face snapshot
        bbox = face["bbox"]
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        face_crop = frame[max(0, y1):y2, max(0, x1):x2]
        snapshot_path = await self._save_snapshot(face_crop) if face_crop.size > 0 else None

        payload = {
            "visitorId": visitor_id,
            "cameraId": self.camera["id"],
            "similarity": similarity,
            "faceSnapshot": snapshot_path,
            "detectedAt": datetime.now(timezone.utc).isoformat(),
        }

        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{API_URL}/api/detection/event",
                json=payload,
                headers={"x-internal-token": INTERNAL_TOKEN},
            )

    async def _save_snapshot(self, face_crop: np.ndarray) -> str | None:
        import os, uuid
        storage = os.getenv("STORAGE_PATH", "/storage")
        path = f"{storage}/snapshots/{uuid.uuid4()}.jpg"
        cv2.imwrite(path, face_crop)
        return f"/storage/snapshots/{os.path.basename(path)}"

    async def _send_heartbeat(self, status: str):
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                await client.post(
                    f"{API_URL}/api/detection/heartbeat",
                    json={"cameraId": self.camera["id"], "status": status},
                    headers={"x-internal-token": INTERNAL_TOKEN},
                )
        except Exception:
            pass
