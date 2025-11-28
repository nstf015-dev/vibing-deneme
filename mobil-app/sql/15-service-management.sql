-- ============================================
-- 15. DETAYLI HİZMET YÖNETİMİ
-- ============================================

-- HİZMET TABLOSUNA YENİ KOLONLAR EKLE
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS padding_time INTEGER DEFAULT 0; -- Temizlik süresi (dakika)
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2); -- Temel fiyat
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- DEĞİŞKEN FİYATLANDIRMA (Variable Pricing)
CREATE TABLE IF NOT EXISTS service_variable_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  variable_name VARCHAR(100) NOT NULL, -- Örn: "Saç Uzunluğu", "Cilt Tipi"
  option_name VARCHAR(100) NOT NULL, -- Örn: "Kısa", "Uzun", "Karma"
  price_modifier DECIMAL(10,2) NOT NULL, -- Fiyat farkı (+100₺, -50₺)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, variable_name, option_name)
);

ALTER TABLE service_variable_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_variable_pricing_read" ON service_variable_pricing;
DROP POLICY IF EXISTS "service_variable_pricing_mutate" ON service_variable_pricing;

CREATE POLICY "service_variable_pricing_read" ON service_variable_pricing
  FOR SELECT USING (true);

CREATE POLICY "service_variable_pricing_mutate" ON service_variable_pricing
  FOR ALL USING (
    auth.uid() IN (
      SELECT business_id FROM business_services WHERE id = service_id
    )
  );

-- PERSONEL-HİZMET İLİŞKİSİ (Junction Table)
CREATE TABLE IF NOT EXISTS staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- Bu personel bu hizmeti ana olarak mı yapıyor?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, service_id)
);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_services_read" ON staff_services;
DROP POLICY IF EXISTS "staff_services_mutate" ON staff_services;

CREATE POLICY "staff_services_read" ON staff_services
  FOR SELECT USING (true);

CREATE POLICY "staff_services_mutate" ON staff_services
  FOR ALL USING (
    auth.uid() IN (
      SELECT business_id FROM staff WHERE id = staff_id
    ) OR auth.uid() IN (
      SELECT business_id FROM business_services WHERE id = service_id
    )
  );

-- HİZMET PORTOFÖY GALERİSİ (Service Portfolio)
CREATE TABLE IF NOT EXISTS service_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES business_services(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'image', -- image, video
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_portfolio_read" ON service_portfolio;
DROP POLICY IF EXISTS "service_portfolio_mutate" ON service_portfolio;

CREATE POLICY "service_portfolio_read" ON service_portfolio
  FOR SELECT USING (true);

CREATE POLICY "service_portfolio_mutate" ON service_portfolio
  FOR ALL USING (
    auth.uid() = business_id
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_service_variable_pricing_service ON service_variable_pricing(service_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_staff ON staff_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services(service_id);
CREATE INDEX IF NOT EXISTS idx_service_portfolio_service ON service_portfolio(service_id);
CREATE INDEX IF NOT EXISTS idx_service_portfolio_business ON service_portfolio(business_id);
CREATE INDEX IF NOT EXISTS idx_business_services_active ON business_services(business_id, is_active);

