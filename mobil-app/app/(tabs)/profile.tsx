import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const PORTFOLIO_CATEGORIES = ['Hepsi', 'Saç Boyama', 'Kesim', 'Bakım', 'Makyaj'];
const ALL_POSTS = [
  { id: '1', uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=400&fit=crop', category: 'Saç Boyama', isVideo: true },
  { id: '2', uri: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=400&fit=crop', category: 'Kesim', isVideo: false },
  { id: '3', uri: 'https://images.unsplash.com/photo-1596472537566-8df4e8e80f76?w=400&h=400&fit=crop', category: 'Bakım', isVideo: true },
  { id: '4', uri: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=400&h=400&fit=crop', category: 'Makyaj', isVideo: false },
  { id: '5', uri: 'https://images.unsplash.com/photo-1632922267756-9b71242b1592?w=400&h=400&fit=crop', category: 'Saç Boyama', isVideo: false },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState('posts'); 
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/welcome');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profil çekme hatası:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // --- ÇIKIŞ YAPMA (WEB VE MOBİL UYUMLU) ---
  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('Hesabından çıkmak istiyor musun?')) {
        handleSignOut();
      }
    } else {
      Alert.alert('Çıkış Yap', 'Hesabından çıkmak istiyor musun?', [
        { text: 'İptal', style: 'cancel'},
        { text: 'Çıkış Yap', onPress: handleSignOut, style: 'destructive' }
      ]);
    }
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/welcome');
  }
  // ------------------------------------------

  const filteredData = selectedCategory === 'Hepsi' 
    ? ALL_POSTS 
    : ALL_POSTS.filter(post => post.category === selectedCategory);

  const renderGridItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.gridItem}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
      {item.isVideo && (
        <View style={styles.playIconContainer}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topBar}>
        <View style={styles.usernameContainer}>
          <Ionicons name="lock-closed-outline" size={16} color="#fff" />
          <Text style={styles.topUsername}>
             {profile?.username || profile?.full_name || 'Kullanıcı'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#fff" />
        </View>
        <View style={styles.topIcons}>
          <TouchableOpacity><Ionicons name="add-circle-outline" size={28} color="#fff" /></TouchableOpacity>
          
          {/* --- AYARLAR BUTONU (Dükkan Kurulumuna Gider) --- */}
          <TouchableOpacity onPress={() => router.push('/business-setup')} style={{ marginLeft: 15 }}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>

          {/* --- ÇIKIŞ BUTONU --- */}
          <TouchableOpacity onPress={confirmSignOut} style={{ marginLeft: 15 }}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>

        </View>
      </View>

      <View style={styles.statsRow}>
        <Image 
          source={{ uri: profile?.avatar_url || 'https://placehold.co/150' }} 
          style={styles.profileImage} 
        />
        <View style={styles.statsContainer}>
          <View style={styles.statItem}><Text style={styles.statNumber}>0</Text><Text style={styles.statLabel}>Gönderi</Text></View>
          <View style={styles.statItem}><Text style={styles.statNumber}>0</Text><Text style={styles.statLabel}>Takipçi</Text></View>
          <View style={styles.statItem}><Text style={styles.statNumber}>0</Text><Text style={styles.statLabel}>Takip</Text></View>
        </View>
      </View>

      <View style={styles.bioContainer}>
        <Text style={styles.fullName}>
          {profile?.role === 'business' ? profile?.business_name : profile?.full_name}
        </Text>
        <Text style={styles.category}>
          {profile?.role === 'business' ? 'İşletme Hesabı ✨' : 'Müşteri Hesabı 👤'}
        </Text>
        <Text style={styles.bio}>Henüz biyografi eklenmedi.</Text>
      </View>

      <View style={styles.actionButtons}>
        {profile?.role === 'business' && (
          <TouchableOpacity style={styles.dashboardButton} onPress={() => router.push('/dashboard')}>
            <Text style={styles.dashboardText}>İşletme Paneli</Text>
            <Ionicons name="bar-chart-outline" size={16} color="#000" style={{marginLeft: 5}} />
          </TouchableOpacity>
        )}

        {/* --- BURAYA EKLENDİ: PERSONEL PANELİ TEST BUTONU --- */}
        <TouchableOpacity 
          style={[styles.dashboardButton, {backgroundColor: '#333', marginTop: 5}]} 
          onPress={() => router.push('/staff-dashboard')}
        >
          <Text style={[styles.dashboardText, {color: '#fff'}]}>Personel Paneli (Test)</Text>
          <Ionicons name="person-outline" size={16} color="#fff" style={{marginLeft: 5}} />
        </TouchableOpacity>
        {/* -------------------------------------------------- */}

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.editButton}><Text style={styles.btnText}>Profili Düzenle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.editButton}><Text style={styles.btnText}>Paylaş</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}>
          <Ionicons name="grid-outline" size={24} color={activeTab === 'posts' ? '#fff' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'tagged' && styles.activeTab]} onPress={() => setActiveTab('tagged')}>
          <Ionicons name="person-circle-outline" size={26} color={activeTab === 'tagged' ? '#fff' : '#666'} />
        </TouchableOpacity>
      </View>

      {activeTab === 'posts' && (
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10}}>
            {PORTFOLIO_CATEGORIES.map((cat, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={filteredData}
        renderItem={renderGridItem}
        keyExtractor={item => item.id}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerContainer: { paddingTop: 10 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 15 },
  usernameContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  topUsername: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  topIcons: { flexDirection: 'row', gap: 15 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 15 },
  profileImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#333', marginRight: 20 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  statLabel: { color: '#fff', fontSize: 13 },
  bioContainer: { marginBottom: 15, paddingHorizontal: 15 },
  fullName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  category: { color: '#aaa', fontSize: 13, marginVertical: 2 },
  bio: { color: '#fff', fontSize: 14, lineHeight: 18 },
  actionButtons: { marginBottom: 10, paddingHorizontal: 15 },
  dashboardButton: { backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  dashboardText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  rowButtons: { flexDirection: 'row', gap: 8 },
  editButton: { flex: 1, backgroundColor: '#1E1E1E', alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  tabContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#222', marginTop: 5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#fff' },
  categoryContainer: { paddingVertical: 10, backgroundColor: '#000' },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#333', backgroundColor: '#000' },
  categoryChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  categoryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: '#000' },
  gridItem: { flex: 1/3, aspectRatio: 1, margin: 1, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  playIconContainer: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }
});