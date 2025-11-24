import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// Haftanın günlerini hesapla (Bugün + 6 gün)
const getNextDays = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      dateString: d.toISOString().split('T')[0], // YYYY-MM-DD
      dayName: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
      dayNumber: d.getDate(),
      fullDate: d
    });
  }
  return days;
};

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  // Gelenler: business_id, service_name, price, business_name

  const [loading, setLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<any>(null);
  
  // Seçimler
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  
  const [days, setDays] = useState(getNextDays());
  const [selectedDate, setSelectedDate] = useState(days[0]); // Varsayılan bugün
  
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    fetchServiceAndStaff();
  }, []);

  // 1. HİZMET DETAYINI VE UYGUN PERSONELİ BUL
  async function fetchServiceAndStaff() {
    try {
      // A. Hizmetin süresini ve gereksinimlerini öğren
      const { data: serviceData } = await supabase
        .from('business_services')
        .select('*')
        .eq('business_id', params.business_id)
        .eq('name', params.service_name)
        .single();

      setServiceDetails(serviceData);

      // B. Bu hizmeti yapabilen personelleri bul
      const { data: allStaff } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', params.business_id);

      if (allStaff) {
        // Eğer hizmetin özel bir yetenek gereksinimi varsa filtrele
        const requiredRoles = serviceData?.required_staff_roles || [];
        
        const filteredStaff = allStaff.filter(staff => {
          // Eğer hizmet herkes tarafından yapılabiliyorsa (liste boşsa) -> Ekle
          if (!requiredRoles || requiredRoles.length === 0) return true;
          
          // Personelin yetenekleri arasında, hizmetin istediği yeteneklerden BİRİ var mı?
          const staffSkills = staff.skills || [];
          // Kesişim kümesi kontrolü (En az bir yetenek eşleşmeli)
          return requiredRoles.some((role: string) => staffSkills.includes(role));
        });

        setStaffList(filteredStaff);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  // 2. MÜSAİT SAATLERİ HESAPLA (MATRİX LOGIC) 🧠
  useEffect(() => {
    if (selectedStaff && selectedDate) {
      calculateAvailableSlots();
    }
  }, [selectedStaff, selectedDate]);

  async function calculateAvailableSlots() {
    // Seçilen günün tarih formatı: "Bugün, 14:00" gibi basit tutmuştuk, 
    // ama veritabanında tarih sorgusu için YYYY-MM-DD lazım.
    // Basitlik adına şimdilik "Bugün" ise bugünün tarihi, yoksa seçilen tarih varsayıyoruz.
    
    const dateKey = selectedDate.dateString; // 2023-11-24

    // A. Personelin o günkü randevularını çek
    const { data: appointments } = await supabase
      .from('appointments')
      .select('date, status')
      .eq('staff_id', selectedStaff.id)
      .eq('status', 'confirmed')
      .ilike('date', `%${selectedDate.dayNumber}%`); // Basit bir eşleşme (Geliştirilebilir)

    // B. Personelin Molalarını Çek
    const { data: breaks } = await supabase
      .from('staff_breaks')
      .select('start_time')
      .eq('staff_id', selectedStaff.id);

    // C. Saatleri Oluştur
    const duration = serviceDetails?.duration || 30; // Hizmet süresi (dk)
    const slots = [];
    
    // Dükkan 09:00 - 21:00 arası açık varsayalım (Bunu da profilden çekebiliriz)
    let currentMinutes = 9 * 60; // 09:00
    const endMinutes = 21 * 60;  // 21:00

    while (currentMinutes + duration <= endMinutes) {
      const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
      const m = (currentMinutes % 60).toString().padStart(2, '0');
      const timeString = `${h}:${m}`;

      // DOLULUK KONTROLÜ
      // Bu saatte randevu var mı? (Basit string kontrolü yapıyoruz şimdilik)
      const isBooked = appointments?.some(app => app.date.includes(timeString));
      const isBreak = breaks?.some(brk => brk.start_time === timeString);

      if (!isBooked && !isBreak) {
        slots.push(timeString);
      }

      currentMinutes += 30; // Slot aralığı (Müşteri 30dk arayla seçebilsin)
    }

    setTimeSlots(slots);
  }

  // 3. RANDEVUYU ONAYLA
  async function confirmBooking() {
    if (!selectedStaff || !selectedTime) {
      Alert.alert('Eksik Seçim', 'Lütfen personel ve saat seçiniz.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         Alert.alert('Giriş Yapmalısın', 'Randevu almak için lütfen giriş yap.');
         return;
      }

      // Tarih formatı: "Pazartesi 24, 14:00" gibi okunabilir bir format
      const prettyDate = `${selectedDate.dayName} ${selectedDate.dayNumber}, ${selectedTime}`;

      const { error } = await supabase.from('appointments').insert({
        client_id: user.id,
        business_id: params.business_id,
        staff_id: selectedStaff.id,
        service_name: params.service_name,
        price: params.price,
        date: prettyDate,
        status: 'pending' // Onay bekliyor
      });

      if (error) throw error;

      Alert.alert('Harika! 🎉', 'Randevu talebin iletildi. İşletme onaylayınca bildirim alacaksın.', [
        { text: 'Tamam', onPress: () => router.replace('/(tabs)/appointments') }
      ]);

    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>;

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
        <Text style={styles.title}>Randevu Oluştur</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* HİZMET KARTI */}
        <View style={styles.serviceCard}>
          <View>
            <Text style={styles.serviceName}>{params.service_name}</Text>
            <Text style={styles.businessName}>@{params.business_name}</Text>
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={12} color="#ccc" />
              <Text style={styles.durationText}>{serviceDetails?.duration || 30} dk</Text>
            </View>
          </View>
          <Text style={styles.price}>{params.price}</Text>
        </View>

        {/* 1. PERSONEL SEÇİMİ */}
        <Text style={styles.sectionTitle}>Uzman Seç</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroll}>
          {staffList.length === 0 ? (
            <Text style={{color:'#666', fontStyle:'italic'}}>Uygun personel bulunamadı.</Text>
          ) : staffList.map(staff => (
            <TouchableOpacity 
              key={staff.id} 
              style={[styles.staffCard, selectedStaff?.id === staff.id && styles.selectedStaff]}
              onPress={() => setSelectedStaff(staff)}
            >
              <Image source={{ uri: staff.avatar_url }} style={styles.staffAvatar} />
              <Text style={styles.staffName}>{staff.full_name}</Text>
              <Text style={styles.staffRole}>{staff.specialty}</Text>
              {selectedStaff?.id === staff.id && <View style={styles.checkBadge}><Ionicons name="checkmark" size={10} color="#fff"/></View>}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2. TARİH SEÇİMİ */}
        {selectedStaff && (
          <>
            <Text style={styles.sectionTitle}>Tarih Seç</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {days.map((day, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.dateCard, selectedDate.dateString === day.dateString && styles.selectedDate]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[styles.dayName, selectedDate.dateString === day.dateString && {color:'#000'}]}>{day.dayName}</Text>
                  <Text style={[styles.dayNumber, selectedDate.dateString === day.dateString && {color:'#000'}]}>{day.dayNumber}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* 3. SAAT SEÇİMİ */}
        {selectedStaff && (
          <>
            <Text style={styles.sectionTitle}>Saat Seç</Text>
            {timeSlots.length === 0 ? (
              <Text style={{color:'#666'}}>Bugün için boş saat kalmadı.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {timeSlots.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.slot, selectedTime === slot && styles.selectedSlot]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[styles.slotText, selectedTime === slot && styles.selectedSlotText]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* ALT BUTON */}
      <View style={styles.footer}>
        <View style={{flex:1}}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalPrice}>{params.price}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.confirmBtn, (!selectedStaff || !selectedTime) && {backgroundColor:'#333'}]} 
          onPress={confirmBooking}
          disabled={!selectedStaff || !selectedTime}
        >
          <Text style={[styles.confirmText, (!selectedStaff || !selectedTime) && {color:'#666'}]}>Onayla</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 100 },
  
  serviceCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 16, marginBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  businessName: { color: '#888', marginTop: 4, fontSize: 14 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#333', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  durationText: { color: '#ccc', fontSize: 12, marginLeft: 4 },
  price: { color: '#4CAF50', fontWeight: 'bold', fontSize: 20 },

  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  
  staffScroll: { marginBottom: 25 },
  staffCard: { alignItems: 'center', marginRight: 15, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#1E1E1E', width: 90 },
  selectedStaff: { borderColor: '#0095F6', backgroundColor: '#111' },
  staffAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 8 },
  staffName: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  staffRole: { color: '#888', fontSize: 10, textAlign: 'center' },
  checkBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#0095F6', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  dateScroll: { marginBottom: 25 },
  dateCard: { backgroundColor: '#1E1E1E', width: 60, height: 70, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#333' },
  selectedDate: { backgroundColor: '#fff' },
  dayName: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  dayNumber: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '22%', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', backgroundColor: '#1E1E1E' },
  selectedSlot: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  slotText: { color: '#fff', fontWeight: '600' },
  selectedSlotText: { color: '#fff' },

  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingBottom: 30, backgroundColor: '#1E1E1E', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row', alignItems: 'center' },
  totalLabel: { color: '#888', fontSize: 12 },
  totalPrice: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});