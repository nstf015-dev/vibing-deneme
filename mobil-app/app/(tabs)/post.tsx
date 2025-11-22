import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// İŞLETME HİZMETLERİ (Örnek Liste)
const MY_SERVICES = [
  { id: '1', name: 'Saç Kesimi', price: '400₺' },
  { id: '2', name: 'Saç Boyama', price: '2500₺' },
  { id: '3', name: 'Gelin Başı', price: '5000₺' },
  { id: '4', name: 'Keratin Bakım', price: '1500₺' },
  { id: '5', name: 'Manikür', price: '300₺' },
];

export default function PostScreen() {
  const [description, setDescription] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  // Galeriden Seçim Yapmış Gibi Davranan Fonksiyon
  const pickMedia = () => {
    // Gerçek uygulamada burada galeri açılır. Şimdilik simüle ediyoruz.
    setSelectedMedia('https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=800&fit=crop');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 1. ÜST BAŞLIK */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Paylaşım</Text>
        <TouchableOpacity style={styles.shareButton} disabled={!selectedMedia}>
          <Text style={[styles.shareText, !selectedMedia && styles.disabledText]}>Paylaş</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* 2. MEDYA ALANI (FOTO/VİDEO SEÇİMİ) */}
        <View style={styles.mediaSection}>
          {selectedMedia ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedMedia }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeButton} onPress={() => setSelectedMedia(null)}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.editBadge}>
                <Ionicons name="color-wand" size={14} color="#fff" />
                <Text style={styles.editText}>Düzenle</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={pickMedia}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="images" size={32} color="#fff" />
              </View>
              <Text style={styles.uploadText}>Galeriden Seç</Text>
              <Text style={styles.uploadSubText}>Fotoğraf veya Video</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. AÇIKLAMA GİRİŞİ */}
        <View style={styles.inputSection}>
          <View style={styles.inputRow}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' }} 
              style={styles.miniAvatar} 
            />
            <TextInput
              style={styles.textInput}
              placeholder="Açıklama yaz... #saç #güzellik"
              placeholderTextColor="#666"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* 4. KRİTİK ÖZELLİK: HİZMET ETİKETLEME */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag" size={20} color="#0095F6" />
            <Text style={styles.sectionTitle}>Hizmet Etiketle</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Müşteriler bu gönderiden hangi hizmeti satın alabilir?</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
            {MY_SERVICES.map((service) => (
              <TouchableOpacity 
                key={service.id}
                style={[
                  styles.serviceChip, 
                  selectedService === service.name && styles.serviceChipActive
                ]}
                onPress={() => setSelectedService(service.name)}
              >
                <Text style={[
                  styles.serviceText,
                  selectedService === service.name && styles.serviceTextActive
                ]}>
                  {service.name} • {service.price}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* 5. DİĞER AYARLAR */}
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Konum Ekle</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Gelişmiş Ayarlar</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' 
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  shareButton: { paddingHorizontal: 10 },
  shareText: { color: '#0095F6', fontSize: 16, fontWeight: 'bold' },
  disabledText: { color: '#444' },
  
  content: { paddingBottom: 40 },

  // MEDYA ALANI
  mediaSection: { height: 300, backgroundColor: '#121212', marginBottom: 15 },
  uploadBox: { flex: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#333', margin: 10, borderRadius: 10 },
  uploadIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  uploadSubText: { color: '#666', fontSize: 12, marginTop: 5 },
  
  previewContainer: { flex: 1, position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeButton: { position: 'absolute', top: 10, right: 10 },
  editBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.7)', flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 4, gap: 5 },
  editText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // INPUT ALANI
  inputSection: { paddingHorizontal: 15, marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingTop: 5, height: 80, textAlignVertical: 'top' },
  
  divider: { height: 1, backgroundColor: '#222', marginVertical: 10 },

  // HİZMET ETİKETLEME
  section: { paddingHorizontal: 15, paddingVertical: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sectionSubtitle: { color: '#888', fontSize: 12, marginBottom: 10 },
  chipsContainer: { paddingBottom: 10 },
  serviceChip: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
    marginRight: 10, borderWidth: 1, borderColor: '#333', backgroundColor: '#1E1E1E' 
  },
  serviceChipActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  serviceText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  serviceTextActive: { color: '#fff' },

  // MENÜLER
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#111' },
  menuText: { color: '#fff', fontSize: 16 },
});