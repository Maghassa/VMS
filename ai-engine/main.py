import os
import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.camera_manager import CameraManager
from app.face_engine import FaceEngine
from app.routes import router
from app import state

@asynccontextmanager
async def lifespan(app: FastAPI):
    state.face_engine = FaceEngine()
    state.face_engine.load_models()
    state.camera_manager = CameraManager(state.face_engine)
    await state.camera_manager.start_all()
    yield
    await state.camera_manager.stop_all()

app = FastAPI(title="VMS AI Engine", lifespan=lifespan)
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("AI_ENGINE_PORT", 8000)), workers=1)
