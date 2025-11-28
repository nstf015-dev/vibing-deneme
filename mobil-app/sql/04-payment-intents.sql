-- ============================================
-- 4. ÖDEME İŞLEMLERİ
-- ============================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TRY',
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_intents_read" ON payment_intents;
DROP POLICY IF EXISTS "payment_intents_insert" ON payment_intents;
DROP POLICY IF EXISTS "payment_intents_update" ON payment_intents;

-- NOT: business_id kolonu var, direkt kullanabiliriz
CREATE POLICY "payment_intents_read" ON payment_intents
  FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() = business_id
  );

CREATE POLICY "payment_intents_insert" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payment_intents_update" ON payment_intents
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_business ON payment_intents(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);

