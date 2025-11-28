-- ============================================
-- 11. STOK YÖNETİMİ
-- ============================================

CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  unit VARCHAR(20),
  low_stock_threshold INTEGER DEFAULT 10,
  cost_per_unit DECIMAL(10,2),
  supplier_info JSONB,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_items_read" ON stock_items;
DROP POLICY IF EXISTS "stock_items_mutate" ON stock_items;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "stock_items_read" ON stock_items
  FOR SELECT USING (
    auth.uid() = business_id
  );

CREATE POLICY "stock_items_mutate" ON stock_items
  FOR ALL USING (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_stock_items_business ON stock_items(business_id);

