import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// Web için DateTimePicker conditional import
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('DateTimePicker yüklenemedi:', e);
  }
}

export default function WaitlistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const businessId = params.business_id as string;
  const serviceName = params.service_name as string;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<{ business_name: string | null } | null>(null);

  useEffect(() => {
    if (businessId) {
      fetchBusinessInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const fetchBusinessInfo = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', businessId)
        .single();
      setBusinessInfo(data);
    } catch (error) {
      console.error('İşletme bilgisi hatası:', error);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!businessId) {
      Alert.alert('Hata', 'İşletme bilgisi bulunamadı.');
      return;
    }

    if (!serviceName) {
      Alert.alert('Hata', 'Hizmet bilgisi bulunamadı.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Bekleme listesine eklenmek için lütfen giriş yapın.');
        router.push('/login');
        return;
      }

      setLoading(true);

      const { error } = await supabase.from('waitlist_entries').insert({
        user_id: user.id,
        business_id: businessId,
        service_name: serviceName || 'Genel Hizmet',
        desired_date: selectedDate.toISOString().split('T')[0],
        notes: notes.trim() || null,
      });

      if (error) throw error;

      Alert.alert(
        'Başarılı',
        'Bekleme listesine eklendiniz! Uygun bir zaman açıldığında size bildirim göndereceğiz.',
        [
          {
            text: 'Tamam',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Bekleme listesi hatası:', error);
      Alert.alert('Hata', error.message || 'Bekleme listesine eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bekleme Listesi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#0095F6" />
          <Text style={styles.infoText}>
            İstediğiniz tarihte müsaitlik olmadığında, bekleme listesine eklenebilirsiniz. Uygun bir zaman açıldığında size bildirim göndereceğiz.
          </Text>
        </View>

        {businessInfo && (
          <View style={styles.businessCard}>
            <Text style={styles.label}>İşletme</Text>
            <Text style={styles.businessName}>{businessInfo.business_name}</Text>
          </View>
        )}

        {serviceName && (
          <View style={styles.serviceCard}>
            <Text style={styles.label}>Hizmet</Text>
            <Text style={styles.serviceName}>{serviceName}</Text>
          </View>
        )}

        <View style={styles.dateCard}>
          <Text style={styles.label}>İstediğiniz Tarih</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.dateText}>
              {selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.label}>Notlar (Opsiyonel)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Özel istekleriniz veya notlarınız..."
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleJoinWaitlist}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Bekleme Listesine Ekle</Text>
              <Ionicons name="checkmark-circle" size={20} color="#000" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showDatePicker && DateTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event: any, date?: Date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}
      
      {showDatePicker && Platform.OS === 'web' && (
        <View style={styles.webDatePicker}>
          <Text style={styles.webDatePickerTitle}>Tarih Seçin</Text>
          <TextInput
            style={styles.webDateInput}
            value={selectedDate.toISOString().split('T')[0]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#666"
            onChangeText={(text) => {
              const date = new Date(text);
              if (!isNaN(date.getTime()) && date >= new Date()) {
                setSelectedDate(date);
                setShowDatePicker(false);
              }
            }}
          />
          <Text style={styles.webDateHint}>Format: YYYY-MM-DD (örn: 2024-12-25)</Text>
          <TouchableOpacity
            style={styles.webDatePickerClose}
            onPress={() => setShowDatePicker(false)}>
            <Text style={styles.webDatePickerCloseText}>Kapat</Text>
          </TouchableOpacity>
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
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  infoText: { flex: 1, color: '#ccc', fontSize: 14, lineHeight: 20 },
  businessCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  label: { color: '#888', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  businessName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  serviceName: { color: '#fff', fontSize: 16 },
  dateCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  dateText: { flex: 1, color: '#fff', fontSize: 16 },
  notesCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  notesInput: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0095F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  webDatePicker: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  webDatePickerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  webDateInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  webDateHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 15,
  },
  webDatePickerClose: {
    backgroundColor: '#0095F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  webDatePickerCloseText: { color: '#000', fontWeight: 'bold' },
});

