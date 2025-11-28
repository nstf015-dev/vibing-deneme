-- ============================================
-- 6. CRM - MÜŞTERİ ETİKETLERİ
-- ============================================

CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, customer_id, tag_name)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_tags_read" ON customer_tags;
DROP POLICY IF EXISTS "customer_tags_mutate" ON customer_tags;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "customer_tags_read" ON customer_tags
  FOR SELECT USING (
    auth.uid() = business_id
  );

CREATE POLICY "customer_tags_mutate" ON customer_tags
  FOR ALL USING (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_customer_tags_business_customer ON customer_tags(business_id, customer_id);

