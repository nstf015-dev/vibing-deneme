import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

type Staff = {
  id: string;
  full_name: string;
  role: string | null;
};

type Shift = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_available: boolean;
};

export default function StaffShiftManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const businessId = params.business_id as string | undefined;

  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftModal, setShiftModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Shift form states
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('18:00');
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakEndTime, setBreakEndTime] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (businessId) {
      fetchStaff();
    } else {
      fetchCurrentBusiness();
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedStaff) {
      fetchShifts();
    }
  }, [selectedStaff, selectedDate]);

  const fetchCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'business')
          .single();
        if (data) {
          fetchStaff(data.id);
        }
      }
    } catch (error) {
      console.error('İşletme bulunamadı:', error);
    }
  };

  const fetchStaff = useCallback(async (bid?: string) => {
    const id = bid || businessId;
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', id)
        .order('full_name');

      if (error) throw error;
      setStaff(data || []);
      if (data && data.length > 0) {
        setSelectedStaff(data[0]);
      }
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const fetchShifts = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      const { data, error } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', selectedStaff.id)
        .eq('shift_date', selectedDate)
        .order('start_time');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Vardiya yükleme hatası:', error);
    }
  }, [selectedStaff, selectedDate]);

  const saveShift = async () => {
    if (!selectedStaff || !shiftStartTime || !shiftEndTime) {
      Alert.alert('Hata', 'Lütfen başlangıç ve bitiş saatlerini girin.');
      return;
    }

    try {
      const id = businessId || (await supabase.auth.getUser()).data.user?.id;
      if (!id) throw new Error('İşletme bulunamadı');

      const { error } = await supabase.from('staff_shifts').insert({
        staff_id: selectedStaff.id,
        business_id: id,
        shift_date: selectedDate,
        start_time: shiftStartTime,
        end_time: shiftEndTime,
        break_start: breakStartTime || null,
        break_end: breakEndTime || null,
        is_available: isAvailable,
      });

      if (error) throw error;

      Alert.alert('Başarılı', 'Vardiya eklendi.');
      setShiftModal(false);
      resetForm();
      fetchShifts();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Vardiya eklenemedi.');
    }
  };

  const deleteShift = async (shiftId: string) => {
    try {
      const { error } = await supabase.from('staff_shifts').delete().eq('id', shiftId);
      if (error) throw error;
      Alert.alert('Başarılı', 'Vardiya silindi.');
      fetchShifts();
    } catch (error: any) {
      Alert.alert('Hata', 'Silinemedi.');
    }
  };

  const resetForm = () => {
    setShiftStartTime('09:00');
    setShiftEndTime('18:00');
    setBreakStartTime('');
    setBreakEndTime('');
    setIsAvailable(true);
  };

  const openShiftModal = () => {
    resetForm();
    setShiftModal(true);
  };

  const renderStaff = ({ item }: { item: Staff }) => (
    <TouchableOpacity
      style={[
        styles.staffChip,
        selectedStaff?.id === item.id && styles.staffChipActive,
      ]}
      onPress={() => setSelectedStaff(item)}>
      <Text
        style={[
          styles.staffChipText,
          selectedStaff?.id === item.id && styles.staffChipTextActive,
        ]}>
        {item.full_name}
      </Text>
    </TouchableOpacity>
  );

  const renderShift = ({ item }: { item: Shift }) => (
    <View style={styles.shiftCard}>
      <View style={styles.shiftInfo}>
        <View style={styles.shiftTimeRow}>
          <Ionicons name="time-outline" size={16} color="#0095F6" />
          <Text style={styles.shiftTime}>
            {item.start_time} - {item.end_time}
          </Text>
        </View>
        {item.break_start && item.break_end && (
          <View style={styles.breakRow}>
            <Ionicons name="cafe-outline" size={14} color="#FFC107" />
            <Text style={styles.breakTime}>
              Mola: {item.break_start} - {item.break_end}
            </Text>
          </View>
        )}
        {!item.is_available && (
          <View style={styles.unavailableBadge}>
            <Text style={styles.unavailableText}>Müsait Değil</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={() => deleteShift(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vardiya Yönetimi</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Personel Seçimi */}
      <View style={styles.staffSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {staff.map((s) => (
            <View key={s.id}>{renderStaff({ item: s })}</View>
          ))}
        </ScrollView>
      </View>

      {/* Tarih Seçimi */}
      <View style={styles.dateSelector}>
        <Text style={styles.dateLabel}>Tarih:</Text>
        <TextInput
          style={styles.dateInput}
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#666"
        />
      </View>

      {/* Vardiya Listesi */}
      <FlatList
        data={shifts}
        renderItem={renderShift}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Bu tarihte vardiya yok</Text>
          </View>
        }
      />

      {/* Vardiya Ekleme Butonu */}
      {selectedStaff && (
        <TouchableOpacity style={styles.addButton} onPress={openShiftModal}>
          <Ionicons name="add" size={24} color="#000" />
          <Text style={styles.addButtonText}>Vardiya Ekle</Text>
        </TouchableOpacity>
      )}

      {/* VARDİYA EKLEME MODALI */}
      <Modal visible={shiftModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Vardiya</Text>
              <TouchableOpacity onPress={() => setShiftModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Başlangıç Saati</Text>
                <TextInput
                  style={styles.input}
                  value={shiftStartTime}
                  onChangeText={setShiftStartTime}
                  placeholder="09:00"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bitiş Saati</Text>
                <TextInput
                  style={styles.input}
                  value={shiftEndTime}
                  onChangeText={setShiftEndTime}
                  placeholder="18:00"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mola Başlangıç (Opsiyonel)</Text>
                <TextInput
                  style={styles.input}
                  value={breakStartTime}
                  onChangeText={setBreakStartTime}
                  placeholder="13:00"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mola Bitiş (Opsiyonel)</Text>
                <TextInput
                  style={styles.input}
                  value={breakEndTime}
                  onChangeText={setBreakEndTime}
                  placeholder="14:00"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Müsait</Text>
                <TouchableOpacity
                  style={[styles.switch, isAvailable && styles.switchActive]}
                  onPress={() => setIsAvailable(!isAvailable)}>
                  <View style={[styles.switchThumb, isAvailable && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShiftModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveShift}>
                <Text style={styles.saveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
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
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  staffSelector: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  staffChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  staffChipActive: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  staffChipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  staffChipTextActive: { color: '#000' },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  dateLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: 10 },
  dateInput: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  listContent: { padding: 15, paddingBottom: 100 },
  shiftCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  shiftInfo: { flex: 1 },
  shiftTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  shiftTime: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  breakTime: { color: '#FFC107', fontSize: 14 },
  unavailableBadge: {
    backgroundColor: '#F4433620',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  unavailableText: { color: '#F44336', fontSize: 11 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 16 },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0095F6',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
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
  modalBody: { maxHeight: 400 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: { backgroundColor: '#0095F6' },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  switchThumbActive: { alignSelf: 'flex-end' },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveButton: {
    flex: 1,
    backgroundColor: '#0095F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#000', fontWeight: 'bold' },
});

