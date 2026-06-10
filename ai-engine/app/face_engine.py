import os
import numpy as np
import cv2
from pathlib import Path
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.model_zoo import model_zoo
import logging

logger = logging.getLogger(__name__)

MODELS_DIR = Path(os.getenv("MODELS_DIR", "/app/models"))
CONFIRMED_THRESHOLD = 0.65
CANDIDATE_THRESHOLD = 0.40


class FaceEngine:
    def __init__(self):
        self.detector = None
        self.recogniser = None
        self._providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    def load_models(self):
        logger.info("Loading face detection model (SCRFD-10G)...")
        # InsightFace handles SCRFD detection + AdaFace recognition
        self.app = FaceAnalysis(
            name="buffalo_l",
            root=str(MODELS_DIR),
            providers=self._providers,
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("Face models loaded successfully")

    def detect_and_embed(self, frame: np.ndarray) -> list[dict]:
        """
        Returns list of dicts: {bbox, embedding, landmark}
        embedding is a 512-d L2-normalised numpy array.
        """
        faces = self.app.get(frame)
        results = []
        for face in faces:
            emb = face.normed_embedding  # Already L2-normalised 512-d
            results.append({
                "bbox": face.bbox.tolist(),
                "embedding": emb,
                "landmark": face.kps.tolist() if face.kps is not None else None,
                "det_score": float(face.det_score),
            })
        return results

    def embed_from_file(self, image_path: str) -> np.ndarray | None:
        """Generate embedding from a stored image file. Returns None if no face found."""
        img = cv2.imread(image_path)
        if img is None:
            logger.warning(f"Could not read image: {image_path}")
            return None
        faces = self.app.get(img)
        if not faces:
            return None
        # Use highest confidence face
        best = max(faces, key=lambda f: f.det_score)
        return best.normed_embedding

    @staticmethod
    def classify(similarity: float) -> str:
        if similarity >= CONFIRMED_THRESHOLD:
            return "confirmed"
        elif similarity >= CANDIDATE_THRESHOLD:
            return "candidate"
        return "unknown"
