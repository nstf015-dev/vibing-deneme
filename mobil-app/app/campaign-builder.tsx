import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function CampaignBuilderScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState<'discount' | 'boost'>('discount');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Campaigns fetch error:', error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !startDate || !endDate) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('campaigns').insert({
        business_id: user.id,
        name: campaignName.trim(),
        description: description.trim() || null,
        campaign_type: campaignType,
        discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
        discount_amount: discountAmount ? parseFloat(discountAmount) : null,
        start_date: startDate,
        end_date: endDate,
        status: 'draft',
      });

      if (error) throw error;

      Alert.alert('Başarılı', 'Kampanya oluşturuldu.');
      setShowCreateModal(false);
      resetForm();
      fetchCampaigns();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Kampanya oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCampaignName('');
    setDescription('');
    setCampaignType('discount');
    setDiscountPercentage('');
    setDiscountAmount('');
    setStartDate('');
    setEndDate('');
  };

  const renderCampaign = ({ item }: { item: any }) => {
    const isActive = item.status === 'active';
    const today = new Date();
    const start = new Date(item.start_date);
    const end = new Date(item.end_date);
    const isRunning = today >= start && today <= end && isActive;

    return (
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeader}>
          <View style={styles.campaignInfo}>
            <Text style={styles.campaignName}>{item.name}</Text>
            <Text style={styles.campaignType}>{item.campaign_type}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isRunning ? styles.statusBadgeActive : styles.statusBadgeInactive,
            ]}>
            <Text style={styles.statusText}>{isRunning ? 'Aktif' : item.status}</Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.campaignDescription}>{item.description}</Text>
        )}

        <View style={styles.campaignDetails}>
          {item.discount_percentage && (
            <View style={styles.discountBadge}>
              <Ionicons name="pricetag" size={16} color="#4CAF50" />
              <Text style={styles.discountText}>
                %{item.discount_percentage} İndirim
              </Text>
            </View>
          )}
          {item.discount_amount && (
            <View style={styles.discountBadge}>
              <Ionicons name="cash" size={16} color="#4CAF50" />
              <Text style={styles.discountText}>
                {item.discount_amount}₺ İndirim
              </Text>
            </View>
          )}
        </View>

        <View style={styles.campaignDates}>
          <Text style={styles.dateLabel}>
            {new Date(item.start_date).toLocaleDateString('tr-TR')} -{' '}
            {new Date(item.end_date).toLocaleDateString('tr-TR')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kampanya Yönetimi</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={28} color="#0095F6" />
        </TouchableOpacity>
      </View>

      {campaigns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="megaphone-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>Henüz kampanya oluşturulmamış</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createButtonText}>İlk Kampanyayı Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          renderItem={renderCampaign}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Kampanya</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kampanya Adı *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Yaz İndirimi"
                  placeholderTextColor="#666"
                  value={campaignName}
                  onChangeText={setCampaignName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Kampanya detayları..."
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kampanya Türü</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      campaignType === 'discount' && styles.typeButtonActive,
                    ]}
                    onPress={() => setCampaignType('discount')}>
                    <Text
                      style={[
                        styles.typeButtonText,
                        campaignType === 'discount' && styles.typeButtonTextActive,
                      ]}>
                      İndirim
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      campaignType === 'boost' && styles.typeButtonActive,
                    ]}
                    onPress={() => setCampaignType('boost')}>
                    <Text
                      style={[
                        styles.typeButtonText,
                        campaignType === 'boost' && styles.typeButtonTextActive,
                      ]}>
                      Boost
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {campaignType === 'discount' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>İndirim Yüzdesi (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="20"
                      placeholderTextColor="#666"
                      value={discountPercentage}
                      onChangeText={setDiscountPercentage}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>veya İndirim Tutarı (₺)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="100"
                      placeholderTextColor="#666"
                      value={discountAmount}
                      onChangeText={setDiscountAmount}
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Başlangıç Tarihi *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#666"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bitiş Tarihi *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#666"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleCreateCampaign}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveText}>Oluştur</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  listContent: { padding: 15 },
  campaignCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  campaignInfo: { flex: 1 },
  campaignName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  campaignType: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeActive: { backgroundColor: '#4CAF5020' },
  statusBadgeInactive: { backgroundColor: '#333' },
  statusText: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  campaignDescription: { color: '#ccc', fontSize: 14, marginBottom: 12, lineHeight: 20 },
  campaignDetails: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  discountText: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  campaignDates: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
  dateLabel: { color: '#888', fontSize: 12 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16, marginBottom: 24 },
  createButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeButtons: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1,
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  typeButtonActive: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  typeButtonText: { color: '#fff', fontSize: 14 },
  typeButtonTextActive: { color: '#000', fontWeight: 'bold' },
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
  saveButtonDisabled: { opacity: 0.5 },
  saveText: { color: '#000', fontWeight: 'bold' },
});

