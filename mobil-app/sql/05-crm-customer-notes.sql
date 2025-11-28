-- ============================================
-- 5. CRM - MÜŞTERİ NOTLARI
-- ============================================

CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  tags TEXT[],
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_notes_read" ON customer_notes;
DROP POLICY IF EXISTS "customer_notes_mutate" ON customer_notes;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "customer_notes_read" ON customer_notes
  FOR SELECT USING (
    auth.uid() = business_id 
    OR auth.uid() = created_by
  );

CREATE POLICY "customer_notes_mutate" ON customer_notes
  FOR ALL USING (
    auth.uid() = business_id 
    OR auth.uid() = created_by
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_customer_notes_business_customer ON customer_notes(business_id, customer_id);

