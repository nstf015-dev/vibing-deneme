import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type TimeSlot = {
  time: string;
  disabled: boolean;
  reason?: 'booked' | 'break';
};

const generateDaySlots = () => {
  const slots: TimeSlot[] = [];
  let currentMinutes = 9 * 60;
  const endMinutes = 21 * 60;
  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (currentMinutes % 60).toString().padStart(2, '0');
    slots.push({ time: `${h}:${m}`, disabled: false });
    currentMinutes += 30;
  }
  return slots;
};

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  // Gelenler: business_id, service_name, price, business_name

  const [loading, setLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<any>(null);
  const [variablePricing, setVariablePricing] = useState<any[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<Record<string, string>>({});
  
  // Seçimler
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  
  const days = useMemo(() => getNextDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]); // Varsayılan bugün
  
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const fetchServiceAndStaff = useCallback(async () => {
    try {
      // A. Hizmetin süresini ve gereksinimlerini öğren
      const { data: serviceData } = await supabase
        .from('business_services')
        .select('*')
        .eq('business_id', params.business_id)
        .eq('name', params.service_name)
        .single();

      setServiceDetails(serviceData);

      // Variable pricing çek
      if (serviceData?.id) {
        const { data: pricingData } = await supabase
          .from('service_variable_pricing')
          .select('*')
          .eq('service_id', serviceData.id);
        setVariablePricing(pricingData || []);
      }

      // B. Bu hizmeti yapabilen personelleri bul (staff_services tablosunu kullan)
      const { data: serviceIdData } = await supabase
        .from('business_services')
        .select('id')
        .eq('business_id', params.business_id)
        .eq('name', params.service_name)
        .single();

      if (serviceIdData?.id) {
        // staff_services tablosundan bu hizmeti yapabilen personelleri bul
        const { data: staffServicesData } = await supabase
          .from('staff_services')
          .select('staff_id')
          .eq('service_id', serviceIdData.id);

        if (staffServicesData && staffServicesData.length > 0) {
          const staffIds = staffServicesData.map((s: any) => s.staff_id);
          const { data: assignedStaff } = await supabase
            .from('staff')
            .select('*')
            .eq('business_id', params.business_id)
            .in('id', staffIds);

          setStaffList(assignedStaff || []);
        } else {
          // Eğer staff_services'de kayıt yoksa, eski yöntemi kullan (geriye dönük uyumluluk)
          const { data: allStaff } = await supabase
            .from('staff')
            .select('*')
            .eq('business_id', params.business_id);

          if (allStaff) {
            const requiredRoles = serviceData?.required_staff_roles || [];
            const filteredStaff = allStaff.filter(staff => {
              if (!requiredRoles || requiredRoles.length === 0) return true;
              const staffSkills = staff.skills || [];
              return requiredRoles.some((role: string) => staffSkills.includes(role));
            });
            setStaffList(filteredStaff);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }, [params.business_id, params.service_name]);

  useEffect(() => {
    fetchServiceAndStaff();
  }, [fetchServiceAndStaff]);

  // 2. MÜSAİT SAATLERİ HESAPLA (MATRİX LOGIC) 🧠
  const calculateAvailableSlots = useCallback(async () => {
    if (!selectedStaff || !selectedDate || !serviceDetails) return;

    const serviceDuration = serviceDetails.duration || 30;
    const paddingTime = serviceDetails.padding_time || 0;
    const totalDuration = serviceDuration + paddingTime; // Toplam süre (hizmet + temizlik)

    const { data: appointments } = await supabase
      .from('appointments')
      .select('date, status, service_name')
      .eq('staff_id', selectedStaff.id)
      .eq('status', 'confirmed')
      .ilike('date', `%${selectedDate.dateString}%`);

    const { data: breaks } = await supabase
      .from('staff_breaks')
      .select('start_time')
      .eq('staff_id', selectedStaff.id);

    // Vardiya kontrolü
    const { data: shifts } = await supabase
      .from('staff_shifts')
      .select('start_time, end_time, break_start, break_end, is_available')
      .eq('staff_id', selectedStaff.id)
      .eq('shift_date', selectedDate.dateString);

    // Tüm randevuların hizmet detaylarını önceden çek
    const appointmentServices: Record<string, { duration: number; padding_time: number }> = {};
    if (appointments && appointments.length > 0) {
      const uniqueServiceNames = [...new Set(appointments.map((app) => app.service_name))];
      const { data: servicesData } = await supabase
        .from('business_services')
        .select('name, duration, padding_time')
        .eq('business_id', params.business_id)
        .in('name', uniqueServiceNames);

      if (servicesData) {
        servicesData.forEach((svc) => {
          appointmentServices[svc.name] = {
            duration: svc.duration || 30,
            padding_time: svc.padding_time || 0,
          };
        });
      }
    }

    const baseSlots = generateDaySlots();
    const updatedSlots: TimeSlot[] = baseSlots.map((slot) => {
      // Vardiya kontrolü
      const shift = shifts?.[0];
      if (shift && !shift.is_available) {
        return { ...slot, disabled: true, reason: 'break' as const };
      }
      if (shift) {
        const slotMinutes = parseInt(slot.time.split(':')[0]) * 60 + parseInt(slot.time.split(':')[1]);
        const shiftStartMinutes = parseInt(shift.start_time.split(':')[0]) * 60 + parseInt(shift.start_time.split(':')[1]);
        const shiftEndMinutes = parseInt(shift.end_time.split(':')[0]) * 60 + parseInt(shift.end_time.split(':')[1]);
        
        if (slotMinutes < shiftStartMinutes || slotMinutes + totalDuration > shiftEndMinutes) {
          return { ...slot, disabled: true, reason: 'break' as const };
        }

        // Mola kontrolü
        if (shift.break_start && shift.break_end) {
          const breakStartMinutes = parseInt(shift.break_start.split(':')[0]) * 60 + parseInt(shift.break_start.split(':')[1]);
          const breakEndMinutes = parseInt(shift.break_end.split(':')[0]) * 60 + parseInt(shift.break_end.split(':')[1]);
          
          if (slotMinutes < breakEndMinutes && slotMinutes + totalDuration > breakStartMinutes) {
            return { ...slot, disabled: true, reason: 'break' as const };
          }
        }
      }

      // Randevu çakışma kontrolü (padding time dahil)
      const isBooked = appointments?.some((app) => {
        if (!app.date) return false;
        const appTimeMatch = app.date.match(/(\d{2}):(\d{2})/);
        if (!appTimeMatch) return false;
        
        const appMinutes = parseInt(appTimeMatch[1]) * 60 + parseInt(appTimeMatch[2]);
        const slotMinutes = parseInt(slot.time.split(':')[0]) * 60 + parseInt(slot.time.split(':')[1]);
        
        // Önceden çekilen hizmet detaylarını kullan
        const appService = appointmentServices[app.service_name] || { duration: 30, padding_time: 0 };
        const appDuration = appService.duration + appService.padding_time;
        
        // Çakışma kontrolü: Yeni randevu başlangıcı, mevcut randevunun bitişinden önce olmamalı
        return slotMinutes < appMinutes + appDuration && slotMinutes + totalDuration > appMinutes;
      });

      const isBreak = breaks?.some((brk) => brk.start_time === slot.time);
      
      if (isBooked || isBreak) {
        return {
          ...slot,
          disabled: true,
          reason: (isBooked ? 'booked' : 'break') as 'booked' | 'break',
        };
      }
      return slot;
    });

    setTimeSlots(updatedSlots);
    setSelectedTime((prev) => {
      if (!prev) return prev;
      const stillAvailable = updatedSlots.find((slot) => slot.time === prev && !slot.disabled);
      return stillAvailable ? prev : null;
    });
  }, [selectedDate, selectedStaff, serviceDetails, params.business_id]);

  useEffect(() => {
    if (selectedStaff && selectedDate) {
      calculateAvailableSlots();
    }
  }, [selectedStaff, selectedDate, calculateAvailableSlots]);

  // Fiyat hesaplama (variable pricing dahil)
  const calculateTotalPrice = useMemo(() => {
    if (!serviceDetails) return params.price || '0₺';
    
    let basePrice = serviceDetails.base_price || parseFloat((serviceDetails.price || '0').replace(/[^0-9.]/g, '')) || 0;
    
    // Variable pricing eklemeleri
    Object.values(selectedVariables).forEach((optionName) => {
      const variable = variablePricing.find(
        (vp) => vp.option_name === optionName
      );
      if (variable) {
        basePrice += variable.price_modifier;
      }
    });

    return `${basePrice.toFixed(0)}₺`;
  }, [serviceDetails, selectedVariables, variablePricing, params.price]);

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
        price: calculateTotalPrice,
        date: prettyDate,
        status: 'pending' // Onay bekliyor
      });

      if (error) throw error;

      const staffName = selectedStaff.full_name || selectedStaff.name || 'personel';
      const businessName = params.business_name || 'işletme';
      Alert.alert(
        'Harika! 🎉',
        `${businessName} / ${staffName} için randevu talebin alındı. İşletme onaylayınca bildirim alacaksın.`,
        [{ text: 'Tamam', onPress: () => router.replace('/(tabs)/appointments') }]
      );

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
              <Text style={styles.durationText}>
                {serviceDetails?.duration || 30} dk
                {serviceDetails?.padding_time && serviceDetails.padding_time > 0 && (
                  <Text style={{ color: '#888' }}> + {serviceDetails.padding_time} dk temizlik</Text>
                )}
              </Text>
            </View>
            {serviceDetails?.description && (
              <Text style={styles.serviceDescription}>{serviceDetails.description}</Text>
            )}
          </View>
          <Text style={styles.price}>{calculateTotalPrice}</Text>
        </View>

        {/* DEĞİŞKEN FİYATLANDIRMA */}
        {variablePricing.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Seçenekler</Text>
            {Object.entries(
              variablePricing.reduce((acc: Record<string, any[]>, vp) => {
                if (!acc[vp.variable_name]) acc[vp.variable_name] = [];
                acc[vp.variable_name].push(vp);
                return acc;
              }, {})
            ).map(([variableName, options]) => (
              <View key={variableName} style={styles.variableGroup}>
                <Text style={styles.variableLabel}>{variableName}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
                  {options.map((option) => {
                    const isSelected = selectedVariables[variableName] === option.option_name;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                        onPress={() => {
                          setSelectedVariables((prev) => ({
                            ...prev,
                            [variableName]: isSelected ? '' : option.option_name,
                          }));
                        }}>
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                          {option.option_name}
                        </Text>
                        <Text style={[styles.optionPrice, isSelected && styles.optionPriceSelected]}>
                          {option.price_modifier >= 0 ? '+' : ''}{option.price_modifier}₺
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </>
        )}

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
            <View style={styles.slotsGrid}>
              {timeSlots.map((slot, index) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slot,
                      isSelected && styles.selectedSlot,
                      slot.disabled && styles.disabledSlot,
                    ]}
                    onPress={() => !slot.disabled && setSelectedTime(slot.time)}
                    disabled={slot.disabled}>
                    <Text
                      style={[
                        styles.slotText,
                        isSelected && styles.selectedSlotText,
                        slot.disabled && styles.disabledSlotText,
                      ]}>
                      {slot.time}
                    </Text>
                    {slot.disabled && (
                      <Text style={styles.slotBadge}>{slot.reason === 'booked' ? 'Dolu' : 'Mola'}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

      </ScrollView>

      {/* ALT BUTON */}
      <View style={styles.footer}>
        <View style={{flex:1}}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalPrice}>{calculateTotalPrice}</Text>
        </View>
        <View style={styles.footerButtons}>
          <TouchableOpacity 
            style={styles.waitlistBtn}
            onPress={() => router.push({
              pathname: '/waitlist',
              params: {
                business_id: params.business_id,
                service_name: params.service_name,
              }
            })}
          >
            <Ionicons name="time-outline" size={16} color="#0095F6" />
            <Text style={styles.waitlistText}>Bekleme Listesi</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.multiServiceBtn}
            onPress={() => router.push({
              pathname: '/multi-service-booking',
              params: {
                business_id: params.business_id,
                service_name: params.service_name,
              }
            })}
          >
            <Ionicons name="add-circle-outline" size={16} color="#9C27B0" />
            <Text style={styles.multiServiceText}>Hizmet Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.confirmBtn, (!selectedStaff || !selectedTime) && {backgroundColor:'#333'}]} 
            onPress={confirmBooking}
            disabled={!selectedStaff || !selectedTime}
          >
            <Text style={[styles.confirmText, (!selectedStaff || !selectedTime) && {color:'#666'}]}>Onayla</Text>
          </TouchableOpacity>
        </View>
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
  serviceDescription: { color: '#aaa', fontSize: 13, marginTop: 8, lineHeight: 18 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#333', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  durationText: { color: '#ccc', fontSize: 12, marginLeft: 4 },
  price: { color: '#4CAF50', fontWeight: 'bold', fontSize: 20 },
  variableGroup: { marginBottom: 20 },
  variableLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  optionsScroll: { marginBottom: 10 },
  optionChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  optionChipSelected: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  optionText: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  optionTextSelected: { color: '#000' },
  optionPrice: { color: '#888', fontSize: 12 },
  optionPriceSelected: { color: '#000' },

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
  disabledSlot: { opacity: 0.5, borderColor: '#222', backgroundColor: '#151515' },
  slotText: { color: '#fff', fontWeight: '600' },
  selectedSlotText: { color: '#fff' },
  disabledSlotText: { color: '#777' },
  slotBadge: { color: '#ccc', fontSize: 10, marginTop: 4 },

  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingBottom: 30, backgroundColor: '#1E1E1E', borderTopWidth: 1, borderTopColor: '#333' },
  footerButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  totalLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  totalPrice: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  waitlistBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#111', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 30, 
    borderWidth: 1, 
    borderColor: '#0095F6' 
  },
  waitlistText: { color: '#0095F6', fontWeight: '600', fontSize: 14 },
  multiServiceBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#111', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 30, 
    borderWidth: 1, 
    borderColor: '#9C27B0',
    marginTop: 8,
  },
  multiServiceText: { color: '#9C27B0', fontWeight: '600', fontSize: 14 },
  confirmBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});