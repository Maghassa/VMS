import os
import psycopg2
import numpy as np
from pgvector.psycopg2 import register_vector
import logging

logger = logging.getLogger(__name__)


def get_connection():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    register_vector(conn)
    return conn


def search_embedding(embedding: np.ndarray, top_k: int = 5) -> list[dict]:
    """Cosine similarity search using pgvector HNSW index."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, first_name, last_name, 1 - (face_embedding <=> %s::vector) AS similarity
                FROM visitors
                WHERE embedding_ready = true AND face_embedding IS NOT NULL
                ORDER BY face_embedding <=> %s::vector
                LIMIT %s
                """,
                (embedding.tolist(), embedding.tolist(), top_k),
            )
            rows = cur.fetchall()
            return [
                {"visitor_id": str(r[0]), "first_name": r[1], "last_name": r[2], "similarity": float(r[3])}
                for r in rows
            ]
    finally:
        conn.close()


def save_embedding(visitor_id: str, embedding: np.ndarray) -> bool:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE visitors SET face_embedding = %s::vector, embedding_ready = true WHERE id = %s",
                (embedding.tolist(), visitor_id),
            )
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Failed to save embedding for {visitor_id}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_active_cameras() -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, rtsp_url, role FROM cameras WHERE is_active = true")
            rows = cur.fetchall()
            return [{"id": str(r[0]), "name": r[1], "rtsp_url": r[2], "role": r[3]} for r in rows]
    finally:
        conn.close()
