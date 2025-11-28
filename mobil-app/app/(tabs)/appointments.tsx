import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AppointmentsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]); // Arama Sonuçları
  const [searchQuery, setSearchQuery] = useState(''); // Arama Metni
  
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewsByAppointment, setReviewsByAppointment] = useState<Record<string, { rating: number; comment: string }>>({});
  const [reviewModalState, setReviewModalState] = useState<{ visible: boolean; appointmentId: string | null; rating: number; comment: string }>({
    visible: false,
    appointmentId: null,
    rating: 5,
    comment: '',
  });
  const [savingReview, setSavingReview] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          business:profiles!business_id(full_name, business_name, avatar_url),
          client:profiles!client_id(full_name, avatar_url)
        `)
        .or(`client_id.eq.${user.id},business_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let enriched = data || [];
      const staffIds = Array.from(
        new Set(
          enriched
            .map((item) => item.staff_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (staffIds.length > 0) {
        const { data: staffProfiles } = await supabase
          .from('staff')
          .select('id, full_name, avatar_url, specialty')
          .in('id', staffIds);
        const staffMap = (staffProfiles || []).reduce<Record<string, any>>((acc, staff) => {
          acc[staff.id] = staff;
          return acc;
        }, {});
        enriched = enriched.map((item) => ({
          ...item,
          staff: item.staff_id ? staffMap[item.staff_id] || null : null,
        }));
      }

      setAppointments(enriched);
    } catch (error) {
      console.log(error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const fetchReviews = useCallback(async (appointmentIds: string[]) => {
    if (!appointmentIds.length) {
      setReviewsByAppointment({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointment_reviews')
        .select('appointment_id, rating, comment')
        .in('appointment_id', appointmentIds);

      if (error) {
        console.log('Yorum yükleme hatası:', error);
        return;
      }

      const reviewMap: Record<string, { rating: number; comment: string }> = {};
      data?.forEach((item) => {
        if (item.appointment_id) {
          reviewMap[item.appointment_id] = {
            rating: item.rating,
            comment: item.comment,
          };
        }
      });

      setReviewsByAppointment(reviewMap);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    if (appointments.length === 0) {
      setReviewsByAppointment({});
      return;
    }
    const ids = appointments.map((appt) => appt.id).filter(Boolean);
    fetchReviews(ids);
  }, [appointments, fetchReviews]);

  // Arama Değişince Çalışır
  const searchBusinesses = useCallback(async () => {
    try {
      // İşletme Adına Göre Ara
      const { data: businesses } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'business') // Sadece işletmeleri getir
        .ilike('business_name', `%${searchQuery}%`) // İsim eşleşmesi
        .limit(10);

      setSearchResults(businesses || []);
    } catch (error) {
      console.log('Arama hatası:', error);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchBusinesses();
    } else {
      setSearchResults([]); // 2 harften azsa sonucu temizle
    }
  }, [searchQuery, searchBusinesses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, [fetchAppointments]);

  // --- DURUM GÜNCELLEME ---
  const handleUpdateStatus = async (id: string, newStatus: string, actionName: string) => {
    if (Platform.OS === 'web') { if (!confirm(`Randevuyu ${actionName} istiyor musun?`)) return; }
    
    try {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      Alert.alert('Başarılı', `Randevu ${actionName}.`);
      fetchAppointments();
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    }
  };

  const openReviewModal = (appointmentId: string) => {
    const existing = reviewsByAppointment[appointmentId];
    setReviewModalState({
      visible: true,
      appointmentId,
      rating: existing?.rating ?? 5,
      comment: existing?.comment ?? '',
    });
  };

  const closeReviewModal = () => {
    setReviewModalState((prev) => ({
      ...prev,
      visible: false,
      appointmentId: null,
      comment: '',
    }));
  };

  const handleSaveReview = async () => {
    if (!reviewModalState.appointmentId) return;
    try {
      setSavingReview(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Giriş gerekli', 'Yorum yapabilmek için giriş yapmalısın.');
        return;
      }

      const payload = {
        appointment_id: reviewModalState.appointmentId,
        rating: reviewModalState.rating,
        comment: reviewModalState.comment,
        author_id: user.id,
      };

      const { error } = await supabase.from('appointment_reviews').upsert(payload, { onConflict: 'appointment_id' });
      if (error) throw error;

      setReviewsByAppointment((prev) => ({
        ...prev,
        [reviewModalState.appointmentId as string]: {
          rating: reviewModalState.rating,
          comment: reviewModalState.comment,
        },
      }));
      closeReviewModal();
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Yorum kaydedilemedi.');
    } finally {
      setSavingReview(false);
    }
  };

  // --- RENDER: ARAMA SONUCU KARTI ---
  const renderSearchResult = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.resultCard} 
      onPress={() => router.push(`/business/${item.id}`)} // İşletme profiline git
    >
      <Image source={{ uri: item.avatar_url || 'https://placehold.co/150' }} style={styles.resultAvatar} />
      <View>
        <Text style={styles.resultName}>{item.business_name || item.full_name}</Text>
        <Text style={styles.resultType}>{item.business_type || 'İşletme'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" style={{marginLeft:'auto'}}/>
    </TouchableOpacity>
  );

  // --- RENDER: RANDEVU KARTI ---
  const renderAppointment = ({ item }: { item: any }) => {
    const isPending = item.status === 'pending';
    const isCancelled = item.status === 'cancelled';
    const isConfirmed = item.status === 'confirmed';
    const amIBusiness = currentUserId === item.business_id;
    const otherUser = amIBusiness ? item.client : item.business;
    const displayName = otherUser?.business_name || otherUser?.full_name || 'Bilinmeyen Kullanıcı';
    const displayAvatar = otherUser?.avatar_url || 'https://placehold.co/150';
    const cardStyle = isCancelled ? [styles.card, styles.cancelledCard] : styles.card;

    const review = reviewsByAppointment[item.id];

    return (
      <View style={cardStyle}>
        <View style={styles.cardRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{item.date.split(',')[0] || 'Tarih'}</Text>
            <Text style={styles.timeText}>{item.date.split(',')[1] || ''}</Text>
          </View>
          <View style={styles.details}>
            <Text style={[styles.serviceName, isCancelled && styles.strikeText]}>{item.service_name}</Text>
            <View style={styles.businessRow}>
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              <Text style={styles.businessName}>{displayName}</Text>
            </View>
            {item.staff && (
              <View style={styles.staffInfoRow}>
                <Ionicons name="person-outline" size={14} color="#ccc" />
                <View>
                  <Text style={styles.staffInfoText}>{item.staff.full_name}</Text>
                  {item.staff.specialty && <Text style={styles.staffInfoSub}>{item.staff.specialty}</Text>}
                </View>
              </View>
            )}
            <Text style={styles.price}>{item.price}</Text>
          </View>
          <View style={styles.statusColumn}>
            <View style={styles.statusBox}>
              {isPending && (
                <View style={styles.badgeWarning}>
                  <Ionicons name="time" size={14} color="#FFC107" />
                  <Text style={styles.warnText}>Bekliyor</Text>
                </View>
              )}
              {isConfirmed && (
                <View style={styles.badgeSuccess}>
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                  <Text style={styles.successText}>Onaylı</Text>
                </View>
              )}
              {isCancelled && (
                <View style={styles.badgeError}>
                  <Ionicons name="close-circle" size={14} color="#F44336" />
                  <Text style={styles.errorText}>İptal</Text>
                </View>
              )}
            </View>
            {isPending && (
              <View style={styles.actionContainer}>
                {amIBusiness ? (
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleUpdateStatus(item.id, 'confirmed', 'onaylamak')}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.btnTextWhite}>Onayla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtnSmall}
                      onPress={() => handleUpdateStatus(item.id, 'cancelled', 'reddetmek')}>
                      <Ionicons name="close" size={18} color="#F44336" />
                      <Text style={styles.cancelText}>Reddet</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleUpdateStatus(item.id, 'cancelled', 'iptal etmek')}>
                    <Text style={styles.cancelText}>İptal Et</Text>
                    <Ionicons name="trash-outline" size={16} color="#F44336" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        {(review || isConfirmed) && (
          <View style={styles.cardFooter}>
            {review && (
              <View style={styles.reviewSnippet}>
                <Ionicons name="star" size={14} color="#FFC107" />
                <Text style={styles.reviewSnippetText} numberOfLines={2}>
                  {review.rating}/5 – {review.comment}
                </Text>
              </View>
            )}
            {isConfirmed && (
              <TouchableOpacity style={styles.reviewBtn} onPress={() => openReviewModal(item.id)}>
                <Ionicons name="create-outline" size={16} color="#0095F6" />
                <Text style={styles.reviewBtnText}>
                  {review ? 'Yorumu Güncelle' : 'Yorum Yaz'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.rebookBtn}
              onPress={() =>
                router.push({
                  pathname: '/booking',
                  params: {
                    business_id: item.business_id,
                    business_name: item.business?.business_name || item.business?.full_name || 'isletme',
                    service_name: item.service_name,
                    price: item.price,
                  },
                })
              }>
              <Ionicons name="repeat" size={16} color="#4CAF50" />
              <Text style={styles.rebookText}>Tekrar Randevu Al</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ÜST ARAMA ÇUBUĞU */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={{marginRight:10}} />
        <TextInput 
          style={styles.searchInput}
          placeholder="İşletme veya hizmet ara..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
           <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={20} color="#666" /></TouchableOpacity>
        )}
      </View>

      {/* İÇERİK ALANI */}
      {searchQuery.length > 2 ? (
        // ARAMA SONUÇLARI MODU
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>Sonuç bulunamadı.</Text>}
        />
      ) : (
        // RANDEVULARIM MODU
        <>
          <View style={styles.header}><Text style={styles.title}>Randevularım 📅</Text></View>
          <FlatList
            data={appointments}
            renderItem={renderAppointment}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                 <Text style={styles.emptyText}>Henüz randevun yok.</Text>
                 <Text style={styles.emptySubText}>Yukarıdan arama yaparak randevu alabilirsin.</Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>

      <Modal visible={reviewModalState.visible} transparent animationType="slide" onRequestClose={closeReviewModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.reviewModalContent}>
            <Text style={styles.modalTitle}>Yorum & Değerlendirme</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewModalState((prev) => ({ ...prev, rating: star }))}>
                  <Ionicons
                    name={star <= reviewModalState.rating ? 'star' : 'star-outline'}
                    size={28}
                    color={star <= reviewModalState.rating ? '#FFC107' : '#555'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Deneyimini paylaş..."
              placeholderTextColor="#666"
              multiline
              value={reviewModalState.comment}
              onChangeText={(text) => setReviewModalState((prev) => ({ ...prev, comment: text }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={closeReviewModal}>
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveReview}
                disabled={savingReview}>
                {savingReview ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#000' }]}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  // SEARCH BAR
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', margin: 15, paddingHorizontal: 15, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },

  // SEARCH RESULTS
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  resultAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  resultName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultType: { color: '#888', fontSize: 14 },

  header: { paddingHorizontal: 20, marginBottom: 10 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  listContainer: { paddingHorizontal: 20 },
  
  // CARD STYLES
  card: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardFooter: { marginTop: 12, gap: 10 },
  cancelledCard: { opacity: 0.5 }, 
  dateBox: { backgroundColor: '#2C2C2C', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', marginRight: 15, width: 70 },
  dateText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign:'center' },
  timeText: { color: '#aaa', fontSize: 12, marginTop: 2 },
  details: { flex: 1 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  strikeText: { textDecorationLine: 'line-through', color: '#888' }, 
  businessRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
  businessName: { color: '#aaa', fontSize: 13 },
  staffInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  staffInfoText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  staffInfoSub: { color: '#777', fontSize: 11 },
  price: { color: '#fff', fontWeight: '600' },
  statusColumn: { alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' },
  statusBox: { marginBottom: 10 },
  actionContainer: { alignItems: 'flex-end' },
  badgeWarning: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 193, 7, 0.1)', padding: 6, borderRadius: 8 },
  warnText: { color: '#FFC107', fontSize: 12, fontWeight: 'bold' },
  badgeSuccess: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: 6, borderRadius: 8 },
  successText: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },
  badgeError: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: 6, borderRadius: 8 },
  errorText: { color: '#F44336', fontSize: 12, fontWeight: 'bold' },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  rejectBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5, marginTop: 5 },
  btnTextWhite: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5, marginTop: 5 },
  cancelText: { color: '#F44336', fontSize: 12, fontWeight: 'bold' },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewBtnText: { color: '#0095F6', fontWeight: '600' },
  reviewSnippet: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#181818', padding: 10, borderRadius: 10 },
  reviewSnippetText: { color: '#ddd', flex: 1 },
  rebookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rebookText: { color: '#4CAF50', fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#666', marginTop: 5, textAlign:'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  reviewModalContent: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 15 },
  reviewInput: { backgroundColor: '#111', color: '#fff', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#333' },
  modalButtonPrimary: { backgroundColor: '#fff' },
  modalButtonText: { color: '#fff', fontWeight: '600' },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
});