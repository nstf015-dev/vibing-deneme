import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const appointmentId = params.appointment_id as string | undefined;
  const amount = params.amount as string | undefined;

  const [selectedMethod, setSelectedMethod] = useState<'card' | 'wallet' | 'cash'>('card');
  const [processing, setProcessing] = useState(false);

  const paymentMethods = [
    { id: 'card', name: 'Kredi/Banka Kartı', icon: 'card-outline', color: '#0095F6' },
    { id: 'wallet', name: 'Cüzdan', icon: 'wallet-outline', color: '#4CAF50' },
    { id: 'cash', name: 'Nakit', icon: 'cash-outline', color: '#FFC107' },
  ];

  const handlePayment = async () => {
    if (!appointmentId) {
      Alert.alert('Hata', 'Randevu bilgisi bulunamadı.');
      router.back();
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Ödeme yapmak için lütfen giriş yapın.');
        return;
      }

      setProcessing(true);

      // Payment intent oluştur
      const { data: appointment } = await supabase
        .from('appointments')
        .select('business_id, price')
        .eq('id', appointmentId)
        .single();

      if (!appointment) throw new Error('Randevu bulunamadı');
      if (!appointment.business_id) throw new Error('İşletme bilgisi bulunamadı');

      const amountValue = amount 
        ? parseFloat(amount.replace(/[₺,\s]/g, '').replace(',', '.')) || 0
        : (appointment.price 
            ? (typeof appointment.price === 'string'
                ? parseFloat(appointment.price.replace(/[₺,\s]/g, '').replace(',', '.') || '0') || 0
                : (typeof appointment.price === 'number' ? appointment.price : 0))
            : 0);

      const { error: paymentError } = await supabase.from('payment_intents').insert({
        appointment_id: appointmentId,
        user_id: user.id,
        business_id: appointment.business_id,
        amount: amountValue,
        currency: 'TRY',
        status: selectedMethod === 'cash' ? 'pending' : 'completed',
        payment_method: selectedMethod,
      });

      if (paymentError) throw paymentError;

      // Stripe entegrasyonu burada yapılabilir (selectedMethod === 'card' için)
      if (selectedMethod === 'card') {
        // TODO: Stripe Payment Intent API çağrısı
        Alert.alert('Ödeme Başlatıldı', 'Ödeme işlemi başlatıldı. Stripe entegrasyonu yakında eklenecek.');
      } else {
        Alert.alert('Başarılı', 'Ödeme kaydı oluşturuldu.');
      }

      router.back();
    } catch (error: any) {
      console.error('Ödeme hatası:', error);
      Alert.alert('Hata', error.message || 'Ödeme işlemi gerçekleştirilemedi.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ödeme</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Ödenecek Tutar</Text>
          <Text style={styles.amountValue}>{amount}</Text>
        </View>

        <Text style={styles.sectionTitle}>Ödeme Yöntemi Seçin</Text>

        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.paymentMethodCard,
              selectedMethod === method.id && styles.paymentMethodCardSelected,
            ]}
            onPress={() => setSelectedMethod(method.id as any)}>
            <View style={[styles.methodIcon, { backgroundColor: method.color + '20' }]}>
              <Ionicons name={method.icon as any} size={24} color={method.color} />
            </View>
            <Text style={styles.methodName}>{method.name}</Text>
            {selectedMethod === method.id && (
              <Ionicons name="checkmark-circle" size={24} color="#0095F6" />
            )}
          </TouchableOpacity>
        ))}

        {selectedMethod === 'card' && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#0095F6" />
            <Text style={styles.infoText}>
              Stripe entegrasyonu yakında eklenecek. Şimdilik ödeme kaydı oluşturulacak.
            </Text>
          </View>
        )}

        {selectedMethod === 'wallet' && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Cüzdan bakiyenizden ödeme yapılacak. Yeterli bakiye yoksa kart ile yükleyebilirsiniz.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={processing}>
          <Text style={styles.payButtonText}>
            {processing ? 'İşleniyor...' : 'Ödemeyi Tamamla'}
          </Text>
          {!processing && <Ionicons name="lock-closed" size={20} color="#000" />}
        </TouchableOpacity>
      </View>
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
  contentContainer: { padding: 20, paddingBottom: 100 },
  amountCard: {
    backgroundColor: '#1E1E1E',
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#333',
  },
  amountLabel: { color: '#888', fontSize: 14, marginBottom: 8 },
  amountValue: { color: '#4CAF50', fontSize: 36, fontWeight: 'bold' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
    gap: 15,
  },
  paymentMethodCardSelected: {
    borderColor: '#0095F6',
    backgroundColor: '#111',
  },
  methodIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  infoText: { flex: 1, color: '#ccc', fontSize: 13, lineHeight: 18 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0095F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});

