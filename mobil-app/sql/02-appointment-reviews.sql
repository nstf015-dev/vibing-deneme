-- ============================================
-- 2. RANDEVU YORUMLARI
-- ============================================

CREATE TABLE IF NOT EXISTS appointment_reviews (
  appointment_id UUID PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointment_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_readable" ON appointment_reviews;
DROP POLICY IF EXISTS "only_author_can_upsert" ON appointment_reviews;
DROP POLICY IF EXISTS "only_author_can_update" ON appointment_reviews;

CREATE POLICY "reviews_readable" ON appointment_reviews
  FOR SELECT USING (true);

CREATE POLICY "only_author_can_upsert" ON appointment_reviews
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "only_author_can_update" ON appointment_reviews
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

