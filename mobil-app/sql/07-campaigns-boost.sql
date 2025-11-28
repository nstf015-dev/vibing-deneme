-- ============================================
-- 7. PAZARLAMA - KAMPANYALAR VE BOOST
-- ============================================

-- KAMPANYALAR
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50),
  discount_percentage DECIMAL(5,2),
  discount_amount DECIMAL(10,2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_audience JSONB,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_read" ON campaigns;
DROP POLICY IF EXISTS "campaigns_mutate" ON campaigns;

CREATE POLICY "campaigns_read" ON campaigns
  FOR SELECT USING (true);

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "campaigns_mutate" ON campaigns
  FOR ALL USING (
    auth.uid() = business_id
  );

-- BOOST SİSTEMİ
CREATE TABLE IF NOT EXISTS boost_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  boost_type VARCHAR(20) DEFAULT 'standard',
  duration_hours INTEGER DEFAULT 24,
  amount_paid DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boost_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boost_orders_read" ON boost_orders;
DROP POLICY IF EXISTS "boost_orders_insert" ON boost_orders;

CREATE POLICY "boost_orders_read" ON boost_orders
  FOR SELECT USING (true);

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "boost_orders_insert" ON boost_orders
  FOR INSERT WITH CHECK (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_campaigns_business_status ON campaigns(business_id, status);
CREATE INDEX IF NOT EXISTS idx_boost_orders_post ON boost_orders(post_id);
CREATE INDEX IF NOT EXISTS idx_boost_orders_status ON boost_orders(status);

