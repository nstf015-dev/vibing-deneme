import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { findMultiServiceSlots, createMultiServiceAppointment, calculateMultiServicePrice, ServiceSelection } from '../services/booking/multi-service-booking';
import { calculateAvailability } from '../services/booking/availability-calculator';
import { useBookingStore } from '../store/contexts/BookingContext';

const getNextDays = () => {
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      dateString: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
      dayNumber: d.getDate(),
      fullDate: d,
    });
  }
  return days;
};

export default function MultiServiceBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { selectedServices, addService, removeService, clearBooking, setDate, setTime, setStaff, setBusiness } = useBookingStore();

  const [loading, setLoading] = useState(true);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [serviceModal, setServiceModal] = useState(false);
  const [variablePricingSelections, setVariablePricingSelections] = useState<Record<string, Record<string, string>>>({});

  const days = useMemo(() => getNextDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);

  const businessId = params.business_id as string;

  useEffect(() => {
    if (businessId) {
      setBusiness(businessId);
      fetchData();
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedServices.length > 0) {
      calculatePrice();
      if (selectedDate) {
        findSlots();
      }
    }
  }, [selectedServices, selectedDate, selectedStaff]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch services
      const { data: services } = await supabase
        .from('business_services')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      setAvailableServices(services || []);

      // Fetch staff
      const { data: staff } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true);

      setStaffList(staff || []);

      // If coming from single service booking, add it
      if (params.service_name) {
        const service = services?.find((s) => s.name === params.service_name);
        if (service) {
          addService({
            serviceId: service.id,
            serviceName: service.name,
            duration: service.duration || 30,
            paddingTime: service.padding_time || 0,
            basePrice: service.base_price || parseFloat((service.price || '0').replace(/[^0-9.]/g, '')) || 0,
            staffId: params.staff_id as string | undefined,
          });
        }
      }
    } catch (error) {
      console.error('Data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = async () => {
    const services: ServiceSelection[] = selectedServices.map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      duration: s.duration,
      paddingTime: s.paddingTime,
      variablePricing: variablePricingSelections[s.serviceId],
    }));

    const price = await calculateMultiServicePrice(services);
    setTotalPrice(price);
  };

  const findSlots = async () => {
    if (selectedServices.length === 0 || !selectedDate) return;

    try {
      const totalDuration = selectedServices.reduce(
        (sum, s) => sum + s.duration + s.paddingTime,
        0
      );

      if (selectedStaff) {
        // Find slots for specific staff
        const slots = await calculateAvailability({
          businessId,
          staffId: selectedStaff.id,
          date: selectedDate.dateString,
          duration: totalDuration,
        });

        setAvailableSlots(slots.filter((s) => s.available));
      } else {
        // Find slots using multi-service booking
        const services: ServiceSelection[] = selectedServices.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          duration: s.duration,
          paddingTime: s.paddingTime,
        }));

        const bookingSlots = await findMultiServiceSlots({
          businessId,
          services,
          date: selectedDate.dateString,
        });

        setAvailableSlots(bookingSlots);
      }
    } catch (error) {
      console.error('Slot find error:', error);
    }
  };

  const handleAddService = (service: any) => {
    addService({
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration || 30,
      paddingTime: service.padding_time || 0,
      basePrice: service.base_price || parseFloat((service.price || '0').replace(/[^0-9.]/g, '')) || 0,
    });
    setServiceModal(false);
  };

  const handleConfirmBooking = async () => {
    if (selectedServices.length === 0 || !selectedSlot || !selectedDate) {
      Alert.alert('Eksik Bilgi', 'Lütfen hizmet, tarih ve saat seçiniz.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Rezervasyon yapmak için giriş yapmalısınız.');
        return;
      }

      const services: ServiceSelection[] = selectedServices.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        duration: s.duration,
        paddingTime: s.paddingTime,
        variablePricing: variablePricingSelections[s.serviceId],
      }));

      const result = await createMultiServiceAppointment({
        businessId,
        clientId: user.id,
        staffId: selectedSlot.staffId || selectedStaff?.id || '',
        date: selectedDate.dateString,
        startTime: selectedSlot.startTime || selectedSlot.time,
        services,
        totalPrice,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      Alert.alert(
        'Başarılı! 🎉',
        'Rezervasyonunuz oluşturuldu. İşletme onayı bekleniyor.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              clearBooking();
              router.replace('/(tabs)/appointments');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Rezervasyon oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && availableServices.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Çoklu Hizmet Rezervasyonu</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* SELECTED SERVICES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Seçili Hizmetler</Text>
            <TouchableOpacity
              onPress={() => setServiceModal(true)}
              style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color="#0095F6" />
              <Text style={styles.addButtonText}>Hizmet Ekle</Text>
            </TouchableOpacity>
          </View>

          {selectedServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>Henüz hizmet seçilmedi</Text>
              <TouchableOpacity
                onPress={() => setServiceModal(true)}
                style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Hizmet Seç</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.servicesList}>
              {selectedServices.map((service, index) => (
                <View key={service.serviceId} style={styles.serviceCard}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.serviceName}</Text>
                    <Text style={styles.serviceDuration}>
                      {service.duration} dk
                      {service.paddingTime > 0 && ` + ${service.paddingTime} dk temizlik`}
                    </Text>
                    <Text style={styles.servicePrice}>{service.basePrice}₺</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeService(service.serviceId)}
                    style={styles.removeButton}>
                    <Ionicons name="close-circle" size={24} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Toplam Süre:</Text>
                <Text style={styles.totalValue}>
                  {selectedServices.reduce((sum, s) => sum + s.duration + s.paddingTime, 0)} dk
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* STAFF SELECTION */}
        {selectedServices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uzman Seç (Opsiyonel)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.staffChip, !selectedStaff && styles.staffChipActive]}
                onPress={() => setSelectedStaff(null)}>
                <Text style={[styles.staffChipText, !selectedStaff && styles.staffChipTextActive]}>
                  Herhangi Biri
                </Text>
              </TouchableOpacity>
              {staffList.map((staff) => (
                <TouchableOpacity
                  key={staff.id}
                  style={[styles.staffChip, selectedStaff?.id === staff.id && styles.staffChipActive]}
                  onPress={() => setSelectedStaff(staff)}>
                  <Text
                    style={[
                      styles.staffChipText,
                      selectedStaff?.id === staff.id && styles.staffChipTextActive,
                    ]}>
                    {staff.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* DATE SELECTION */}
        {selectedServices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tarih Seç</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {days.map((day) => (
                <TouchableOpacity
                  key={day.dateString}
                  style={[
                    styles.dateCard,
                    selectedDate.dateString === day.dateString && styles.dateCardActive,
                  ]}
                  onPress={() => {
                    setSelectedDate(day);
                    setDate(day.dateString);
                  }}>
                  <Text
                    style={[
                      styles.dayName,
                      selectedDate.dateString === day.dateString && styles.dayNameActive,
                    ]}>
                    {day.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      selectedDate.dateString === day.dateString && styles.dayNumberActive,
                    ]}>
                    {day.dayNumber}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* TIME SLOTS */}
        {selectedServices.length > 0 && availableSlots.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saat Seç</Text>
            <View style={styles.slotsGrid}>
              {availableSlots.slice(0, 20).map((slot, index) => {
                const isSelected = selectedSlot?.time === slot.time || selectedSlot?.startTime === slot.startTime;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.slot, isSelected && styles.slotSelected]}
                    onPress={() => {
                      setSelectedSlot(slot);
                      setTime(slot.time || slot.startTime);
                    }}>
                    <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                      {slot.time || slot.startTime}
                    </Text>
                    {slot.endTime && (
                      <Text style={[styles.slotEndTime, isSelected && styles.slotEndTimeSelected]}>
                        - {slot.endTime}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* FOOTER */}
      {selectedServices.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>Toplam</Text>
            <Text style={styles.footerPrice}>{totalPrice.toFixed(0)}₺</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmButton, (!selectedSlot || loading) && styles.confirmButtonDisabled]}
            onPress={handleConfirmBooking}
            disabled={!selectedSlot || loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.confirmButtonText}>Rezervasyon Yap</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* SERVICE SELECTION MODAL */}
      <Modal visible={serviceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hizmet Seç</Text>
              <TouchableOpacity onPress={() => setServiceModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableServices.filter((s) => !selectedServices.some((ss) => ss.serviceId === s.id))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.serviceOption}
                  onPress={() => handleAddService(item)}>
                  <View style={styles.serviceOptionInfo}>
                    <Text style={styles.serviceOptionName}>{item.name}</Text>
                    <Text style={styles.serviceOptionMeta}>
                      {item.duration} dk • {item.base_price || item.price}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#0095F6" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 100 },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0095F620',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: { color: '#0095F6', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', marginTop: 16, marginBottom: 20 },
  primaryButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  primaryButtonText: { color: '#000', fontWeight: 'bold' },
  servicesList: { gap: 12 },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceInfo: { flex: 1 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  serviceDuration: { color: '#888', fontSize: 14, marginBottom: 4 },
  servicePrice: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  removeButton: { padding: 5 },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  totalLabel: { color: '#888', fontSize: 14 },
  totalValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  staffChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  staffChipActive: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  staffChipText: { color: '#fff', fontSize: 14 },
  staffChipTextActive: { color: '#000', fontWeight: 'bold' },
  dateCard: {
    backgroundColor: '#1E1E1E',
    width: 70,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateCardActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  dayName: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  dayNameActive: { color: '#000' },
  dayNumber: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  dayNumberActive: { color: '#000' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: '22%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
  },
  slotSelected: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  slotText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  slotTextSelected: { color: '#000' },
  slotEndTime: { color: '#888', fontSize: 10, marginTop: 2 },
  slotEndTimeSelected: { color: '#000' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerInfo: { flex: 1 },
  footerLabel: { color: '#888', fontSize: 12 },
  footerPrice: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  confirmButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
  },
  confirmButtonDisabled: { backgroundColor: '#333', opacity: 0.5 },
  confirmButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  serviceOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  serviceOptionInfo: { flex: 1 },
  serviceOptionName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  serviceOptionMeta: { color: '#888', fontSize: 14 },
});

