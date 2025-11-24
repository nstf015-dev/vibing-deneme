import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router'; // Yönlendirme için bunu ekledik
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter(); // Router'ı tanımladık
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            full_name,
            business_name,
            avatar_url,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) console.error('Post hatası:', error);
      else setPosts(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  // --- İŞTE DÜZELTİLMİŞ YENİ FONKSİYON ---
  // Artık direkt randevu almıyor, 'booking' sayfasına yönlendiriyor.
  function handleBookAppointment(post: any) {
    const user = post.profiles || {}; // Post sahibi (İşletme)

    router.push({
      pathname: '/booking',
      params: {
        business_id: post.user_id, // İşletmenin ID'si
        business_name: user.business_name || user.full_name,
        service_name: post.service_name || 'Genel Hizmet',
        price: post.price || 'Fiyat Sorunuz'
      }
    });
  }
  // ----------------------------------------

  const renderPost = ({ item }: { item: any }) => {
    const user = item.profiles || {};
    const displayName = user.role === 'business' ? user.business_name : user.full_name;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          {/* PROFİLE GİTMEK İÇİN TIKLANABİLİR ALAN */}
          <TouchableOpacity 
            style={styles.userInfo} 
            onPress={() => router.push(`/business/${post.user_id}`)} // YENİ YÖNLENDİRME
          >
            <Image source={{ uri: user.avatar_url || 'https://placehold.co/150' }} style={styles.avatar} />
            <View>
              <Text style={styles.username}>{displayName}</Text>
              {user.role === 'business' && <Text style={styles.badge}>İşletme Hesabı</Text>}
            </View>
          </TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </View>
        
        <View style={styles.mediaContainer}>
          {item.type === 'video' ? (
            <Video
              style={styles.media}
              source={{ uri: item.media_url }}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
            />
          ) : (
            <Image source={{ uri: item.media_url }} style={styles.media} />
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.actionRow}>
            <View style={styles.leftActions}>
              <TouchableOpacity style={styles.actionButton}><Ionicons name="heart-outline" size={26} color="#fff" /></TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}><Ionicons name="chatbubble-outline" size={24} color="#fff" /></TouchableOpacity>
            </View>
            
            {/* Buton artık yeni fonksiyona bağlı */}
            <TouchableOpacity style={styles.bookButton} onPress={() => handleBookAppointment(item)}>
              <Text style={styles.bookButtonText}>Randevu Al</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.likes}>{item.likes_count || 0} beğenme</Text>
          <View style={styles.descriptionRow}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.description}> {item.description}</Text>
          </View>
          {item.service_name && (
            <View style={styles.serviceTagContainer}>
              <Ionicons name="pricetag" size={14} color="#aaa" />
              <Text style={styles.serviceTag}> {item.service_name} • {item.price}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>VibeBeauty</Text>
        <TouchableOpacity onPress={fetchPosts}><Ionicons name="refresh-outline" size={24} color="#fff" /></TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Henüz hiç gönderi yok. 😔</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  appTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  badge: { color: '#aaa', fontSize: 10 },
  mediaContainer: { width: width, height: 450, backgroundColor: '#111' },
  media: { width: '100%', height: '100%' },
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
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});