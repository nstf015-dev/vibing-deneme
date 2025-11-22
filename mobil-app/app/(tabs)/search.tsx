import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CATEGORIES = [
  { id: '1', name: 'Hepsi' },
  { id: '2', name: 'Kuaför' },
  { id: '3', name: 'Nail Art' },
  { id: '4', name: 'Cilt Bakımı' },
  { id: '5', name: 'Makyaj' },
];

// VİTRİN VERİSİ (isVideo özelliğini ekledik)
const EXPLORE_ITEMS = [
  { id: '1', uri: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=400&h=400&fit=crop', isVideo: true }, // Video
  { id: '2', uri: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=400&fit=crop', isVideo: false },
  { id: '3', uri: 'https://images.unsplash.com/photo-1596472537566-8df4e8e80f76?w=400&h=400&fit=crop', isVideo: true }, // Video
  { id: '4', uri: 'https://images.unsplash.com/photo-1632922267756-9b71242b1592?w=400&h=400&fit=crop', isVideo: false },
  { id: '5', uri: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400&h=400&fit=crop', isVideo: true }, // Video
  { id: '6', uri: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop', isVideo: false },
];

export default function SearchScreen() {
  const [activeCategory, setActiveCategory] = useState('Hepsi');

  const renderGridItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.gridItem}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
      
      {/* Eğer videoysa üzerine Play ikonu koy */}
      {item.isVideo && (
        <View style={styles.playIconOverlay}>
          <Ionicons name="play" size={20} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ARAMA */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput placeholder="Ara..." placeholderTextColor="#666" style={styles.searchInput} />
        </View>
      </View>

      {/* KATEGORİLER */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity 
              key={cat.id} 
              style={[styles.categoryChip, activeCategory === cat.name && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat.name)}
            >
              <Text style={[styles.categoryText, activeCategory === cat.name && styles.categoryTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* VİTRİN */}
      <FlatList
        data={EXPLORE_ITEMS}
        renderItem={renderGridItem}
        keyExtractor={item => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 10 },
  searchContainer: { paddingHorizontal: 15, marginBottom: 10 },
  searchBar: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15, alignItems: 'center' },
  searchIcon: { marginRight: 10 },
  searchInput: { color: '#fff', flex: 1, fontSize: 16, height: 24 },
  categoriesContainer: { marginBottom: 10 },
  categoriesList: { paddingHorizontal: 15 },
  categoryChip: { backgroundColor: '#1E1E1E', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  categoryChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  categoryText: { color: '#fff', fontWeight: '600' },
  categoryTextActive: { color: '#000' },
  gridContainer: { paddingHorizontal: 2 },
  gridItem: { flex: 1/3, aspectRatio: 1, margin: 1, position: 'relative' }, // Relative pozisyon önemli
  gridImage: { width: '100%', height: '100%' },
  
  // PLAY İKONU STİLİ
  playIconOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)', // Yarı saydam siyah
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  }
});