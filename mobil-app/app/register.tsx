import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const [role, setRole] = useState('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  // --- DEDEKTİF MODU ---
  async function handleRegister() {
    console.log("1. Butona Basıldı! 🚀"); // Bu yazıyı görmemiz lazım

    if (!email || !password || !fullName) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            business_name: role === 'business' ? businessName : null,
          },
        },
      });

      if (error) {
        alert('Hata: ' + error.message);
        console.log("Hata:", error);
      } else {
        alert('Kayıt Başarılı! Giriş ekranına yönlendiriliyorsunuz.');
        router.replace('/login');
      }

    } catch (e) {
      alert('Beklenmedik bir hata oluştu.');
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  // Web'de KeyboardAvoidingView kullanmıyoruz çünkü tıklamayı engelliyor
  const Container = Platform.OS === 'web' ? View : KeyboardAvoidingView;

  return (
    <SafeAreaView style={styles.container}>
      <Container behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.title}>Hesap Oluştur</Text>
            <Text style={styles.subtitle}>Test Modu Açık 🛠️</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleBtn, role === 'client' && styles.activeRole]} onPress={() => setRole('client')}>
                <Ionicons name="person" size={20} color={role === 'client' ? '#000' : '#666'} />
                <Text style={[styles.roleText, role === 'client' && styles.activeRoleText]}>Müşteri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleBtn, role === 'business' && styles.activeRole]} onPress={() => setRole('business')}>
                <Ionicons name="briefcase" size={20} color={role === 'business' ? '#000' : '#666'} />
                <Text style={[styles.roleText, role === 'business' && styles.activeRoleText]}>İşletme</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {role === 'business' && (
                <View style={styles.inputContainer}>
                  <TextInput placeholder="İşletme Adı" placeholderTextColor="#666" style={styles.input} value={businessName} onChangeText={setBusinessName} />
                </View>
              )}
              <View style={styles.inputContainer}>
                <TextInput placeholder="Ad Soyad" placeholderTextColor="#666" style={styles.input} value={fullName} onChangeText={setFullName} />
              </View>
              <View style={styles.inputContainer}>
                <TextInput placeholder="E-posta" placeholderTextColor="#666" style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} />
              </View>
              <View style={styles.inputContainer}>
                <TextInput placeholder="Şifre" placeholderTextColor="#666" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
              </View>

              {/* BUTON BURADA - Z-Index vererek en üste çıkardık */}
              <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.registerText}>Kayıt Ol</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' }, // ScrollView ayarı
  backBtn: { padding: 20, marginTop: 10, alignSelf: 'flex-start' },
  content: { paddingHorizontal: 24, paddingBottom: 50 },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#888', fontSize: 16, marginBottom: 30 },
  roleContainer: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 4, marginBottom: 25 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  activeRole: { backgroundColor: '#fff' },
  roleText: { color: '#666', fontWeight: '600' },
  activeRoleText: { color: '#000', fontWeight: 'bold' },
  form: { marginBottom: 30 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', borderRadius: 12, paddingHorizontal: 15, height: 56, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  registerBtn: { 
    backgroundColor: '#fff', 
    height: 56, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 10,
    zIndex: 999, // Web'de en üstte kalmasını sağlar
    cursor: 'pointer' // Web'de el işareti çıksın
  },
  registerText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});