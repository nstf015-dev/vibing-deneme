# VibeBeauty SQL Migration Dosyaları

Bu klasörde tüm SQL migration dosyaları parça parça ayrılmıştır. Her dosyayı **sırayla** Supabase SQL Editor'de çalıştırın.

## 📋 Çalıştırma Sırası

1. **01-post-likes-comments.sql** - Post beğenileri, yorumlar ve paylaşımlar
2. **02-appointment-reviews.sql** - Randevu yorumları
3. **03-favorites-waitlist.sql** - Favori işletmeler ve bekleme listesi
4. **04-payment-intents.sql** - Ödeme işlemleri
5. **05-crm-customer-notes.sql** - CRM müşteri notları
6. **06-crm-customer-tags.sql** - CRM müşteri etiketleri
7. **07-campaigns-boost.sql** - Kampanyalar ve Boost sistemi
8. **08-notifications.sql** - Bildirimler
9. **09-staff-shifts.sql** - Personel vardiyaları
10. **10-resource-availability.sql** - Kaynak yönetimi
11. **11-stock-items.sql** - Stok yönetimi
12. **12-pos-sales.sql** - POS satışları
13. **13-customer-segments.sql** - Müşteri segmentleri
14. **14-location-columns.sql** - Profil konum bilgileri

## 🚀 Kullanım

1. Supabase SQL Editor'ü aç
2. Her dosyayı sırayla kopyala-yapıştır
3. "Run" (CTRL+J) ile çalıştır
4. Hata alırsan, hangi dosyada ve hangi satırda olduğunu not et
5. Bir sonraki dosyaya geç

## ⚠️ Önemli Notlar

- Her dosya **idempotent** (tekrar çalıştırılabilir)
- `DROP POLICY IF EXISTS` kullanıldığı için policy hataları olmaz
- Tablolar `CREATE TABLE IF NOT EXISTS` ile oluşturulur
- Index'ler `CREATE INDEX IF NOT EXISTS` ile oluşturulur

## 🐛 Hata Durumunda

Eğer bir dosyada hata alırsan:
1. Hangi dosya? (örn: `04-payment-intents.sql`)
2. Hangi satır? (hata mesajında belirtilir)
3. Hata mesajı nedir? (tam hata mesajını kopyala)

Bu bilgileri paylaş, düzeltelim!

