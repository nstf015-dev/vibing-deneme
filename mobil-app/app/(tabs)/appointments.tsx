import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 1. SAHTE RANDEVU VERİLERİ
const APPOINTMENTS = [
  {
    id: '1',
    status: 'confirmed', // Onaylandı
    service: 'Saç Boyama & Bakım',
    businessName: 'Studio Gül',
    date: '24 Kasım',
    time: '14:30',
    price: '2500₺',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    isPast: false,
  },
  {
    id: '2',
    status: 'pending', // Onay Bekliyor
    service: 'Cilt Bakımı',
    businessName: 'Glow Beauty',
    date: '28 Kasım',
    time: '10:00',
    price: '1200₺',
    avatar: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=100&h=100&fit=crop',
    isPast: false,
  },
  {
    id: '3',
    status: 'completed', // Tamamlandı
    service: 'Erkek Saç Kesimi',
    businessName: 'Barber King',
    date: '12 Kasım',
    time: '18:00',
    price: '400₺',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    isPast: true,
  },
  {
    id: '4',
    status: 'cancelled', // İptal
    service: 'Manikür',
    businessName: 'Nail Art by Ece',
    date: '10 Ekim',
    time: '15:00',
    price: '600₺',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
    isPast: true,
  },
];

export default function AppointmentsScreen() {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' veya 'past'

  // Veriyi sekmeye göre filtrele
  const filteredData = APPOINTMENTS.filter(item => 
    activeTab === 'upcoming' ? !item.isPast : item.isPast
  );

  // Duruma göre renk ve metin belirle
  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'confirmed': return { color: '#4CAF50', text: 'Onaylandı', icon: 'checkmark-circle' }; // Yeşil
      case 'pending': return { color: '#FFC107', text: 'Bekliyor', icon: 'time' }; // Sarı
      case 'completed': return { color: '#888', text: 'Tamamlandı', icon: 'checkbox' }; // Gri
      case 'cancelled': return { color: '#F44336', text: 'İptal', icon: 'close-circle' }; // Kırmızı
      default: return { color: '#fff', text: '', icon: '' };
    }
  };

  const renderAppointment = ({ item }: { item: any }) => {
    const statusInfo = getStatusStyle(item.status);

    return (
      <View style={styles.card}>
        {/* Sol Taraf: Tarih Kutusu */}
        <View style={styles.dateBox}>
          <Text style={styles.dateText}>{item.date.split(' ')[0]}</Text>
          <Text style={styles.monthText}>{item.date.split(' ')[1]}</Text>
          <Text style={styles.timeText}>{item.time}</Text>
        </View>

        {/* Orta: Detaylar */}
        <View style={styles.details}>
          <Text style={styles.serviceName}>{item.service}</Text>
          <View style={styles.businessRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={styles.businessName}>{item.businessName}</Text>
          </View>
          <Text style={styles.price}>{item.price}</Text>
        </View>

        {/* Sağ: Durum */}
        <View style={styles.statusBox}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>Randevularım</Text>
      </View>

      {/* Sekmeler (Gelecek / Geçmiş) */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]} 
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>Gelecek</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.activeTab]} 
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>Geçmiş</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={filteredData}
        renderItem={renderAppointment}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={60} color="#333" />
            <Text style={styles.emptyText}>Henüz randevu yok.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  
  // Sekmeler
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
  tab: { marginRight: 20, paddingBottom: 8 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { color: '#666', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#fff' },

  // Liste
  listContainer: { paddingHorizontal: 20 },
  card: { 
    backgroundColor: '#1E1E1E', 
    borderRadius: 16, 
    padding: 15, 
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333'
  },

  // Tarih Kutusu
  dateBox: { 
    backgroundColor: '#2C2C2C', 
    borderRadius: 12, 
    paddingVertical: 10, 
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 15
  },
  dateText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  monthText: { color: '#aaa', fontSize: 12, textTransform: 'uppercase' },
  timeText: { color: '#fff', fontSize: 14, marginTop: 4, fontWeight: '600' },

  // Detaylar
  details: { flex: 1 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  businessRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
  businessName: { color: '#aaa', fontSize: 13 },
  price: { color: '#fff', fontWeight: '600' },

  // Durum
  statusBox: { alignItems: 'flex-end', justifyContent: 'center' },
  statusText: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Boş Durum
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', marginTop: 10 },
});