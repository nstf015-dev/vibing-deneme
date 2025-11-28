import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// --- SABİTLER ---

// 1. Saat Dilimleri (Walk-in ve Mola için)
const GENERATE_TIME_SLOTS = () => {
  const slots = [];
  for (let i = 9; i < 22; i++) {
    const hour = i < 10 ? `0${i}` : i;
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }
  return slots;
};
const TIME_SLOTS = GENERATE_TIME_SLOTS();

// 2. Mola Süreleri (Dakika)
const BREAK_DURATIONS = [15, 30, 45, 60];

export default function StaffDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // --- VERİLER ---
  const [currentStaff, setCurrentStaff] = useState<any>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [businessServices, setBusinessServices] = useState<any[]>([]); // Hizmet Listesi
  
  // --- İSTATİSTİK & CRM ---
  const [loyalCustomers, setLoyalCustomers] = useState<any[]>([]);
  const [allCustomerNames, setAllCustomerNames] = useState<string[]>([]);
  const [stats, setStats] = useState({ todayEarnings: 0, appointmentCount: 0 });

  // --- MODAL KONTROLLERİ ---
  const [modalVisible, setModalVisible] = useState<'none' | 'walkIn' | 'break' | 'cert' | 'switchStaff' | 'customerCRM' | 'customerList'>('none');

  // --- INPUTLAR ---
  
  // 1. Walk-in (Dışarıdan Ekle)
  const [guestName, setGuestName] = useState('');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState('');
  
  // 2. Mola (Akıllı Seçim)
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakDuration, setBreakDuration] = useState<number | null>(null);
  const [breakNote, setBreakNote] = useState('');

  // 3. Sertifika
  const [certTitle, setCertTitle] = useState('');
  
  // 4. CRM (Müşteri Notu)
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  const calculateStatsAndLoyalty = useCallback((apps: any[], commission: number) => {
    let earning = 0;
    const clientCounts: any = {};
    const uniqueNames = new Set<string>();

    apps.forEach(app => {
      // Ciro Hesabı
      if (app.status === 'confirmed') {
        const price = parseInt(app.price?.replace(/[^0-9]/g, '') || '0');
        earning += price * ((commission || 40) / 100);
      }
      
      // İsimleri Topla
      const name = app.client?.full_name || app.guest_name;
      if (name) {
        clientCounts[name] = (clientCounts[name] || 0) + 1;
        uniqueNames.add(name);
      }
    });

    // En sadık 5
    const loyalList = Object.keys(clientCounts)
      .map(name => ({ name, count: clientCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({ todayEarnings: earning, appointmentCount: apps.length });
    setLoyalCustomers(loyalList);
    setAllCustomerNames(Array.from(uniqueNames));
  }, []);

  const loadStaffData = useCallback(async (staff: any) => {
    setLoading(true);
    setCurrentStaff(staff);
    setModalVisible('none'); // Modalları kapat

    try {
      // A. Randevular
      const { data: apps } = await supabase
        .from('appointments')
        .select('*, client:profiles!client_id(full_name)')
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      // B. Molalar
      const { data: brks } = await supabase.from('staff_breaks').select('*').eq('staff_id', staff.id);
      
      // C. Sertifikaları Çek
      const { data: certs } = await supabase.from('staff_certificates').select('*').eq('staff_id', staff.id);

      setAppointments(apps || []);
      setBreaks(brks || []);
      setCertificates(certs || []);
      
      // D. Hesapla
      calculateStatsAndLoyalty(apps || [], staff.commission_rate);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [calculateStatsAndLoyalty]);

  const initDashboard = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // İşletme Personellerini Çek
      const { data: staffList } = await supabase.from('staff').select('*').eq('business_id', user.id);
      
      // Hizmetleri Çek (Seçim için)
      const { data: services } = await supabase.from('business_services').select('*').eq('business_id', user.id);
      setBusinessServices(services || []);

      if (staffList && staffList.length > 0) {
        setAllStaff(staffList);
        await loadStaffData(staffList[0]); // İlk personeli yükle
      } else {
        Alert.alert('Uyarı', 'Personel bulunamadı. Lütfen işletme ayarlarından ekleyin.');
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
    }
  }, [loadStaffData]);

  // --- BAŞLANGIÇ ---
  useEffect(() => {
    initDashboard();
  }, [initDashboard]);

  // --- İŞLEM FONKSİYONLARI ---

  // 1. Walk-in Ekle
  async function handleAddWalkIn() {
    if (!guestName || !selectedTime || !selectedService) { 
        Alert.alert("Eksik Bilgi", "Lütfen İsim, İşlem ve Saat seçiniz."); 
        return; 
    }
    
    setLoading(true);
    
    const priceText = selectedService.price ? `${selectedService.price}` : '0₺';

    const { error } = await supabase.from('appointments').insert({
      business_id: currentStaff.business_id,
      staff_id: currentStaff.id,
      guest_name: guestName,
      service_name: selectedService.name,
      date: `Bugün, ${selectedTime}`,
      status: 'confirmed',
      price: priceText
    });

    if (error) {
      Alert.alert("Hata", error.message);
    } else {
      Alert.alert("Başarılı", "Müşteri listeye eklendi.");
      await loadStaffData(currentStaff);
      setGuestName(''); setSelectedTime(''); setSelectedService(null);
    }
    setLoading(false);
  }

  // 2. Mola Ver (AKILLI SİSTEM)
  async function handleAddBreak() {
    if (!breakStartTime || !breakDuration) { Alert.alert("Eksik", "Saat ve süre seçiniz."); return; }
    
    // Bitiş saati hesaplama
    const [hours, minutes] = breakStartTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + breakDuration);
    const endHours = endDate.getHours().toString().padStart(2, '0');
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    const calculatedEndTime = `${endHours}:${endMinutes}`;

    await supabase.from('staff_breaks').insert({
      staff_id: currentStaff.id, 
      start_time: breakStartTime, 
      end_time: calculatedEndTime, 
      note: breakNote || 'Mola'
    });
    
    loadStaffData(currentStaff);
    setBreakStartTime(''); setBreakDuration(null); setBreakNote('');
  }

  // 3. Sertifika Ekle
  async function handleAddCert() {
    if (!certTitle) return;
    await supabase.from('staff_certificates').insert({
      staff_id: currentStaff.id, title: certTitle,
      image_url: `https://ui-avatars.com/api/?name=${certTitle}&background=random&color=fff`
    });
    loadStaffData(currentStaff);
    setCertTitle('');
  }

  // 4. Personel Silme
  const handleDeleteStaff = async (id: string, name: string) => {
    const confirmDelete = async () => {
      setLoading(true);
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (!error) {
        const updatedList = allStaff.filter(s => s.id !== id);
        setAllStaff(updatedList);
        if (currentStaff?.id === id) {
           if(updatedList.length > 0) loadStaffData(updatedList[0]);
           else router.back();
        } else setLoading(false);
      } else setLoading(false);
    };
    if (Platform.OS === 'web') { if (confirm(`${name} silinsin mi?`)) confirmDelete(); } 
    else { Alert.alert('Sil', `${name} silinsin mi?`, [{ text: 'İptal' }, { text: 'Sil', onPress: confirmDelete }]); }
  };

  // 5. CRM: Not Aç/Kaydet
  async function openCustomerCRM(name: string) {
    if (!name) return;
    setSelectedCustomerName(name);
    const { data } = await supabase.from('customer_notes').select('note').eq('staff_id', currentStaff.id).eq('client_name', name).single();
    setCustomerNote(data?.note || ''); setModalVisible('customerCRM');
  }
  async function saveCustomerNote() {
    await supabase.from('customer_notes').delete().eq('staff_id', currentStaff.id).eq('client_name', selectedCustomerName);
    await supabase.from('customer_notes').insert({ staff_id: currentStaff.id, client_name: selectedCustomerName, note: customerNote });
    setModalVisible('none');
  }

  // Yardımcı: Saat Kontrolü
  const isTimeBooked = (time: string) => {
    const inApps = appointments.some(app => app.date && app.date.includes(time));
    const inBreaks = breaks.some(brk => brk.start_time === time);
    return inApps || inBreaks;
  };

  if (loading && !currentStaff) return <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Image source={{ uri: currentStaff?.avatar_url }} style={styles.avatar} />
          <View>
            <TouchableOpacity onPress={() => setModalVisible('switchStaff')} style={styles.switchBtn}>
              <Text style={styles.staffName}>{currentStaff?.full_name}</Text>
              <Ionicons name="caret-down" size={16} color="#0095F6" style={{marginLeft:5}}/>
            </TouchableOpacity>
            <Text style={styles.roleText}>{currentStaff?.specialty} • %{currentStaff?.commission_rate || 40} Prim</Text>
          </View>
        </View>
        {/* FİXLENEN KAPAT BUTONU */}
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* --- İSTATİSTİKLER --- */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.iconBgGreen}><Ionicons name="wallet" size={20} color="#4CAF50"/></View>
            <Text style={styles.statLabel}>Hakedişim</Text>
            <Text style={[styles.statValue, {color: '#4CAF50'}]}>{stats.todayEarnings}₺</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.iconBgBlue}><Ionicons name="calendar" size={20} color="#0095F6"/></View>
            <Text style={styles.statLabel}>Randevular</Text>
            <Text style={styles.statValue}>{stats.appointmentCount}</Text>
          </View>
        </View>

        {/* --- AKSİYONLAR --- */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setModalVisible('walkIn')}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.actionText}>Dışarıdan Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#333'}]} onPress={() => setModalVisible('break')}>
            <Ionicons name="cafe" size={20} color="#fff" />
            <Text style={styles.actionText}>Mola Ver</Text>
          </TouchableOpacity>
        </View>

        {/* --- MÜŞTERİ REHBERİ --- */}
        <TouchableOpacity style={styles.customerListBtn} onPress={() => setModalVisible('customerList')}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="book" size={20} color="#fff" />
            <Text style={styles.customerListText}>Müşteri Defteri 📒</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* --- FAVORİLER --- */}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>💎 Favori Müşteriler</Text></View>
        {loyalCustomers.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Henüz sadık müşterin yok.</Text></View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
            {loyalCustomers.map((c, i) => (
              <TouchableOpacity key={i} style={styles.loyalCard} onPress={() => openCustomerCRM(c.name)}>
                <View style={styles.loyalIcon}><Ionicons name="star" size={14} color="#FFC107" /></View>
                <Text style={styles.loyalName}>{c.name}</Text>
                <Text style={styles.loyalCount}>{c.count} Ziyaret</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* --- AKIŞ --- */}
        <Text style={styles.sectionTitle}>Bugünün Akışı 📅</Text>
        
        {/* Molalar */}
        {breaks.map((brk, i) => (
          <View key={`brk-${i}`} style={styles.breakCard}>
            <Ionicons name="pause-circle" size={24} color="#888" />
            <View>
              <Text style={styles.breakText}>{brk.note}</Text>
              <Text style={styles.breakTime}>{brk.start_time} - {brk.end_time}</Text>
            </View>
          </View>
        ))}

        {/* Randevular */}
        {appointments.length === 0 && breaks.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Bugün boşsun, keyfine bak! ☕</Text></View>
        ) : (
          appointments.map((app, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.appointmentCard, app.status === 'confirmed' ? styles.confirmedBorder : styles.pendingBorder]} 
              onPress={() => openCustomerCRM(app.client?.full_name || app.guest_name)}
            >
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{app.date?.split(', ')[1] || '--:--'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.clientName}>{app.client?.full_name || app.guest_name || 'Misafir'}</Text>
                <Text style={styles.serviceName}>{app.service_name}</Text>
              </View>
              <View style={styles.statusCol}>
                {app.status === 'confirmed' ? <Ionicons name="checkmark-circle" size={24} color="#4CAF50" /> : <Ionicons name="time" size={24} color="#FFC107" />}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* --- SERTİFİKALAR --- */}
        <View style={[styles.sectionHeader, {marginTop: 20}]}>
          <Text style={styles.sectionTitle}>🏆 Sertifikalarım</Text>
          <TouchableOpacity onPress={() => setModalVisible('cert')}><Ionicons name="add-circle" size={24} color="#0095F6"/></TouchableOpacity>
        </View>
        {certificates.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Sertifika eklemek için (+)’ya bas.</Text></View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {certificates.map((cert, i) => (
              <View key={i} style={styles.certCard}>
                <Image source={{ uri: cert.image_url }} style={styles.certImage} />
                <Text style={styles.certTitle}>{cert.title}</Text>
              </View>
            ))}
          </ScrollView>
        )}

      </ScrollView>

      {/* ================= MODALLAR ================= */}

      {/* 1. WALK-IN (AKILLI SEÇİM) */}
      <Modal visible={modalVisible === 'walkIn'} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Dışarıdan Ekle</Text>
          
          <Text style={styles.label}>Müşteri Adı</Text>
          <TextInput style={styles.input} placeholder="Örn: Mehmet Bey" placeholderTextColor="#666" value={guestName} onChangeText={setGuestName} />
          
          <Text style={styles.label}>Hizmet Seç</Text>
          <View style={{height: 50, marginBottom: 15}}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {businessServices.map((srv, i) => (
                <TouchableOpacity key={i} style={[styles.chip, selectedService?.name === srv.name && styles.selectedChip]} onPress={() => setSelectedService(srv)}>
                  <Text style={[styles.chipText, selectedService?.name === srv.name && {color:'#000'}]}>{srv.name} ({srv.price})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.label}>Saat Seç</Text>
          <View style={{height: 150}}>
             <ScrollView nestedScrollEnabled={true}><View style={styles.timeGrid}>
                  {TIME_SLOTS.map((slot, i) => {
                    const booked = isTimeBooked(slot);
                    return (<TouchableOpacity key={i} disabled={booked} style={[styles.timeSlot, booked && styles.bookedSlot, selectedTime === slot && styles.selectedSlot]} onPress={() => setSelectedTime(slot)}><Text style={[styles.timeSlotText, booked && {color:'#444'}, selectedTime === slot && {color:'#fff'}]}>{slot}</Text></TouchableOpacity>);
                  })}
             </View></ScrollView>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleAddWalkIn}><Text style={styles.saveBtnText}>Listeye Ekle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible('none')}><Text style={{color:'#999'}}>İptal</Text></TouchableOpacity>
      </View></View></Modal>

      {/* 2. MOLA (YENİ & AKILLI) */}
      <Modal visible={modalVisible === 'break'} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Mola Ver ☕</Text>
          <Text style={styles.label}>Başlangıç Saati</Text>
          <View style={{height: 120, marginBottom: 15}}>
             <ScrollView nestedScrollEnabled={true}><View style={styles.timeGrid}>
                  {TIME_SLOTS.map((slot, i) => {
                    const booked = isTimeBooked(slot);
                    return (<TouchableOpacity key={i} disabled={booked} style={[styles.timeSlot, booked && styles.bookedSlot, breakStartTime === slot && styles.selectedSlot]} onPress={() => setBreakStartTime(slot)}><Text style={[styles.timeSlotText, booked && {color:'#444'}, breakStartTime === slot && {color:'#fff'}]}>{slot}</Text></TouchableOpacity>);
                  })}
             </View></ScrollView>
          </View>
          <Text style={styles.label}>Süre</Text>
          <View style={styles.chipContainer}>{BREAK_DURATIONS.map((dur, i) => (<TouchableOpacity key={i} style={[styles.chip, breakDuration === dur && styles.selectedChip]} onPress={() => setBreakDuration(dur)}><Text style={[styles.chipText, breakDuration === dur && {color:'#000'}]}>{dur} dk</Text></TouchableOpacity>))}</View>
          <Text style={styles.label}>Not</Text>
          <TextInput style={styles.input} placeholder="Örn: Yemek" placeholderTextColor="#666" value={breakNote} onChangeText={setBreakNote} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAddBreak}><Text style={styles.saveBtnText}>Molayı Kaydet</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible('none')}><Text style={{color:'#999'}}>İptal</Text></TouchableOpacity>
      </View></View></Modal>

      {/* 3. PERSONEL DEĞİŞTİR & SİL */}
      <Modal visible={modalVisible === 'switchStaff'} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContent, {maxHeight:'60%'}]}>
          <Text style={styles.modalTitle}>Personel Yönetimi</Text>
          <FlatList data={allStaff} keyExtractor={(item) => item.id} renderItem={({item}) => (
              <View style={styles.modalStaffRow}>
                <TouchableOpacity style={styles.staffInfoArea} onPress={() => loadStaffData(item)}><Image source={{ uri: item.avatar_url }} style={{width:30, height:30, borderRadius:15, marginRight:10}} /><Text style={styles.modalItemText}>{item.full_name}</Text>{item.id === currentStaff?.id && <Ionicons name="checkmark" size={20} color="#4CAF50" style={{marginLeft:5}}/>}</TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteStaff(item.id, item.full_name)} style={{padding:5}}><Ionicons name="trash-outline" size={20} color="#F44336" /></TouchableOpacity>
              </View>
          )}/>
          <TouchableOpacity style={styles.closeBtnModal} onPress={() => setModalVisible('none')}><Text style={styles.closeBtnText}>Kapat</Text></TouchableOpacity>
      </View></View></Modal>

      {/* 4. CRM */}
      <Modal visible={modalVisible === 'customerCRM'} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{selectedCustomerName}</Text><Text style={styles.subText}>Müşteri Notları</Text>
          <TextInput style={styles.noteInput} multiline placeholder="Not ekle..." placeholderTextColor="#666" value={customerNote} onChangeText={setCustomerNote}/>
          <TouchableOpacity style={styles.saveBtn} onPress={saveCustomerNote}><Text style={styles.saveBtnText}>Notu Kaydet</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible('none')}><Text style={{color:'#999'}}>Kapat</Text></TouchableOpacity>
      </View></View></Modal>

      {/* 5. MÜŞTERİ DEFTERİ */}
      <Modal visible={modalVisible === 'customerList'} transparent animationType="slide"><View style={styles.modalOverlay}><View style={[styles.modalContent, {maxHeight:'80%'}]}>
          <Text style={styles.modalTitle}>Müşteri Defteri 📒</Text>
          <FlatList data={allCustomerNames} keyExtractor={(item) => item} renderItem={({ item }) => (<TouchableOpacity style={styles.modalItem} onPress={() => { setModalVisible('none'); setTimeout(()=>openCustomerCRM(item), 500); }}><Ionicons name="person-circle" size={30} color="#ccc" /><Text style={styles.modalItemText}>{item}</Text><Ionicons name="create-outline" size={20} color="#0095F6" /></TouchableOpacity>)}/>
          <TouchableOpacity style={styles.closeBtnModal} onPress={() => setModalVisible('none')}><Text style={styles.closeBtnText}>Kapat</Text></TouchableOpacity>
      </View></View></Modal>

      {/* 6. SERTİFİKA */}
      <Modal visible={modalVisible === 'cert'} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sertifika Ekle</Text>
          <TextInput style={styles.input} placeholder="Belge Adı" placeholderTextColor="#666" value={certTitle} onChangeText={setCertTitle} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAddCert}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible('none')}><Text style={{color:'#999'}}>İptal</Text></TouchableOpacity>
      </View></View></Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#333' },
  staffName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  roleText: { color: '#888', fontSize: 14 },
  
  // --- DÜZELTİLEN ÇIKIŞ BUTONU ---
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  switchBtn: { flexDirection: 'row', alignItems: 'center' },

  statsGrid: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: '#1E1E1E', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  iconBgGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(76, 175, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  iconBgBlue: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 149, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statLabel: { color: '#888', fontSize: 12 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0095F6', padding: 15, borderRadius: 12 },
  actionText: { color: '#fff', fontWeight: 'bold' },
  customerListBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 25, justifyContent: 'space-between', borderWidth: 1, borderColor: '#333' },
  customerListText: { color: '#fff', fontWeight: '600', flex: 1, marginLeft: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loyalCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginRight: 10, alignItems: 'center', minWidth: 110, borderWidth: 1, borderColor: '#333' },
  loyalIcon: { marginBottom: 5 },
  loyalName: { color: '#fff', fontWeight: 'bold', marginBottom: 2 },
  loyalCount: { color: '#888', fontSize: 10 },
  emptyBox: { backgroundColor: '#111', padding: 20, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  emptyText: { color: '#666', fontStyle: 'italic' },
  appointmentCard: { flexDirection: 'row', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4 },
  confirmedBorder: { borderLeftColor: '#4CAF50' },
  pendingBorder: { borderLeftColor: '#FFC107' },
  timeCol: { alignItems: 'center', marginRight: 15, borderRightWidth: 1, borderRightColor: '#333', paddingRight: 15, width: 60 },
  timeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  infoCol: { flex: 1 },
  clientName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  serviceName: { color: '#888', fontSize: 14 },
  statusCol: { justifyContent: 'center' },
  breakCard: { flexDirection: 'row', backgroundColor: '#222', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', gap: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#666' },
  breakText: { color: '#fff', fontWeight: 'bold' },
  breakTime: { color: '#888', fontSize: 12 },
  certCard: { marginRight: 15, alignItems: 'center' },
  certImage: { width: 120, height: 80, borderRadius: 8, marginBottom: 5, backgroundColor: '#333' },
  certTitle: { color: '#ccc', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subText: { color: '#888', textAlign:'center', marginBottom:15 },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  noteInput: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333', height: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalItemText: { color: '#fff', fontSize: 16, flex: 1 },
  modalStaffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  staffInfoArea: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  closeBtnModal: { marginTop: 20, padding: 15, backgroundColor: '#333', borderRadius: 10, alignItems: 'center', width: '100%' },
  closeBtnText: { color: '#fff', fontWeight: 'bold' },
  label: { color: '#0095F6', fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  selectedChip: { backgroundColor: '#fff' },
  chipText: { color: '#ccc', fontSize: 12 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  timeSlot: { width: '22%', backgroundColor: '#333', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  bookedSlot: { backgroundColor: '#222', opacity: 0.3 },
  selectedSlot: { backgroundColor: '#0095F6' },
  timeSlotText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});