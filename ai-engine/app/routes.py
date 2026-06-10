import os
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from . import state
from .database import save_embedding
from .face_engine import FaceEngine

router = APIRouter()

start_time = time.time()
frames_processed = 0


class EmbedRequest(BaseModel):
    visitor_id: str
    image_path: str


class TestCameraRequest(BaseModel):
    rtsp_url: str


@router.get("/health")
def health():
    return {
        "status": "running",
        "uptime_seconds": round(time.time() - start_time),
        "frames_processed_today": frames_processed,
        "models_loaded": state.face_engine is not None,
    }


@router.post("/visitor/embed")
async def embed_visitor(req: EmbedRequest):
    """Generate and store face embedding for a visitor photo."""
    if state.face_engine is None:
        raise HTTPException(503, "Face engine not ready")

    # Resolve storage path
    image_path = req.image_path
    if image_path.startswith("/storage"):
        storage = os.getenv("STORAGE_PATH", "/storage")
        image_path = storage + image_path[len("/storage"):]

    import asyncio
    embedding = await asyncio.get_event_loop().run_in_executor(
        None, state.face_engine.embed_from_file, image_path
    )

    if embedding is None:
        return {"ok": False, "reason": "no_face_detected"}

    saved = save_embedding(req.visitor_id, embedding)
    return {"ok": saved}


@router.post("/camera/test")
async def test_camera(req: TestCameraRequest):
    """Test if an RTSP stream is reachable."""
    import cv2
    import asyncio

    def _test():
        cap = cv2.VideoCapture(req.rtsp_url, cv2.CAP_FFMPEG)
        ok = cap.isOpened()
        cap.release()
        return ok

    reachable = await asyncio.get_event_loop().run_in_executor(None, _test)
    return {"ok": reachable, "rtsp_url": req.rtsp_url}


@router.post("/cameras/reload")
async def reload_cameras():
    """Reload camera list from database."""
    if state.camera_manager is None:
        raise HTTPException(503, "Camera manager not ready")
    await state.camera_manager.reload_cameras()
    return {"ok": True}
