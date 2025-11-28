import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  total_appointments: number;
  total_spent: number;
  last_visit: string | null;
  tags: string[];
  notes: any[];
};

export default function BusinessCRMScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [noteModal, setNoteModal] = useState({ visible: false, customerId: '' });
  const [newNote, setNewNote] = useState('');
  const [tagModal, setTagModal] = useState({ visible: false, customerId: '' });
  const [newTag, setNewTag] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const fetchBusinessId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'business')
          .single();
        if (data) setBusinessId(data.id);
      }
    } catch (error) {
      console.error('İşletme ID hatası:', error);
    }
  };

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return;

    try {
      setLoading(true);

      // Randevuları çek
      const { data: appointments } = await supabase
        .from('appointments')
        .select('customer_id, price, date')
        .eq('business_id', businessId);

      // Müşteri istatistiklerini hesapla
      const customerMap: Record<string, any> = {};

      appointments?.forEach((apt) => {
        if (!apt.customer_id) return;
        if (!customerMap[apt.customer_id]) {
          customerMap[apt.customer_id] = {
            total_appointments: 0,
            total_spent: 0,
            last_visit: null,
          };
        }
        customerMap[apt.customer_id].total_appointments++;
        const priceValue = typeof apt.price === 'string' 
          ? parseFloat(apt.price.replace(/[₺,\s]/g, '').replace(',', '.') || '0') || 0
          : (typeof apt.price === 'number' ? apt.price : 0);
        customerMap[apt.customer_id].total_spent += priceValue;
        if (!customerMap[apt.customer_id].last_visit || apt.date > customerMap[apt.customer_id].last_visit) {
          customerMap[apt.customer_id].last_visit = apt.date;
        }
      });

      // Müşteri profillerini çek
      const customerIds = Object.keys(customerMap);
      if (customerIds.length === 0) {
        setCustomers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', customerIds)
        .eq('role', 'client');

      // Notları ve etiketleri çek
      const { data: notes } = await supabase
        .from('customer_notes')
        .select('customer_id, note, tags')
        .eq('business_id', businessId)
        .in('customer_id', customerIds);

      const { data: tags } = await supabase
        .from('customer_tags')
        .select('customer_id, tag_name')
        .eq('business_id', businessId)
        .in('customer_id', customerIds);

      const enriched: Customer[] = (profiles || []).map((profile) => {
        const stats = customerMap[profile.id] || { total_appointments: 0, total_spent: 0, last_visit: null };
        const customerNotes = notes?.filter((n) => n.customer_id === profile.id) || [];
        const customerTags = tags?.filter((t) => t.customer_id === profile.id).map((t) => t.tag_name) || [];

        return {
          ...profile,
          total_appointments: stats.total_appointments,
          total_spent: stats.total_spent,
          last_visit: stats.last_visit,
          tags: customerTags,
          notes: customerNotes,
        };
      });

      setCustomers(enriched.sort((a, b) => b.total_spent - a.total_spent));
    } catch (error) {
      console.error('Müşteri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !noteModal.customerId || !businessId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('customer_notes').insert({
        business_id: businessId,
        customer_id: noteModal.customerId,
        note: newNote.trim(),
        created_by: user.id,
      });

      if (error) throw error;

      setNewNote('');
      setNoteModal({ visible: false, customerId: '' });
      fetchCustomers();
      Alert.alert('Başarılı', 'Not eklendi.');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Not eklenemedi.');
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !tagModal.customerId || !businessId) return;

    try {
      const { error } = await supabase.from('customer_tags').insert({
        business_id: businessId,
        customer_id: tagModal.customerId,
        tag_name: newTag.trim(),
      });

      if (error) throw error;

      setNewTag('');
      setTagModal({ visible: false, customerId: '' });
      fetchCustomers();
      Alert.alert('Başarılı', 'Etiket eklendi.');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Etiket eklenemedi.');
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => setSelectedCustomer(item)}>
      <View style={styles.customerHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.full_name || 'İsimsiz'}</Text>
          {item.email && <Text style={styles.customerEmail}>{item.email}</Text>}
        </View>
        {item.avatar_url && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.full_name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.total_appointments}</Text>
          <Text style={styles.statLabel}>Randevu</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.total_spent.toFixed(0)}₺</Text>
          <Text style={styles.statLabel}>Toplam</Text>
        </View>
        {item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map((tag, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRM - Müşteriler</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Müşteri ara..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Henüz müşteri yok</Text>
            </View>
          }
        />
      )}

      {/* Müşteri Detay Modal */}
      {selectedCustomer && (
        <Modal visible={Boolean(selectedCustomer)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedCustomer.full_name || 'Müşteri'}</Text>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Toplam Randevu</Text>
                  <Text style={styles.detailValue}>{selectedCustomer.total_appointments}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Toplam Harcama</Text>
                  <Text style={styles.detailValue}>{selectedCustomer.total_spent.toFixed(2)}₺</Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setNoteModal({ visible: true, customerId: selectedCustomer.id })}>
                    <Ionicons name="document-text-outline" size={20} color="#0095F6" />
                    <Text style={styles.actionText}>Not Ekle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setTagModal({ visible: true, customerId: selectedCustomer.id })}>
                    <Ionicons name="pricetag-outline" size={20} color="#4CAF50" />
                    <Text style={styles.actionText}>Etiket Ekle</Text>
                  </TouchableOpacity>
                </View>

                {selectedCustomer.notes.length > 0 && (
                  <View style={styles.notesSection}>
                    <Text style={styles.sectionTitle}>Notlar</Text>
                    {selectedCustomer.notes.map((note: any, idx: number) => (
                      <View key={idx} style={styles.noteItem}>
                        <Text style={styles.noteText}>{note.note}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedCustomer.tags.length > 0 && (
                  <View style={styles.tagsSection}>
                    <Text style={styles.sectionTitle}>Etiketler</Text>
                    <View style={styles.tagsRow}>
                      {selectedCustomer.tags.map((tag, idx) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Not Ekleme Modal */}
      <Modal visible={noteModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Not Ekle</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Notunuzu yazın..."
              placeholderTextColor="#666"
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setNoteModal({ visible: false, customerId: '' })}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddNote}>
                <Text style={styles.saveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Etiket Ekleme Modal */}
      <Modal visible={tagModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Etiket Ekle</Text>
            <TextInput
              style={styles.tagInput}
              placeholder="Etiket adı..."
              placeholderTextColor="#666"
              value={newTag}
              onChangeText={setNewTag}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setTagModal({ visible: false, customerId: '' })}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddTag}>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    margin: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15, paddingBottom: 100 },
  customerCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  customerInfo: { flex: 1 },
  customerName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  customerEmail: { color: '#888', fontSize: 14 },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stat: { alignItems: 'flex-start' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12 },
  tagsContainer: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  tag: { backgroundColor: '#0095F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#888', fontSize: 16 },
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
  modalBody: { maxHeight: 500 },
  detailSection: { marginBottom: 20 },
  detailLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  notesSection: { marginTop: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  noteItem: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  noteText: { color: '#ccc', fontSize: 14 },
  tagsSection: { marginTop: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallModal: {
    backgroundColor: '#1E1E1E',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  noteInput: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 15,
    marginBottom: 20,
  },
  tagInput: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveButton: {
    flex: 1,
    backgroundColor: '#0095F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#000', fontWeight: 'bold' },
});

