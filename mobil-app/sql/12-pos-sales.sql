-- ============================================
-- 12. POS SATIŞLARI
-- ============================================

CREATE TABLE IF NOT EXISTS pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  items JSONB NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_sales_read" ON pos_sales;
DROP POLICY IF EXISTS "pos_sales_insert" ON pos_sales;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "pos_sales_read" ON pos_sales
  FOR SELECT USING (
    auth.uid() = business_id 
    OR auth.uid() = customer_id
  );

CREATE POLICY "pos_sales_insert" ON pos_sales
  FOR INSERT WITH CHECK (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_pos_sales_business_date ON pos_sales(business_id, created_at);

