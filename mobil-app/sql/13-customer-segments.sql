-- ============================================
-- 13. MÜŞTERİ SEGMENTLERİ
-- ============================================

CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  segment_name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL,
  customer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_segments_read" ON customer_segments;
DROP POLICY IF EXISTS "customer_segments_mutate" ON customer_segments;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "customer_segments_read" ON customer_segments
  FOR SELECT USING (
    auth.uid() = business_id
  );

CREATE POLICY "customer_segments_mutate" ON customer_segments
  FOR ALL USING (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_customer_segments_business ON customer_segments(business_id);

