-- ============================================================================
-- Context Documents RAG Migration
--
-- Adds user-uploaded "reference context" documents (previous contracts,
-- invoices, letterheads, etc.) that the AI retrieves on-demand to mirror how a
-- user writes their documents. Uses pgvector semantic search, mirroring the
-- existing compliance_knowledge RAG pattern (OpenAI text-embedding-3-large,
-- 1536 dimensions).
--
-- Persistence across linked documents: context is scoped to a `chain_id`
-- (document_sessions.chain_id) so an invoice → contract → proposal chain shares
-- the same uploaded reference material. It is ALSO scoped to the owning user so
-- RLS isolates every row.
--
-- Requires: pgvector extension (already enabled for compliance_knowledge).
-- ============================================================================

-- Ensure pgvector is available (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Parent table: one row per uploaded reference file ───────────────────────
CREATE TABLE IF NOT EXISTS context_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Chain scope: shared across all linked documents in a chain. NULL for
  -- standalone documents (falls back to session scope). uuid to match
  -- document_sessions.chain_id.
  chain_id       uuid,
  -- Session scope: the session the file was originally uploaded from. Kept for
  -- attribution + standalone (unlinked) documents.
  session_id     uuid REFERENCES document_sessions(id) ON DELETE SET NULL,
  file_key       text NOT NULL,          -- R2 object key (uploads/<user>/<uuid>.<ext>)
  file_name      text NOT NULL,          -- original display name (sanitized)
  mime_type      text NOT NULL,
  file_size      integer NOT NULL DEFAULT 0,
  -- Full extracted text of the document (used for preview + re-chunking).
  extracted_text text,
  token_count    integer NOT NULL DEFAULT 0,  -- estimated tokens of extracted_text
  chunk_count    integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'ready', 'failed')),
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS context_documents_user_id_idx  ON context_documents(user_id);
CREATE INDEX IF NOT EXISTS context_documents_chain_id_idx ON context_documents(chain_id);
CREATE INDEX IF NOT EXISTS context_documents_session_id_idx ON context_documents(session_id);

-- ── Child table: chunked, embedded pieces of each document ──────────────────
CREATE TABLE IF NOT EXISTS context_chunks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_document_id uuid NOT NULL REFERENCES context_documents(id) ON DELETE CASCADE,
  -- Denormalized for RLS + fast filtering (avoids a join on every match query).
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id            uuid,
  session_id          uuid,
  chunk_index         integer NOT NULL,
  content             text NOT NULL,
  token_count         integer NOT NULL DEFAULT 0,
  embedding           vector(1536),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS context_chunks_document_id_idx ON context_chunks(context_document_id);
CREATE INDEX IF NOT EXISTS context_chunks_user_id_idx     ON context_chunks(user_id);
CREATE INDEX IF NOT EXISTS context_chunks_chain_id_idx    ON context_chunks(chain_id);
CREATE INDEX IF NOT EXISTS context_chunks_session_id_idx  ON context_chunks(session_id);

-- HNSW index for fast cosine similarity search (matches compliance RAG config).
CREATE INDEX IF NOT EXISTS context_chunks_embedding_idx
  ON context_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── updated_at trigger (reuses shared function if present) ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS context_documents_updated_at ON context_documents;
CREATE TRIGGER context_documents_updated_at
  BEFORE UPDATE ON context_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Semantic search RPC ─────────────────────────────────────────────────────
-- Retrieves the most relevant chunks for a query embedding, scoped to the
-- calling user and (optionally) a chain or session. Security: the WHERE clause
-- enforces user ownership; RLS on the table is a second layer of defense.
CREATE OR REPLACE FUNCTION match_context_chunks(
  query_embedding    vector(1536),
  match_user_id      uuid,
  match_chain_id     uuid DEFAULT NULL,
  match_session_id   uuid DEFAULT NULL,
  match_threshold    float DEFAULT 0.2,
  match_count        int DEFAULT 6
)
RETURNS TABLE (
  id                  uuid,
  context_document_id uuid,
  file_name           text,
  chunk_index         integer,
  content             text,
  token_count         integer,
  similarity          float
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.context_document_id,
    cd.file_name,
    cc.chunk_index,
    cc.content,
    cc.token_count,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM context_chunks cc
  JOIN context_documents cd ON cd.id = cc.context_document_id
  WHERE cc.user_id = match_user_id
    AND cc.embedding IS NOT NULL
    AND cd.status = 'ready'
    AND (
      -- Chain scope: match the chain, the originating session, OR any session
      -- that belongs to the chain (covers context uploaded before linking,
      -- whose rows still have chain_id = NULL).
      (match_chain_id IS NOT NULL AND (
        cc.chain_id = match_chain_id
        OR cc.session_id = match_session_id
        OR cc.session_id IN (
          SELECT ds.id FROM document_sessions ds
          WHERE ds.chain_id = match_chain_id AND ds.user_id = match_user_id
        )
      ))
      -- Otherwise fall back to session scope
      OR (match_chain_id IS NULL AND match_session_id IS NOT NULL AND cc.session_id = match_session_id)
      -- If neither scope provided, search all of the user's chunks
      OR (match_chain_id IS NULL AND match_session_id IS NULL)
    )
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE context_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_chunks    ENABLE ROW LEVEL SECURITY;

-- context_documents policies: user owns their rows
DROP POLICY IF EXISTS "context_documents_select_own" ON context_documents;
CREATE POLICY "context_documents_select_own" ON context_documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_documents_insert_own" ON context_documents;
CREATE POLICY "context_documents_insert_own" ON context_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_documents_update_own" ON context_documents;
CREATE POLICY "context_documents_update_own" ON context_documents
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_documents_delete_own" ON context_documents;
CREATE POLICY "context_documents_delete_own" ON context_documents
  FOR DELETE USING (auth.uid() = user_id);

-- context_chunks policies: user owns their rows
DROP POLICY IF EXISTS "context_chunks_select_own" ON context_chunks;
CREATE POLICY "context_chunks_select_own" ON context_chunks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_chunks_insert_own" ON context_chunks;
CREATE POLICY "context_chunks_insert_own" ON context_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_chunks_delete_own" ON context_chunks;
CREATE POLICY "context_chunks_delete_own" ON context_chunks
  FOR DELETE USING (auth.uid() = user_id);
