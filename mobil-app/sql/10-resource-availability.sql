-- ============================================
-- 10. KAYNAK YÖNETİMİ
-- ============================================

CREATE TABLE IF NOT EXISTS resource_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resource_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_availability_read" ON resource_availability;
DROP POLICY IF EXISTS "resource_availability_mutate" ON resource_availability;

CREATE POLICY "resource_availability_read" ON resource_availability
  FOR SELECT USING (true);

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "resource_availability_mutate" ON resource_availability
  FOR ALL USING (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_resource_availability_business_date ON resource_availability(business_id, date);

