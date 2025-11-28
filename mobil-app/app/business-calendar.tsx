import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const HOUR_HEIGHT = 80;
const START_HOUR = 8;
const END_HOUR = 22;

export default function BusinessCalendarScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch appointments for the week
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: apps } = await supabase
        .from('appointments')
        .select(`
          *,
          client:profiles!client_id(full_name, avatar_url, phone),
          staff:staff(full_name, avatar_url)
        `)
        .eq('business_id', user.id)
        .gte('date', weekStart.toISOString())
        .lte('date', weekEnd.toISOString())
        .order('date');

      setAppointments(apps || []);

      // Fetch staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', user.id)
        .eq('is_active', true)
        .order('full_name');

      setStaff(staffData || []);
    } catch (error) {
      console.error('Calendar data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseAppointmentTime = (dateString: string): { hour: number; minute: number } | null => {
    const timeMatch = dateString.match(/(\d{2}):(\d{2})/);
    if (!timeMatch) return null;
    return {
      hour: parseInt(timeMatch[1]),
      minute: parseInt(timeMatch[2]),
    };
  };

  const getAppointmentPosition = (appointment: any) => {
    const time = parseAppointmentTime(appointment.date);
    if (!time) return { top: 0, height: HOUR_HEIGHT };

    const top = (time.hour - START_HOUR) * HOUR_HEIGHT + (time.minute / 60) * HOUR_HEIGHT;
    const duration = 60; // Default 1 hour, can be calculated from service
    const height = (duration / 60) * HOUR_HEIGHT;

    return { top, height };
  };

  const handleAppointmentPress = (appointment: any) => {
    setSelectedAppointment(appointment);
  };

  const handleDragStart = (appointment: any) => {
    setDraggedAppointment(appointment);
  };

  const handleDragEnd = async (newTime: string, newStaffId?: string) => {
    if (!draggedAppointment) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          date: newTime,
          staff_id: newStaffId || draggedAppointment.staff_id,
        })
        .eq('id', draggedAppointment.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Randevu taşındı.');
      fetchData();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Randevu taşınamadı.');
    } finally {
      setDraggedAppointment(null);
    }
  };

  const renderDayView = () => {
    const day = currentDate;
    const dayApps = appointments.filter((app) => {
      const appDate = new Date(app.date);
      return (
        appDate.getDate() === day.getDate() &&
        appDate.getMonth() === day.getMonth() &&
        appDate.getFullYear() === day.getFullYear()
      );
    });

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.timeColumn}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
            const hour = START_HOUR + i;
            return (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourLabel}>{hour.toString().padStart(2, '0')}:00</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.appointmentsColumn}>
          {dayApps.map((app) => {
            const { top, height } = getAppointmentPosition(app);
            return (
              <TouchableOpacity
                key={app.id}
                style={[
                  styles.appointmentBlock,
                  {
                    top,
                    height: Math.max(height, 60),
                  },
                ]}
                onPress={() => handleAppointmentPress(app)}>
                <Text style={styles.appointmentTitle} numberOfLines={1}>
                  {app.client?.full_name || 'Müşteri'}
                </Text>
                <Text style={styles.appointmentService} numberOfLines={1}>
                  {app.service_name}
                </Text>
                <Text style={styles.appointmentTime}>
                  {parseAppointmentTime(app.date)?.hour}:{parseAppointmentTime(app.date)?.minute.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      return day;
    });

    const columnWidth = (width - 60) / 7;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekContainer}>
          <View style={styles.timeColumn}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
              const hour = START_HOUR + i;
              return (
                <View key={hour} style={styles.hourRow}>
                  <Text style={styles.hourLabel}>{hour.toString().padStart(2, '0')}:00</Text>
                </View>
              );
            })}
          </View>
          {days.map((day, dayIndex) => {
            const dayApps = appointments.filter((app) => {
              const appDate = new Date(app.date);
              return (
                appDate.getDate() === day.getDate() &&
                appDate.getMonth() === day.getMonth() &&
                appDate.getFullYear() === day.getFullYear()
              );
            });

            return (
              <View key={dayIndex} style={[styles.dayColumn, { width: columnWidth }]}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>
                    {day.toLocaleDateString('tr-TR', { weekday: 'short' })}
                  </Text>
                  <Text style={styles.dayNumber}>{day.getDate()}</Text>
                </View>
                <View style={styles.dayAppointments}>
                  {dayApps.map((app) => {
                    const { top, height } = getAppointmentPosition(app);
                    return (
                      <TouchableOpacity
                        key={app.id}
                        style={[
                          styles.appointmentBlock,
                          {
                            top,
                            height: Math.max(height, 60),
                            width: columnWidth - 8,
                          },
                        ]}
                        onPress={() => handleAppointmentPress(app)}>
                        <Text style={styles.appointmentTitle} numberOfLines={1}>
                          {app.client?.full_name || 'Müşteri'}
                        </Text>
                        <Text style={styles.appointmentService} numberOfLines={1}>
                          {app.service_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TouchableOpacity
            onPress={() => {
              const prev = new Date(currentDate);
              prev.setDate(prev.getDate() - (viewMode === 'week' ? 7 : 1));
              setCurrentDate(prev);
            }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentDate.toLocaleDateString('tr-TR', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const next = new Date(currentDate);
              next.setDate(next.getDate() + (viewMode === 'week' ? 7 : 1));
              setCurrentDate(next);
            }}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.viewModeButtons}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('day')}>
            <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>
              Gün
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('week')}>
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>
              Hafta
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.calendarScroll}>
        {viewMode === 'day' ? renderDayView() : renderWeekView()}
      </ScrollView>

      {/* APPOINTMENT DETAIL MODAL */}
      {selectedAppointment && (
        <Modal visible={!!selectedAppointment} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Randevu Detayı</Text>
                <TouchableOpacity onPress={() => setSelectedAppointment(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Müşteri</Text>
                <Text style={styles.modalValue}>
                  {selectedAppointment.client?.full_name || 'Bilinmiyor'}
                </Text>

                <Text style={styles.modalLabel}>Hizmet</Text>
                <Text style={styles.modalValue}>{selectedAppointment.service_name}</Text>

                <Text style={styles.modalLabel}>Tarih & Saat</Text>
                <Text style={styles.modalValue}>{selectedAppointment.date}</Text>

                <Text style={styles.modalLabel}>Personel</Text>
                <Text style={styles.modalValue}>
                  {selectedAppointment.staff?.full_name || 'Atanmamış'}
                </Text>

                <Text style={styles.modalLabel}>Durum</Text>
                <Text style={styles.modalValue}>{selectedAppointment.status}</Text>

                <Text style={styles.modalLabel}>Fiyat</Text>
                <Text style={styles.modalValue}>{selectedAppointment.price}</Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setSelectedAppointment(null)}>
                  <Text style={styles.modalButtonText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  viewModeButtons: { flexDirection: 'row', gap: 8 },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
  },
  viewModeButtonActive: { backgroundColor: '#0095F6' },
  viewModeText: { color: '#888', fontSize: 12 },
  viewModeTextActive: { color: '#000', fontWeight: 'bold' },
  calendarScroll: { flex: 1 },
  calendarContainer: {
    flexDirection: 'row',
    minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
  },
  weekContainer: {
    flexDirection: 'row',
    minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  hourRow: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingLeft: 8,
  },
  hourLabel: { color: '#666', fontSize: 12 },
  appointmentsColumn: {
    flex: 1,
    position: 'relative',
  },
  dayColumn: {
    borderRightWidth: 1,
    borderRightColor: '#333',
    position: 'relative',
  },
  dayHeader: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  dayName: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  dayNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  dayAppointments: {
    flex: 1,
    position: 'relative',
  },
  appointmentBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#0095F6',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  appointmentTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  appointmentService: { color: '#fff', fontSize: 10, marginTop: 2, opacity: 0.9 },
  appointmentTime: { color: '#fff', fontSize: 10, marginTop: 4, opacity: 0.8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalBody: { marginBottom: 20 },
  modalLabel: { color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 },
  modalValue: { color: '#fff', fontSize: 16 },
  modalFooter: { marginTop: 20 },
  modalButton: {
    backgroundColor: '#0095F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: { color: '#000', fontWeight: 'bold' },
});

