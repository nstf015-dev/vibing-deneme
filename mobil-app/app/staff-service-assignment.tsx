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
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Staff = {
  id: string;
  full_name: string;
  role: string | null;
  avatar_url: string | null;
  assigned_services: string[]; // Service IDs
};

type Service = {
  id: string;
  name: string;
  duration: number | null;
  price: string | null;
};

export default function StaffServiceAssignmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const businessId = params.business_id as string | undefined;
  const serviceId = params.service_id as string | undefined;

  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [serviceAssignmentModal, setServiceAssignmentModal] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchData();
    } else {
      fetchCurrentBusiness();
    }
  }, [businessId]);

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
          fetchData(data.id);
        }
      }
    } catch (error) {
      console.error('İşletme bulunamadı:', error);
    }
  };

  const fetchData = useCallback(async (bid?: string) => {
    const id = bid || businessId;
    if (!id) return;

    try {
      setLoading(true);

      // Personel ve hizmetleri çek
      const [staffRes, servicesRes] = await Promise.all([
        supabase.from('staff').select('*').eq('business_id', id),
        supabase.from('business_services').select('*').eq('business_id', id).order('name'),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;

      // Her personel için atanmış hizmetleri çek
      const enrichedStaff = await Promise.all((staffRes.data || []).map(async (s) => {
        const { data } = await supabase
          .from('staff_services')
          .select('service_id')
          .eq('staff_id', s.id);

        return {
          ...s,
          assigned_services: data?.map((item: any) => item.service_id) || [],
        };
      }));

      setStaff(enrichedStaff);
      setServices(servicesRes.data || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      Alert.alert('Hata', 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const toggleServiceAssignment = async (staffId: string, serviceId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Kaldır
        const { error } = await supabase
          .from('staff_services')
          .delete()
          .eq('staff_id', staffId)
          .eq('service_id', serviceId);

        if (error) throw error;
      } else {
        // Ekle
        const { error } = await supabase
          .from('staff_services')
          .insert({
            staff_id: staffId,
            service_id: serviceId,
          });

        if (error) throw error;
      }

      fetchData();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'İşlem gerçekleştirilemedi.');
    }
  };

  const renderStaff = ({ item }: { item: Staff }) => (
    <TouchableOpacity
      style={styles.staffCard}
      onPress={() => {
        setSelectedStaff(item);
        setServiceAssignmentModal(true);
      }}>
      <View style={styles.staffInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.full_name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.staffDetails}>
          <Text style={styles.staffName}>{item.full_name || 'İsimsiz'}</Text>
          {item.role && <Text style={styles.staffRole}>{item.role}</Text>}
          <Text style={styles.staffServicesCount}>
            {item.assigned_services.length} hizmet atanmış
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#888" />
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Personel-Hizmet Ataması</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={staff}
        renderItem={renderStaff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Henüz personel eklenmemiş</Text>
          </View>
        }
      />

      {/* HİZMET ATAMA MODALI */}
      {selectedStaff && (
        <Modal visible={serviceAssignmentModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedStaff.full_name}</Text>
                  <Text style={styles.modalSubtitle}>Hizmet Ataması</Text>
                </View>
                <TouchableOpacity onPress={() => setServiceAssignmentModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {services.length === 0 ? (
                  <Text style={styles.emptyHint}>Henüz hizmet eklenmemiş</Text>
                ) : (
                  services.map((service) => {
                    const isAssigned = selectedStaff.assigned_services.includes(service.id);
                    return (
                      <View key={service.id} style={styles.serviceAssignmentItem}>
                        <View style={styles.serviceAssignmentInfo}>
                          <Text style={styles.serviceAssignmentName}>{service.name}</Text>
                          <Text style={styles.serviceAssignmentMeta}>
                            {service.duration} dk • {service.price}
                          </Text>
                        </View>
                        <Switch
                          value={isAssigned}
                          onValueChange={() =>
                            toggleServiceAssignment(selectedStaff.id, service.id, isAssigned)
                          }
                          trackColor={{ false: '#333', true: '#0095F6' }}
                          thumbColor="#fff"
                        />
                      </View>
                    );
                  })
                )}
              </ScrollView>
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
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  listContent: { padding: 15, paddingBottom: 100 },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  staffInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  staffDetails: { flex: 1 },
  staffName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  staffRole: { color: '#888', fontSize: 14, marginBottom: 4 },
  staffServicesCount: { color: '#666', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 16 },
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
  modalSubtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  modalBody: { maxHeight: 500 },
  serviceAssignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  serviceAssignmentInfo: { flex: 1 },
  serviceAssignmentName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  serviceAssignmentMeta: { color: '#888', fontSize: 12 },
  emptyHint: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 20 },
});

