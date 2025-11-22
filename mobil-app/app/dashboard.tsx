import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();

  // SAHTE İSTATİSTİKLER
  const stats = {
    dailyRevenue: '8.450₺',
    pendingAppointments: 4,
    profileViews: 128,
    boostStatus: false, // Boost kapalı
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 1. ÜST BAŞLIK (Geri Dön Butonlu) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-down" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İşletme Paneli</Text>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 2. GÜNLÜK ÖZET KARTLARI */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#1E1E1E' }]}>
            <View style={styles.iconBgGreen}>
              <Ionicons name="cash-outline" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.statValue}>{stats.dailyRevenue}</Text>
            <Text style={styles.statLabel}>Bugünkü Ciro</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#1E1E1E' }]}>
            <View style={styles.iconBgOrange}>
              <Ionicons name="time-outline" size={20} color="#FFC107" />
            </View>
            <Text style={styles.statValue}>{stats.pendingAppointments}</Text>
            <Text style={styles.statLabel}>Onay Bekleyen</Text>
          </View>
        </View>

        {/* 3. BOOST ALANI (Reklam) */}
        <View style={styles.boostContainer}>
          <View style={styles.boostInfo}>
            <Text style={styles.boostTitle}>🚀 İşletmeni Öne Çıkar</Text>
            <Text style={styles.boostDesc}>Boost açarak %40 daha fazla müşteri kazan.</Text>
          </View>
          <TouchableOpacity style={styles.boostSwitch}>
            <Text style={styles.boostBtnText}>Aktifleştir</Text>
          </TouchableOpacity>
        </View>

        {/* 4. HIZLI İŞLEMLER MENÜSÜ (Grid) */}
        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        <View style={styles.gridContainer}>
          
          {/* Manuel Randevu Ekle */}
          <TouchableOpacity style={styles.gridButton}>
            <View style={[styles.gridIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="add-circle" size={28} color="#2196F3" />
            </View>
            <Text style={styles.gridText}>Randevu Ekle</Text>
          </TouchableOpacity>

          {/* Instagram Entegrasyonu */}
          <TouchableOpacity style={styles.gridButton}>
            <View style={[styles.gridIcon, { backgroundColor: '#FCE4EC' }]}>
              <Ionicons name="logo-instagram" size={28} color="#E91E63" />
            </View>
            <Text style={styles.gridText}>Insta'dan Çek</Text>
          </TouchableOpacity>

          {/* Hizmet Yönetimi */}
          <TouchableOpacity style={styles.gridButton}>
            <View style={[styles.gridIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="cut" size={28} color="#4CAF50" />
            </View>
            <Text style={styles.gridText}>Hizmetler</Text>
          </TouchableOpacity>

          {/* Müşteri Listesi */}
          <TouchableOpacity style={styles.gridButton}>
            <View style={[styles.gridIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="people" size={28} color="#FF9800" />
            </View>
            <Text style={styles.gridText}>Müşteriler</Text>
          </TouchableOpacity>
        </View>

        {/* 5. GELİR GRAFİĞİ (Basit Görselleştirme) */}
        <Text style={styles.sectionTitle}>Haftalık Gelir</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'].map((day, index) => (
              <View key={index} style={styles.chartCol}>
                <View style={[styles.bar, { height: Math.random() * 100 + 20 }]} />
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 15 },
  
  // İstatistikler
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: '48%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  iconBgGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(76, 175, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  iconBgOrange: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 193, 7, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { color: '#888', fontSize: 12 },

  // Boost
  boostContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(33, 150, 243, 0.15)', padding: 15, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#2196F3' },
  boostInfo: { flex: 1 },
  boostTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  boostDesc: { color: '#ccc', fontSize: 12 },
  boostSwitch: { backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  boostBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // Grid
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 25 },
  gridButton: { width: '48%', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  gridIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridText: { color: '#fff', fontWeight: '600' },

  // Grafik
  chartContainer: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 30 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  chartCol: { alignItems: 'center', gap: 8 },
  bar: { width: 8, backgroundColor: '#4CAF50', borderRadius: 4 },
  dayText: { color: '#666', fontSize: 12 },
});