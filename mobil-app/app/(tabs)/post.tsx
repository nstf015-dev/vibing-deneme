import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer'; // Dosya çevirici
import * as ImagePicker from 'expo-image-picker'; // Galeri için
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const MY_SERVICES = [
  { id: '1', name: 'Saç Kesimi', price: '400₺' },
  { id: '2', name: 'Saç Boyama', price: '2500₺' },
  { id: '3', name: 'Gelin Başı', price: '5000₺' },
  { id: '4', name: 'Keratin Bakım', price: '1500₺' },
  { id: '5', name: 'Manikür', price: '300₺' },
];

export default function PostScreen() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<any>(null); // Seçilen resim objesi
  const [loading, setLoading] = useState(false);

  // 1. GALERİDEN RESİM SEÇME
  const pickMedia = async () => {
    // İzin iste
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Galeri izni gerekiyor!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Şimdilik sadece resim
      allowsEditing: true,
      aspect: [1, 1], // Kare olsun
      quality: 0.5, // Çok büyük olmasın, hızlı yüklensin
      base64: true, // Supabase'e göndermek için gerekli
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  // 2. GÖNDERİYİ PAYLAŞMA (UPLOAD + INSERT)
  const handleShare = async () => {
    if (!selectedImage || !description) {
      alert('Lütfen bir resim seçin ve açıklama yazın.');
      return;
    }

    try {
      setLoading(true);

      // A. Kullanıcıyı bul
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Giriş yapmamışsınız.');

      // B. Profil ID'sini bul (Çünkü post tablosu profile_id ister)
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
      if (!profile) throw new Error('Profil bulunamadı.');

      // C. Resmi Depoya (Storage) Yükle
      const fileName = `${user.id}/${Date.now()}.jpg`; // Benzersiz isim
      const { error: uploadError } = await supabase.storage
        .from('posts') // Bucket adı
        .upload(fileName, decode(selectedImage.base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // D. Resmin Herkese Açık Linkini Al
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);

      // E. Veritabanına Kaydet
      const { error: dbError } = await supabase.from('posts').insert({
        user_id: user.id,
        media_url: publicUrl,
        description: description,
        service_name: selectedService || 'Genel Hizmet',
        price: selectedService ? MY_SERVICES.find(s => s.name === selectedService)?.price : null,
        type: 'image'
      });

      if (dbError) throw dbError;

      Alert.alert('Başarılı', 'Gönderin paylaşıldı! 🎉', [
        { text: 'Tamam', onPress: () => router.replace('/(tabs)') } // Ana sayfaya git
      ]);

    } catch (error: any) {
      console.log(error);
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Paylaşım</Text>
        <TouchableOpacity style={styles.shareButton} disabled={loading} onPress={handleShare}>
          {loading ? <ActivityIndicator color="#0095F6" /> : <Text style={[styles.shareText, !selectedImage && styles.disabledText]}>Paylaş</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* RESİM SEÇME ALANI */}
        <View style={styles.mediaSection}>
          {selectedImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeButton} onPress={() => setSelectedImage(null)}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={pickMedia}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="images" size={32} color="#fff" />
              </View>
              <Text style={styles.uploadText}>Galeriden Seç</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AÇIKLAMA */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            placeholder="Açıklama yaz... #saç #güzellik"
            placeholderTextColor="#666"
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.divider} />

        {/* HİZMET ETİKETLEME */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hizmet Etiketle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
            {MY_SERVICES.map((service) => (
              <TouchableOpacity 
                key={service.id}
                style={[styles.serviceChip, selectedService === service.name && styles.serviceChipActive]}
                onPress={() => setSelectedService(service.name)}
              >
                <Text style={[styles.serviceText, selectedService === service.name && styles.serviceTextActive]}>
                  {service.name} • {service.price}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  shareButton: { paddingHorizontal: 10 },
  shareText: { color: '#0095F6', fontSize: 16, fontWeight: 'bold' },
  disabledText: { color: '#444' },
  content: { paddingBottom: 40 },
  mediaSection: { height: 350, backgroundColor: '#121212', marginBottom: 15 },
  uploadBox: { flex: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#333', margin: 10, borderRadius: 10 },
  uploadIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  previewContainer: { flex: 1, position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  removeButton: { position: 'absolute', top: 10, right: 10 },
  inputSection: { paddingHorizontal: 15, marginBottom: 10 },
  textInput: { color: '#fff', fontSize: 16, height: 80, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 10 },
  section: { paddingHorizontal: 15 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  chipsContainer: { paddingBottom: 10 },
  serviceChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333', backgroundColor: '#1E1E1E' },
  serviceChipActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  serviceText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  serviceTextActive: { color: '#fff' },
});