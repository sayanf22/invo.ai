-- Fix: Signature RLS policies to support session-based signatures (no document_id required)
-- Applied: 2026-04-27
-- Root cause: INSERT policy required document_id to match a document owned by the user,
-- but most sessions don't have a document_id. When document_id is null, the RLS check
-- d.id = NULL always fails → INSERT blocked → "Failed to create signature request"

-- INSERT policy: allow via document_id OR session_id
DROP POLICY IF EXISTS "Document owners can insert signatures" ON signatures;
DROP POLICY IF EXISTS "Users can insert signatures for their sessions" ON signatures;

CREATE POLICY "Users can insert signatures for their sessions" ON signatures
  FOR INSERT TO public
  WITH CHECK (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM documents d JOIN businesses b ON d.business_id = b.id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ))
  );

-- SELECT policy: allow via document_id, session_id, or public token
DROP POLICY IF EXISTS "Read signatures" ON signatures;

CREATE POLICY "Read signatures" ON signatures
  FOR SELECT TO public
  USING (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM documents d JOIN businesses b ON d.business_id = b.id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ))
    OR
    (token IS NOT NULL AND signed_at IS NULL)
  );

-- DELETE policy
DROP POLICY IF EXISTS "Document owners can delete signatures" ON signatures;
DROP POLICY IF EXISTS "Users can delete signatures for their sessions" ON signatures;

CREATE POLICY "Users can delete signatures for their sessions" ON signatures
  FOR DELETE TO public
  USING (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM documents d JOIN businesses b ON d.business_id = b.id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ))
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Update signatures" ON signatures;

CREATE POLICY "Update signatures" ON signatures
  FOR UPDATE TO public
  USING (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM documents d JOIN businesses b ON d.business_id = b.id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ))
    OR (token IS NOT NULL)
  )
  WITH CHECK (
    (document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM documents d JOIN businesses b ON d.business_id = b.id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    ))
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ))
    OR (token IS NOT NULL)
  );
