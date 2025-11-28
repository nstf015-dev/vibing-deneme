-- ============================================
-- COMPREHENSIVE DATABASE SCHEMA
-- VibeBeauty Super App - All Features
-- ============================================

-- ============================================
-- 1. SOCIAL LAYER ENHANCEMENTS
-- ============================================

-- POST-SERVICE LINK (Book This Look)
CREATE TABLE IF NOT EXISTS post_service_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, service_id)
);

ALTER TABLE post_service_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_service_link_read" ON post_service_link;
DROP POLICY IF EXISTS "post_service_link_insert" ON post_service_link;

CREATE POLICY "post_service_link_read" ON post_service_link
  FOR SELECT USING (true);

CREATE POLICY "post_service_link_insert" ON post_service_link
  FOR INSERT WITH CHECK (auth.uid() = business_id);

-- COLLECTIONS (Moodboards/Saved Posts)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections_read" ON collections;
DROP POLICY IF EXISTS "collections_mutate" ON collections;

CREATE POLICY "collections_read" ON collections
  FOR SELECT USING (
    auth.uid() = user_id 
    OR is_public = true
  );

CREATE POLICY "collections_mutate" ON collections
  FOR ALL USING (auth.uid() = user_id);

-- COLLECTION ITEMS (Posts in Collections)
CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, post_id)
);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_items_read" ON collection_items;
DROP POLICY IF EXISTS "collection_items_mutate" ON collection_items;

CREATE POLICY "collection_items_read" ON collection_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM collections WHERE id = collection_id
    )
  );

CREATE POLICY "collection_items_mutate" ON collection_items
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM collections WHERE id = collection_id
    )
  );

-- ============================================
-- 2. BOOKING LAYER ENHANCEMENTS
-- ============================================

-- APPOINTMENT SERVICES (Multi-Service Booking)
CREATE TABLE IF NOT EXISTS appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL,
  padding_time INTEGER DEFAULT 0,
  variable_pricing JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_services_read" ON appointment_services;
DROP POLICY IF EXISTS "appointment_services_insert" ON appointment_services;

CREATE POLICY "appointment_services_read" ON appointment_services
  FOR SELECT USING (
    auth.uid() IN (
      SELECT client_id FROM appointments WHERE id = appointment_id
    ) OR auth.uid() IN (
      SELECT business_id FROM appointments WHERE id = appointment_id
    )
  );

CREATE POLICY "appointment_services_insert" ON appointment_services
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT client_id FROM appointments WHERE id = appointment_id
    )
  );

-- ============================================
-- 3. FINANCIAL & POLICY
-- ============================================

-- CANCELLATION POLICIES
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hours_before INTEGER NOT NULL, -- Hours before appointment
  fee_percentage DECIMAL(5,2) NOT NULL, -- Percentage fee (0-100)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancellation_policies_read" ON cancellation_policies;
DROP POLICY IF EXISTS "cancellation_policies_mutate" ON cancellation_policies;

CREATE POLICY "cancellation_policies_read" ON cancellation_policies
  FOR SELECT USING (true);

CREATE POLICY "cancellation_policies_mutate" ON cancellation_policies
  FOR ALL USING (auth.uid() = business_id);

-- DEPOSITS
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TRY',
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, refunded
  payment_intent_id UUID REFERENCES payment_intents(id),
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposits_read" ON deposits;
DROP POLICY IF EXISTS "deposits_mutate" ON deposits;

CREATE POLICY "deposits_read" ON deposits
  FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() = business_id
  );

CREATE POLICY "deposits_mutate" ON deposits
  FOR ALL USING (
    auth.uid() = user_id 
    OR auth.uid() = business_id
  );

-- ============================================
-- 4. POS & PRODUCTS
-- ============================================

-- POS ITEMS (Products for Sale)
CREATE TABLE IF NOT EXISTS pos_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_items_read" ON pos_items;
DROP POLICY IF EXISTS "pos_items_mutate" ON pos_items;

CREATE POLICY "pos_items_read" ON pos_items
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "pos_items_mutate" ON pos_items
  FOR ALL USING (auth.uid() = business_id);

-- POS SALE ITEMS (Items in a Sale)
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  item_id UUID REFERENCES pos_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_sale_items_read" ON pos_sale_items;
DROP POLICY IF EXISTS "pos_sale_items_insert" ON pos_sale_items;

CREATE POLICY "pos_sale_items_read" ON pos_sale_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT business_id FROM pos_sales WHERE id = sale_id
    )
  );

CREATE POLICY "pos_sale_items_insert" ON pos_sale_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT business_id FROM pos_sales WHERE id = sale_id
    )
  );

-- STAFF EARNINGS (Commission Tracking)
CREATE TABLE IF NOT EXISTS staff_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
  earnings_type VARCHAR(50) NOT NULL, -- 'appointment', 'product_sale', 'bonus'
  base_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
  commission_amount DECIMAL(10,2) DEFAULT 0,
  total_earnings DECIMAL(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_earnings_read" ON staff_earnings;
DROP POLICY IF EXISTS "staff_earnings_insert" ON staff_earnings;
DROP POLICY IF EXISTS "staff_earnings_update" ON staff_earnings;

CREATE POLICY "staff_earnings_read" ON staff_earnings
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM staff WHERE id = staff_id
    ) OR auth.uid() = business_id
  );

CREATE POLICY "staff_earnings_insert" ON staff_earnings
  FOR INSERT WITH CHECK (auth.uid() = business_id);

CREATE POLICY "staff_earnings_update" ON staff_earnings
  FOR UPDATE USING (auth.uid() = business_id);

-- ============================================
-- 5. COMMUNICATION
-- ============================================

-- CONVERSATIONS (Chat Threads)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count_1 INTEGER DEFAULT 0,
  unread_count_2 INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (participant_1_id != participant_2_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_read" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;

CREATE POLICY "conversations_read" ON conversations
  FOR SELECT USING (
    auth.uid() = participant_1_id 
    OR auth.uid() = participant_2_id
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = participant_1_id 
    OR auth.uid() = participant_2_id
  );

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (
    auth.uid() = participant_1_id 
    OR auth.uid() = participant_2_id
  );

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, file
  media_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;

CREATE POLICY "messages_read" ON messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT participant_1_id FROM conversations WHERE id = conversation_id
    ) OR auth.uid() IN (
      SELECT participant_2_id FROM conversations WHERE id = conversation_id
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT participant_1_id FROM conversations WHERE id = conversation_id
    ) OR auth.uid() IN (
      SELECT participant_2_id FROM conversations WHERE id = conversation_id
    )
  );

-- MESSAGE CONTEXT (Links messages to posts/bookings)
CREATE TABLE IF NOT EXISTS message_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  context_type VARCHAR(50) NOT NULL, -- 'post', 'appointment', 'service'
  context_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_context_read" ON message_context;
DROP POLICY IF EXISTS "message_context_insert" ON message_context;

CREATE POLICY "message_context_read" ON message_context
  FOR SELECT USING (
    auth.uid() IN (
      SELECT sender_id FROM messages WHERE id = message_id
    )
  );

CREATE POLICY "message_context_insert" ON message_context
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT sender_id FROM messages WHERE id = message_id
    )
  );

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_post_service_link_post ON post_service_link(post_id);
CREATE INDEX IF NOT EXISTS idx_post_service_link_service ON post_service_link(service_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment ON appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_policies_business ON cancellation_policies(business_id);
CREATE INDEX IF NOT EXISTS idx_deposits_appointment ON deposits(appointment_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_business ON pos_items(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_staff_earnings_staff ON staff_earnings(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_earnings_period ON staff_earnings(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_context_message ON message_context(message_id);

