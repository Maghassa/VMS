-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index for fast cosine similarity search on face embeddings
CREATE INDEX IF NOT EXISTS visitors_face_embedding_hnsw_idx
ON visitors
USING hnsw (face_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
