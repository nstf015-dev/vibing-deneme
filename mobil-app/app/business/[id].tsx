import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function BusinessProfileScreen() {
  const { id } = useLocalSearchParams(); // URL'den gelen işletme ID'si
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinessDetails();
  }, [id]);

  async function fetchBusinessDetails() {
    try {
      // 1. İşletme Profilini Çek
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
      setBusiness(profile);

      // 2. Hizmetlerini Çek
      const { data: serviceList } = await supabase.from('business_services').select('*').eq('business_id', id);
      setServices(serviceList || []);

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  // Randevu Sihirbazına Gönder
  const goToBooking = (service: any) => {
    router.push({
      pathname: '/booking',
      params: {
        business_id: id,
        business_name: business.business_name || business.full_name,
        service_name: service.name,
        price: service.price
      }
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İşletme Profili</Text>
        <View style={{width:40}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profil Kartı */}
        <View style={styles.profileCard}>
          <Image source={{ uri: business?.avatar_url || 'https://placehold.co/150' }} style={styles.avatar} />
          <Text style={styles.name}>{business?.business_name || business?.full_name}</Text>
          <Text style={styles.type}>{business?.business_type || 'Güzellik Salonu'}</Text>
          
          <View style={styles.infoRow}>
             <Ionicons name="time-outline" size={16} color="#888" />
             <Text style={styles.infoText}>{business?.opening_time} - {business?.closing_time}</Text>
          </View>
        </View>

        {/* Hizmet Listesi */}
        <Text style={styles.sectionTitle}>Hizmetler & Randevu</Text>
        
        {services.length === 0 ? (
           <Text style={{color:'#666', textAlign:'center', marginTop:20}}>Henüz hizmet eklenmemiş.</Text>
        ) : (
          services.map((service, index) => (
            <View key={index} style={styles.serviceRow}>
              <View style={{flex:1}}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDuration}>{service.duration} dk • {service.required_skill || 'Genel'}</Text>
              </View>
              <TouchableOpacity style={styles.bookBtn} onPress={() => goToBooking(service)}>
                <Text style={styles.bookText}>{service.price}</Text>
                <Text style={styles.bookSubText}>Randevu Al</Text>
              </TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  backBtn: { padding: 10, backgroundColor: '#333', borderRadius: 20 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  content: { padding: 20 },
  
  profileCard: { alignItems: 'center', marginBottom: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#0095F6', marginBottom: 15 },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  type: { color: '#888', fontSize: 16, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1E1E1E', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  infoText: { color: '#ccc' },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  serviceDuration: { color: '#888', fontSize: 12, marginTop: 4 },
  bookBtn: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, alignItems: 'center', minWidth: 80 },
  bookText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  bookSubText: { color: '#000', fontSize: 10 },
});