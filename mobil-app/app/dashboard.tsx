import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, pending: 0, views: 128 }); // Views şimdilik sabit

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Bana gelen randevuları çek
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          client:profiles!client_id(full_name, avatar_url)
        `)
        .eq('business_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allApps = data || [];
      setAppointments(allApps);

      // 2. İstatistikleri Hesapla
      // Ciro: Sadece 'confirmed' (onaylı) olanların fiyatını topla
      let totalMoney = 0;
      let pendingCount = 0;

      allApps.forEach(app => {
        if (app.status === 'confirmed') {
          // Fiyat metninden rakamı çıkar (Örn: "400₺" -> 400)
          const priceNumber = parseInt(app.price.replace(/[^0-9]/g, '')) || 0;
          totalMoney += priceNumber;
        }
        if (app.status === 'pending') {
          pendingCount++;
        }
      });

      setStats(prev => ({ ...prev, revenue: totalMoney, pending: pendingCount }));

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  // RANDEVU ONAYLA / REDDET
  async function updateStatus(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Listeyi güncelle
      fetchDashboardData();
      Alert.alert('Başarılı', newStatus === 'confirmed' ? 'Randevuyu onayladın! Para kasada. 🤑' : 'Randevu reddedildi.');

    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'İşlem yapılamadı.');
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ÜST BAŞLIK */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-down" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patron Paneli 💼</Text>
        <Ionicons name="settings-outline" size={24} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* İSTATİSTİKLER */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#1E1E1E' }]}>
            <View style={styles.iconBgGreen}>
              <Ionicons name="cash-outline" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.statValue}>{stats.revenue}₺</Text>
            <Text style={styles.statLabel}>Onaylanan Ciro</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#1E1E1E' }]}>
            <View style={styles.iconBgOrange}>
              <Ionicons name="time-outline" size={20} color="#FFC107" />
            </View>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Onay Bekleyen</Text>
          </View>
        </View>

        {/* HIZLI ERİŞİM MENÜSÜ */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity style={styles.quickAccessCard} onPress={() => router.push('/business-crm')}>
            <Ionicons name="people-outline" size={24} color="#0095F6" />
            <Text style={styles.quickAccessText}>CRM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={() => router.push('/business-calendar' as any)}>
            <Ionicons name="calendar-outline" size={24} color="#4CAF50" />
            <Text style={styles.quickAccessText}>Takvim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // profiles tablosundan business_id'yi al
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .eq('role', 'business')
                .single();
              
              if (profile) {
                router.push(`/service-management?business_id=${profile.id}` as any);
              } else {
                // Eğer profile yoksa direkt user.id kullan
                router.push(`/service-management?business_id=${user.id}` as any);
              }
            }
          }}>
            <Ionicons name="list-outline" size={24} color="#9C27B0" />
            <Text style={styles.quickAccessText}>Hizmetler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={() => router.push('/campaign-builder' as any)}>
            <Ionicons name="megaphone-outline" size={24} color="#FFC107" />
            <Text style={styles.quickAccessText}>Pazarlama</Text>
          </TouchableOpacity>
        </View>

        {/* İKİNCİ SATIR */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity style={styles.quickAccessCard} onPress={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .eq('role', 'business')
                .single();
              
              if (profile) {
                router.push(`/staff-service-assignment?business_id=${profile.id}` as any);
              } else {
                router.push(`/staff-service-assignment?business_id=${user.id}` as any);
              }
            }
          }}>
            <Ionicons name="person-add-outline" size={24} color="#00BCD4" />
            <Text style={styles.quickAccessText}>Personel-Hizmet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .eq('role', 'business')
                .single();
              
              if (profile) {
                router.push(`/staff-shift-management?business_id=${profile.id}` as any);
              } else {
                router.push(`/staff-shift-management?business_id=${user.id}` as any);
              }
            }
          }}>
            <Ionicons name="time-outline" size={24} color="#FF9800" />
            <Text style={styles.quickAccessText}>Vardiyalar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={() => router.push('/pos-checkout' as any)}>
            <Ionicons name="cash-outline" size={24} color="#F44336" />
            <Text style={styles.quickAccessText}>POS Satış</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessCard} onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={24} color="#FF9800" />
            <Text style={styles.quickAccessText}>Bildirimler</Text>
          </TouchableOpacity>
        </View>

        {/* BEKLEYEN RANDEVULAR LİSTESİ */}
        <Text style={styles.sectionTitle}>Talep Edilen Randevular</Text>
        
        {appointments.length === 0 ? (
           <Text style={styles.emptyText}>Henüz randevu yok patron.</Text>
        ) : (
          appointments.map((app) => (
            <View key={app.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.clientName}>{app.client?.full_name || 'Gizli Müşteri'}</Text>
                <Text style={styles.serviceName}>{app.service_name} • {app.price}</Text>
                <Text style={styles.dateText}>📅 {app.date}</Text>
                
                {/* Durum Etiketi */}
                <Text style={[styles.statusText, { color: app.status === 'confirmed' ? '#4CAF50' : '#FFC107' }]}>
                  {app.status === 'confirmed' ? 'Onaylandı ✅' : 'Onay Bekliyor ⏳'}
                </Text>
              </View>

              {/* ONAY BUTONLARI (Sadece Bekleyenler İçin) */}
              {app.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => updateStatus(app.id, 'confirmed')}>
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => updateStatus(app.id, 'cancelled')}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 15 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { width: '48%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  quickAccessRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, gap: 10 },
  quickAccessCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  quickAccessText: { color: '#fff', fontSize: 12, marginTop: 8, fontWeight: '600' },
  iconBgGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(76, 175, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  iconBgOrange: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 193, 7, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { color: '#888', fontSize: 12 },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  emptyText: { color: '#666', fontStyle: 'italic' },

  requestCard: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  requestInfo: { flex: 1 },
  clientName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  serviceName: { color: '#ccc', fontSize: 14, marginTop: 2 },
  dateText: { color: '#888', fontSize: 12, marginTop: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },

  actionButtons: { flexDirection: 'row', gap: 10 },
  acceptBtn: { backgroundColor: '#4CAF50', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#F44336', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});