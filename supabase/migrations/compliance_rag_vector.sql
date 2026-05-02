-- =====================================================
-- COMPLIANCE RAG VECTOR SUPPORT
-- Adds vector embedding column, HNSW index, and
-- semantic search function to compliance_knowledge table
-- Uses 1536 dimensions (text-embedding-3-large with
-- dimensions parameter) for HNSW compatibility
-- =====================================================

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Add embedding column (1536 dimensions - HNSW compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_knowledge'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE compliance_knowledge
    ADD COLUMN embedding vector(1536);
  END IF;
END
$$;

-- 2. HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_compliance_knowledge_embedding
ON compliance_knowledge
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Semantic search function (returns effective_date for date filtering)
CREATE OR REPLACE FUNCTION match_compliance_knowledge(
  query_embedding vector(1536),
  match_country text,
  match_document_type text,
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  country text,
  document_type text,
  category text,
  requirement_key text,
  requirement_value jsonb,
  description text,
  effective_date date,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.country,
    ck.document_type,
    ck.category,
    ck.requirement_key,
    ck.requirement_value,
    ck.description,
    ck.effective_date,
    (1 - (ck.embedding <=> query_embedding))::float AS similarity
  FROM compliance_knowledge ck
  WHERE ck.country = match_country
    AND ck.document_type = match_document_type
    AND ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
