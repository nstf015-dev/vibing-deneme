import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React, { useState } from 'react';
import { Dimensions, FlatList, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

// 1. HİBRİT VERİ (Hem Video Hem Foto)
const DUMMY_POSTS = [
  {
    id: '1',
    type: 'video', // BU BİR VİDEO
    user: {
      name: 'Studio Gül',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      isBusiness: true,
    },
    // Örnek dikey video (Pexels'den telifsiz)
    mediaUrl: 'https://videos.pexels.com/video-files/3997798/3997798-hd_720_1280_25fps.mp4', 
    description: 'Keratin bakımının muhteşem sonucu! ✨ #keratin #haircare',
    service: 'Keratin Bakım',
    price: '3000₺',
    likes: 342,
  },
  {
    id: '2',
    type: 'image', // BU BİR FOTOĞRAF
    user: {
      name: 'Nail Art by Ece',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
      isBusiness: true,
    },
    mediaUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&h=800&fit=crop',
    description: 'Neon renkler bu yazın modası. 💅',
    service: 'Jel Tırnak',
    price: '800₺',
    likes: 89,
  },
  {
    id: '3',
    type: 'video', // BU DA VİDEO
    user: {
      name: 'Barber King',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      isBusiness: true,
    },
    mediaUrl: 'https://videos.pexels.com/video-files/3205633/3205633-hd_720_1280_25fps.mp4',
    description: 'Jilet gibi keskin çizgiler. ✂️',
    service: 'Saç & Sakal Kesimi',
    price: '400₺',
    likes: 210,
  },
];

export default function HomeScreen() {
  // Hangi videonun oynadığını takip etmek için (İleride eklenebilir)
  const [playingId, setPlayingId] = useState(null);

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {/* Üst Kısım */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          <View>
            <Text style={styles.username}>{item.user.name}</Text>
            {item.user.isBusiness && <Text style={styles.badge}>İşletme Hesabı</Text>}
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
      </View>

      {/* MEDYA ALANI (VİDEO veya RESİM) */}
      <View style={styles.mediaContainer}>
        {item.type === 'video' ? (
          <Video
            style={styles.media}
            source={{ uri: item.mediaUrl }}
            useNativeControls={true} // Oynat/Durdur kontrolleri
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={false} // Sayfa açılınca otomatik başlamasın (performans için)
          />
        ) : (
          <Image source={{ uri: item.mediaUrl }} style={styles.media} />
        )}
        
        {/* Eğer videoyusaysa sağ üste ikon koy */}
        {item.type === 'video' && (
          <View style={styles.videoBadge}>
             <Ionicons name="videocam" size={14} color="#fff" />
          </View>
        )}
      </View>

      {/* Alt Kısım */}
      <View style={styles.footer}>
        <View style={styles.actionRow}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="paper-plane-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.bookButton}>
            <Text style={styles.bookButtonText}>Randevu Al</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.likes}>{item.likes} beğenme</Text>

        <View style={styles.descriptionRow}>
          <Text style={styles.username}>{item.user.name}</Text>
          <Text style={styles.description}> {item.description}</Text>
        </View>

        <View style={styles.serviceTagContainer}>
          <Ionicons name="pricetag" size={14} color="#aaa" />
          <Text style={styles.serviceTag}> {item.service} • {item.price}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>VibeBeauty</Text>
        <TouchableOpacity>
           <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={DUMMY_POSTS}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  appTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', fontFamily: 'System' },
  card: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  badge: { color: '#aaa', fontSize: 10 },
  
  // MEDYA STİLLERİ
  mediaContainer: { width: width, height: 450, position: 'relative' }, // Instagram boyutu
  media: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 4
  },

  footer: { paddingHorizontal: 12, paddingTop: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { marginRight: 15 },
  bookButton: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  bookButtonText: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  likes: { color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  descriptionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  description: { color: '#fff' },
  serviceTagContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#222', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  serviceTag: { color: '#ccc', fontSize: 12 },
});