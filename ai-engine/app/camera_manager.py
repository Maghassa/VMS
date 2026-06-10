import logging
from .camera_worker import CameraWorker
from .database import get_active_cameras
from .face_engine import FaceEngine

logger = logging.getLogger(__name__)


class CameraManager:
    def __init__(self, face_engine: FaceEngine):
        self.face_engine = face_engine
        self.workers: dict[str, CameraWorker] = {}

    async def start_all(self):
        cameras = get_active_cameras()
        logger.info(f"Starting {len(cameras)} camera workers...")
        for cam in cameras:
            worker = CameraWorker(cam, self.face_engine)
            self.workers[cam["id"]] = worker
            await worker.start()
        logger.info("All camera workers started")

    async def stop_all(self):
        for worker in self.workers.values():
            await worker.stop()
        self.workers.clear()

    async def reload_cameras(self):
        """Hot-reload cameras from database (called after camera config changes)."""
        await self.stop_all()
        await self.start_all()
