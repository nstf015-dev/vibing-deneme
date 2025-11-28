-- ============================================
-- 3. FAVORİ İŞLETMELER VE BEKLEME LİSTESİ
-- ============================================

-- FAVORİ İŞLETMELER
CREATE TABLE IF NOT EXISTS favorite_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, business_id)
);

ALTER TABLE favorite_businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorite_read" ON favorite_businesses;
DROP POLICY IF EXISTS "favorite_mutate" ON favorite_businesses;

CREATE POLICY "favorite_read" ON favorite_businesses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorite_mutate" ON favorite_businesses
  FOR ALL USING (auth.uid() = user_id);

-- BEKLEME LİSTESİ
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  desired_date DATE NOT NULL,
  notes TEXT,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_read" ON waitlist_entries;
DROP POLICY IF EXISTS "waitlist_mutate" ON waitlist_entries;

CREATE POLICY "waitlist_read" ON waitlist_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "waitlist_mutate" ON waitlist_entries
  FOR ALL USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_waitlist_business_date ON waitlist_entries(business_id, desired_date);

