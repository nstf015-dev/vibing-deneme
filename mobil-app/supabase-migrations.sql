-- ============================================
-- VIBEBEAUTY SUPER APP - SUPABASE MIGRATIONS
-- ============================================

-- 1. POST BEĞENİLERİ (Likes)
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "post_likes_readable" ON post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;

CREATE POLICY "post_likes_readable" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "post_likes_insert" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_likes_delete" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 2. POST YORUMLARI (Comments)
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_readable" ON post_comments;
DROP POLICY IF EXISTS "post_comments_insert" ON post_comments;
DROP POLICY IF EXISTS "post_comments_delete" ON post_comments;

CREATE POLICY "post_comments_readable" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "post_comments_insert" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_delete" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 3. POST PAYLAŞIMLARI (Shares - İleride kullanılabilir)
CREATE TABLE IF NOT EXISTS post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_shares_readable" ON post_shares
  FOR SELECT USING (true);

CREATE POLICY "post_shares_insert" ON post_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. RANDEVU YORUMLARI (Zaten var ama kontrol için)
CREATE TABLE IF NOT EXISTS appointment_reviews (
  appointment_id UUID PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_readable" ON appointment_reviews
  FOR SELECT USING (true);

CREATE POLICY "only_author_can_upsert" ON appointment_reviews
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "only_author_can_update" ON appointment_reviews
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- 5. FAVORİ İŞLETMELER (Zaten var ama kontrol için)
CREATE TABLE IF NOT EXISTS favorite_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, business_id)
);

ALTER TABLE favorite_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_read" ON favorite_businesses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorite_mutate" ON favorite_businesses
  FOR ALL USING (auth.uid() = user_id);

-- 6. BEKLEME LİSTESİ (Waitlist)
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

CREATE POLICY "waitlist_read" ON waitlist_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "waitlist_mutate" ON waitlist_entries
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_business_date ON waitlist_entries(business_id, desired_date);

-- 7. ÖDEME İŞLEMLERİ (Payment Intents)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TRY',
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
  payment_method VARCHAR(50), -- card, wallet, cash
  stripe_payment_intent_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents_read" ON payment_intents
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = business_id);

CREATE POLICY "payment_intents_insert" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payment_intents_update" ON payment_intents
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = business_id);

-- 8. CRM - MÜŞTERİ NOTLARI (Customer Notes)
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  tags TEXT[], -- Array of tags
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_notes_read" ON customer_notes
  FOR SELECT USING (auth.uid() = business_id OR auth.uid() = created_by);

CREATE POLICY "customer_notes_mutate" ON customer_notes
  FOR ALL USING (auth.uid() = business_id OR auth.uid() = created_by);

-- 9. CRM - MÜŞTERİ ETİKETLERİ (Customer Tags)
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  color VARCHAR(7), -- Hex color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, customer_id, tag_name)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_tags_read" ON customer_tags
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "customer_tags_mutate" ON customer_tags
  FOR ALL USING (auth.uid() = business_id);

-- 10. PAZARLAMA - KAMPANYALAR (Campaigns)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50), -- discount, promotion, event
  discount_percentage DECIMAL(5,2),
  discount_amount DECIMAL(10,2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_audience JSONB, -- Segment criteria
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_read" ON campaigns
  FOR SELECT USING (true); -- Public campaigns

CREATE POLICY "campaigns_mutate" ON campaigns
  FOR ALL USING (auth.uid() = business_id);

-- 11. BOOST SİSTEMİ (Post Boost Orders)
CREATE TABLE IF NOT EXISTS boost_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  boost_type VARCHAR(20) DEFAULT 'standard', -- standard, premium, featured
  duration_hours INTEGER DEFAULT 24,
  amount_paid DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boost_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boost_orders_read" ON boost_orders
  FOR SELECT USING (true);

CREATE POLICY "boost_orders_insert" ON boost_orders
  FOR INSERT WITH CHECK (auth.uid() = business_id);

-- 12. BİLDİRİMLER (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- appointment_reminder, new_review, campaign, etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional data
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 13. PERSONEL VARDİYALARI (Staff Shifts)
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

CREATE POLICY "staff_shifts_read" ON staff_shifts
  FOR SELECT USING (true);

CREATE POLICY "staff_shifts_mutate" ON staff_shifts
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM staff WHERE id = staff_id
    ) OR auth.uid() = business_id
  );

-- 14. KAYNAK YÖNETİMİ (Resource Availability)
CREATE TABLE IF NOT EXISTS resource_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50), -- room, equipment, etc.
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resource_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_availability_read" ON resource_availability
  FOR SELECT USING (true);

CREATE POLICY "resource_availability_mutate" ON resource_availability
  FOR ALL USING (auth.uid() = business_id);

-- 15. STOK YÖNETİMİ (Stock Items)
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  unit VARCHAR(20), -- piece, ml, kg, etc.
  low_stock_threshold INTEGER DEFAULT 10,
  cost_per_unit DECIMAL(10,2),
  supplier_info JSONB,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_items_read" ON stock_items
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "stock_items_mutate" ON stock_items
  FOR ALL USING (auth.uid() = business_id);

-- 16. POS SATIŞLARI (POS Sales)
CREATE TABLE IF NOT EXISTS pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  items JSONB NOT NULL, -- Array of items with name, quantity, price
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_sales_read" ON pos_sales
  FOR SELECT USING (auth.uid() = business_id OR auth.uid() = customer_id);

CREATE POLICY "pos_sales_insert" ON pos_sales
  FOR INSERT WITH CHECK (auth.uid() = business_id);

-- 17. MÜŞTERİ SEGMENTLERİ (Customer Segments)
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  segment_name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL, -- Filter criteria
  customer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_segments_read" ON customer_segments
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "customer_segments_mutate" ON customer_segments
  FOR ALL USING (auth.uid() = business_id);

-- 18. PROFİL KONUM BİLGİLERİ (Location - profiles tablosuna eklenmeli)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- ============================================
-- ADDITIONAL INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_business ON payment_intents(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_customer_notes_business_customer ON customer_notes(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_business_customer ON customer_tags(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_business_status ON campaigns(business_id, status);
CREATE INDEX IF NOT EXISTS idx_boost_orders_post ON boost_orders(post_id);
CREATE INDEX IF NOT EXISTS idx_boost_orders_status ON boost_orders(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_date ON staff_shifts(staff_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_resource_availability_business_date ON resource_availability(business_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_items_business ON stock_items(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_business_date ON pos_sales(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_segments_business ON customer_segments(business_id);

