import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

type Service = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  price: string | null;
  duration: number | null;
  padding_time: number | null;
  is_active: boolean;
  display_order: number | null;
  variable_pricing?: VariablePricing[];
  portfolio?: PortfolioItem[];
  assigned_staff?: string[]; // Staff IDs
};

type VariablePricing = {
  id?: string;
  variable_name: string;
  option_name: string;
  price_modifier: number;
};

type PortfolioItem = {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  display_order: number | null;
};

export default function ServiceManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const businessId = params.business_id as string | undefined;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [portfolioModal, setPortfolioModal] = useState(false);
  const [variableModal, setVariableModal] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBasePrice, setEditBasePrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editPaddingTime, setEditPaddingTime] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Variable pricing states
  const [newVariableName, setNewVariableName] = useState('');
  const [newOptionName, setNewOptionName] = useState('');
  const [newPriceModifier, setNewPriceModifier] = useState('');

  // Portfolio states
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchServices();
    } else {
      fetchCurrentBusiness();
    }
  }, [businessId]);

  const fetchCurrentBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // profiles.id genellikle auth.users.id ile aynı
        // Önce direkt user.id ile dene
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .eq('role', 'business')
          .single();
        
        if (profile) {
          fetchServices(profile.id);
        } else {
          // Eğer bulunamazsa user_id ile dene
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'business')
            .single();
          if (data) {
            fetchServices(data.id);
          } else {
            // Son çare: direkt user.id kullan
            fetchServices(user.id);
          }
        }
      }
    } catch (error) {
      console.error('İşletme bulunamadı:', error);
      // Hata durumunda direkt user.id ile dene
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          fetchServices(user.id);
        }
      } catch (e) {
        console.error('Son çare de başarısız:', e);
      }
    }
  };

  const fetchServices = useCallback(async (bid?: string) => {
    const id = bid || businessId;
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('business_services')
        .select('*')
        .eq('business_id', id)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      // Her hizmet için variable pricing ve portfolio çek
      const enriched = await Promise.all((data || []).map(async (service) => {
        const [pricingRes, portfolioRes, staffRes] = await Promise.all([
          supabase.from('service_variable_pricing').select('*').eq('service_id', service.id),
          supabase.from('service_portfolio').select('*').eq('service_id', service.id).order('display_order', { ascending: true }),
          supabase.from('staff_services').select('staff_id').eq('service_id', service.id),
        ]);

        return {
          ...service,
          variable_pricing: pricingRes.data || [],
          portfolio: portfolioRes.data || [],
          assigned_staff: staffRes.data?.map((s: any) => s.staff_id) || [],
        };
      }));

      setServices(enriched);
    } catch (error) {
      console.error('Hizmet yükleme hatası:', error);
      Alert.alert('Hata', 'Hizmetler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setEditName(service.name);
    setEditDescription(service.description || '');
    setEditBasePrice(service.base_price?.toString() || service.price?.replace(/[₺,\s]/g, '') || '');
    setEditDuration(service.duration?.toString() || '');
    setEditPaddingTime(service.padding_time?.toString() || '0');
    setEditIsActive(service.is_active ?? true);
    setEditModal(true);
  };

  const saveService = async () => {
    if (!selectedService || !editName.trim()) {
      Alert.alert('Hata', 'Lütfen hizmet adını girin.');
      return;
    }

    try {
      const id = businessId || (await supabase.auth.getUser()).data.user?.id;
      if (!id) throw new Error('İşletme bulunamadı');

      const { error } = await supabase
        .from('business_services')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          base_price: parseFloat(editBasePrice) || null,
          price: `${parseFloat(editBasePrice) || 0}₺`,
          duration: parseInt(editDuration) || null,
          padding_time: parseInt(editPaddingTime) || 0,
          is_active: editIsActive,
        })
        .eq('id', selectedService.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Hizmet güncellendi.');
      setEditModal(false);
      fetchServices();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Hizmet güncellenemedi.');
    }
  };

  const addVariablePricing = async () => {
    if (!selectedService || !newVariableName.trim() || !newOptionName.trim() || !newPriceModifier.trim()) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      const { error } = await supabase.from('service_variable_pricing').insert({
        service_id: selectedService.id,
        variable_name: newVariableName.trim(),
        option_name: newOptionName.trim(),
        price_modifier: parseFloat(newPriceModifier),
      });

      if (error) throw error;

      setNewVariableName('');
      setNewOptionName('');
      setNewPriceModifier('');
      Alert.alert('Başarılı', 'Değişken fiyat eklendi.');
      fetchServices();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Değişken fiyat eklenemedi.');
    }
  };

  const deleteVariablePricing = async (id: string) => {
    try {
      const { error } = await supabase.from('service_variable_pricing').delete().eq('id', id);
      if (error) throw error;
      Alert.alert('Başarılı', 'Değişken fiyat silindi.');
      fetchServices();
    } catch (error: any) {
      Alert.alert('Hata', 'Silinemedi.');
    }
  };

  const uploadPortfolioImage = async () => {
    if (!selectedService) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeri erişimi için izin gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      setUploading(true);
      const image = result.assets[0];
      const fileExt = image.uri.split('.').pop();
      const fileName = `${selectedService.id}_${Date.now()}.${fileExt}`;
      const filePath = `service-portfolio/${selectedService.id}/${fileName}`;

      // Base64'ü arraybuffer'a çevir
      const response = await fetch(image.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Supabase'e yükle
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, arrayBuffer, { contentType: image.mimeType || 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Public URL al
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      // Portfolio kaydı oluştur
      const id = businessId || (await supabase.auth.getUser()).data.user?.id;
      if (!id) throw new Error('İşletme bulunamadı');

      const { error: insertError } = await supabase.from('service_portfolio').insert({
        service_id: selectedService.id,
        business_id: id,
        media_url: publicUrl,
        media_type: 'image',
      });

      if (insertError) throw insertError;

      Alert.alert('Başarılı', 'Portföy görseli eklendi.');
      fetchServices();
    } catch (error: any) {
      console.error('Yükleme hatası:', error);
      Alert.alert('Hata', error.message || 'Görsel yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const deletePortfolioItem = async (id: string) => {
    try {
      const { error } = await supabase.from('service_portfolio').delete().eq('id', id);
      if (error) throw error;
      Alert.alert('Başarılı', 'Portföy görseli silindi.');
      fetchServices();
    } catch (error: any) {
      Alert.alert('Hata', 'Silinemedi.');
    }
  };

  const renderService = ({ item }: { item: Service }) => (
    <TouchableOpacity style={styles.serviceCard} onPress={() => openEditModal(item)}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          {item.description && <Text style={styles.serviceDescription} numberOfLines={2}>{item.description}</Text>}
          <View style={styles.serviceMeta}>
            <Text style={styles.servicePrice}>{item.base_price ? `${item.base_price}₺` : item.price || 'Fiyat belirtilmemiş'}</Text>
            <Text style={styles.serviceDuration}>⏱ {item.duration || 0} dk</Text>
            {item.padding_time && item.padding_time > 0 && (
              <Text style={styles.servicePadding}>+{item.padding_time} dk temizlik</Text>
            )}
          </View>
        </View>
        <View style={styles.serviceBadges}>
          {!item.is_active && <View style={styles.inactiveBadge}><Text style={styles.inactiveText}>Pasif</Text></View>}
          {item.variable_pricing && item.variable_pricing.length > 0 && (
            <View style={styles.variableBadge}>
              <Ionicons name="options-outline" size={12} color="#0095F6" />
              <Text style={styles.variableText}>{item.variable_pricing.length} değişken</Text>
            </View>
          )}
          {item.portfolio && item.portfolio.length > 0 && (
            <View style={styles.portfolioBadge}>
              <Ionicons name="images-outline" size={12} color="#4CAF50" />
              <Text style={styles.portfolioText}>{item.portfolio.length} görsel</Text>
            </View>
          )}
        </View>
      </View>
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
        <Text style={styles.headerTitle}>Hizmet Yönetimi</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={services}
        renderItem={renderService}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Henüz hizmet eklenmemiş</Text>
          </View>
        }
      />

      {/* HİZMET DÜZENLEME MODALI */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hizmet Düzenle</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Hizmet Adı *</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Örn: Saç Kesimi"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Hizmet hakkında detaylı bilgi..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Temel Fiyat (₺) *</Text>
                  <TextInput
                    style={styles.input}
                    value={editBasePrice}
                    onChangeText={setEditBasePrice}
                    placeholder="300"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Süre (dk) *</Text>
                  <TextInput
                    style={styles.input}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    placeholder="30"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Temizlik Süresi (Padding Time - dk)</Text>
                <TextInput
                  style={styles.input}
                  value={editPaddingTime}
                  onChangeText={setEditPaddingTime}
                  placeholder="5"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>Randevu sonrası temizlik için ayrılan süre</Text>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Aktif</Text>
                <TouchableOpacity
                  style={[styles.switch, editIsActive && styles.switchActive]}
                  onPress={() => setEditIsActive(!editIsActive)}>
                  <View style={[styles.switchThumb, editIsActive && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>

              {/* Değişken Fiyatlandırma Bölümü */}
              {selectedService && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Değişken Fiyatlandırma</Text>
                    <TouchableOpacity onPress={() => setVariableModal(true)}>
                      <Ionicons name="add-circle" size={24} color="#0095F6" />
                    </TouchableOpacity>
                  </View>

                  {selectedService.variable_pricing && selectedService.variable_pricing.length > 0 ? (
                    selectedService.variable_pricing.map((vp) => (
                      <View key={vp.id} style={styles.variableItem}>
                        <View style={styles.variableInfo}>
                          <Text style={styles.variableName}>{vp.variable_name}</Text>
                          <Text style={styles.variableOption}>{vp.option_name}</Text>
                          <Text style={styles.variablePrice}>
                            {vp.price_modifier >= 0 ? '+' : ''}{vp.price_modifier}₺
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => vp.id && deleteVariablePricing(vp.id)}>
                          <Ionicons name="trash-outline" size={20} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyHint}>Değişken fiyat eklenmemiş</Text>
                  )}
                </View>
              )}

              {/* Portföy Bölümü */}
              {selectedService && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Portföy Galerisi</Text>
                    <TouchableOpacity onPress={uploadPortfolioImage} disabled={uploading}>
                      {uploading ? (
                        <ActivityIndicator size="small" color="#0095F6" />
                      ) : (
                        <Ionicons name="add-circle" size={24} color="#0095F6" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {selectedService.portfolio && selectedService.portfolio.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedService.portfolio.map((item) => (
                        <View key={item.id} style={styles.portfolioItem}>
                          <Image source={{ uri: item.media_url }} style={styles.portfolioImage} />
                          <TouchableOpacity
                            style={styles.portfolioDelete}
                            onPress={() => deletePortfolioItem(item.id)}>
                            <Ionicons name="close-circle" size={20} color="#F44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptyHint}>Portföy görseli eklenmemiş</Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveService}>
                <Text style={styles.saveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DEĞİŞKEN FİYAT EKLEME MODALI */}
      <Modal visible={variableModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Değişken Fiyat Ekle</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Değişken Adı</Text>
              <TextInput
                style={styles.input}
                value={newVariableName}
                onChangeText={setNewVariableName}
                placeholder="Örn: Saç Uzunluğu"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Seçenek Adı</Text>
              <TextInput
                style={styles.input}
                value={newOptionName}
                onChangeText={setNewOptionName}
                placeholder="Örn: Uzun"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fiyat Farkı (₺)</Text>
              <TextInput
                style={styles.input}
                value={newPriceModifier}
                onChangeText={setNewPriceModifier}
                placeholder="+100 veya -50"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setVariableModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addVariablePricing}>
                <Text style={styles.saveText}>Ekle</Text>
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
  listContent: { padding: 15, paddingBottom: 100 },
  serviceCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceInfo: { flex: 1 },
  serviceName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  serviceDescription: { color: '#888', fontSize: 14, marginBottom: 8 },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  servicePrice: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  serviceDuration: { color: '#888', fontSize: 14 },
  servicePadding: { color: '#666', fontSize: 12 },
  serviceBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inactiveBadge: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  inactiveText: { color: '#888', fontSize: 11 },
  variableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0095F620',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  variableText: { color: '#0095F6', fontSize: 11 },
  portfolioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  portfolioText: { color: '#4CAF50', fontSize: 11 },
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
    maxHeight: '90%',
    padding: 20,
  },
  smallModal: {
    backgroundColor: '#1E1E1E',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalBody: { maxHeight: 500 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  hint: { color: '#666', fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row' },
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
  section: { marginTop: 30, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  variableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  variableInfo: { flex: 1 },
  variableName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  variableOption: { color: '#888', fontSize: 12, marginTop: 2 },
  variablePrice: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  emptyHint: { color: '#666', fontSize: 14, fontStyle: 'italic' },
  portfolioItem: { marginRight: 10, position: 'relative' },
  portfolioImage: { width: 100, height: 100, borderRadius: 8 },
  portfolioDelete: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#000',
    borderRadius: 10,
  },
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

