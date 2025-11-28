-- ============================================
-- 9. PERSONEL VARDİYALARI
-- ============================================

CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, shift_date, start_time)
);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_shifts_read" ON staff_shifts;
DROP POLICY IF EXISTS "staff_shifts_mutate" ON staff_shifts;

CREATE POLICY "staff_shifts_read" ON staff_shifts
  FOR SELECT USING (true);

-- NOT: business_id kolonu var, direkt kullanabiliriz
-- staff tablosunda user_id kolonu olabilir, kontrol et
CREATE POLICY "staff_shifts_mutate" ON staff_shifts
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM staff WHERE id = staff_id
    ) OR auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_date ON staff_shifts(staff_id, shift_date);

