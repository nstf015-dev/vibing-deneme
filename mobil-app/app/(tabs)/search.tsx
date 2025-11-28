import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../lib/supabase';

type ExploreItem = {
  id: string;
  uri: string;
  isVideo?: boolean;
  service_name?: string | null;
  business?: {
    business_name?: string | null;
  } | null;
};

type BusinessResult = {
  id: string;
  business_name: string | null;
  business_type: string | null;
  avatar_url: string | null;
  city?: string | null;
};

type ServiceResult = {
  id: string;
  name: string;
  price: string | null;
  duration: number | null;
  business_id: string;
  business?: {
    business_name: string | null;
    avatar_url: string | null;
    business_type: string | null;
  } | null;
};

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [businessCategories, setBusinessCategories] = useState<string[]>(['Hepsi']);
  const [activeCategory, setActiveCategory] = useState('Hepsi');
  const [businessResults, setBusinessResults] = useState<BusinessResult[]>([]);
  const [serviceResults, setServiceResults] = useState<ServiceResult[]>([]);
  const [exploreItems, setExploreItems] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const fetchExploreItems = useCallback(async () => {
    try {
      setLoadingExplore(true);
      const { data, error } = await supabase
        .from('posts')
        .select(
          `
          id,
          media_url,
          type,
          service_name,
          profiles (
            business_name
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Vitrin verisi yüklenemedi:', error);
        return;
      }

      const formatted: ExploreItem[] =
        data?.map((item) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          return {
            id: String(item.id),
            uri: item.media_url,
            isVideo: item.type === 'video',
            service_name: item.service_name,
            business: profile ? { business_name: profile.business_name } : null,
          };
        }) || [];

      setExploreItems(formatted);
    } finally {
      setLoadingExplore(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('business_services').select('business_id, name, category');

      if (error) {
        console.error('Kategori bilgisi alınamadı:', error);
        return;
      }

      const categories = Array.from(
        new Set(
          (data || [])
            .map((service) => service.category || service.name)
            .filter(Boolean)
        )
      ) as string[];

      setBusinessCategories(['Hepsi', ...categories]);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleSearch = useCallback(async (query: string, categoryFilter: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && categoryFilter === 'Hepsi') {
      setBusinessResults([]);
      setServiceResults([]);
      return;
    }

    setSearching(true);
    const likeQuery = trimmed.length >= 2 ? `%${trimmed}%` : '%';

    let businessQuery = supabase
      .from('profiles')
      .select('id, business_name, business_type, avatar_url, city, latitude, longitude')
      .eq('role', 'business')
      .ilike('business_name', likeQuery);

    // Konum bazlı sıralama (eğer konum varsa)
    if (userLocation) {
      businessQuery = businessQuery.limit(50); // Daha fazla sonuç al, sonra mesafeye göre sırala
    } else {
      businessQuery = businessQuery.limit(15);
    }

    const businessPromise = businessQuery;

    const serviceQuery = supabase
      .from('business_services')
      .select(
        `
          id,
          name,
          price,
          duration,
          business_id,
          business:profiles!business_id (
            business_name,
            avatar_url,
            business_type
          )
        `
      )
      .ilike('name', likeQuery)
      .limit(15);

    try {
      const [{ data: businesses, error: businessError }, { data: services, error: serviceError }] = await Promise.all([
        businessPromise,
        serviceQuery,
      ]);

      if (businessError) console.error('İşletme arama hatası:', businessError);
      if (serviceError) console.error('Hizmet arama hatası:', serviceError);

      let filteredBusinesses = businesses || [];
      
      // Kategori filtresi
      if (categoryFilter !== 'Hepsi') {
        filteredBusinesses = filteredBusinesses.filter(
          (biz) => biz.business_type?.toLowerCase() === categoryFilter.toLowerCase()
        );
      }

      // Konum bazlı sıralama
      if (userLocation && filteredBusinesses.length > 0) {
        filteredBusinesses = filteredBusinesses
          .filter((b: any) => b.latitude && b.longitude)
          .map((b: any) => {
            const lat = parseFloat(b.latitude);
            const lng = parseFloat(b.longitude);
            const distance = Math.sqrt(
              Math.pow(lat - userLocation.latitude, 2) + Math.pow(lng - userLocation.longitude, 2)
            );
            return { ...b, distance };
          })
          .sort((a: any, b: any) => a.distance - b.distance)
          .slice(0, 15);
      }

      setBusinessResults(filteredBusinesses as BusinessResult[]);
      const formattedServices: ServiceResult[] = (services || []).map((srv: any) => {
        const biz = Array.isArray(srv.business) ? srv.business[0] : srv.business;
        return {
          id: srv.id,
          name: srv.name,
          price: srv.price,
          duration: srv.duration,
          business_id: srv.business_id,
          business: biz ? {
            business_name: biz.business_name,
            avatar_url: biz.avatar_url,
            business_type: biz.business_type,
          } : null,
        };
      });
      setServiceResults(formattedServices);
    } finally {
      setSearching(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchExploreItems();
    fetchCategories();
    requestLocationPermission();
  }, [fetchExploreItems, fetchCategories]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Konum hatası:', error);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      handleSearch(searchQuery, activeCategory);
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery, activeCategory, handleSearch]);

  const renderGridItem = ({ item }: { item: ExploreItem }) => (
    <TouchableOpacity style={styles.gridItem}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
      {item.isVideo && (
        <View style={styles.playIconOverlay}>
          <Ionicons name="play" size={20} color="#fff" />
        </View>
      )}
      {item.service_name && (
        <View style={styles.gridBadge}>
          <Ionicons name="pricetag-outline" size={12} color="#fff" />
          <Text style={styles.gridBadgeText}>{item.service_name}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderBusinessCard = ({ item }: { item: BusinessResult }) => (
    <TouchableOpacity style={styles.businessCard} onPress={() => router.push(`/business/${item.id}`)}>
      <Image source={{ uri: item.avatar_url || 'https://placehold.co/80' }} style={styles.businessAvatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.businessName}>{item.business_name || 'İsimsiz İşletme'}</Text>
        <Text style={styles.businessType}>{item.business_type || 'Genel'}</Text>
        {item.city && <Text style={styles.businessCity}>{item.city}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fff" />
    </TouchableOpacity>
  );

  const renderServiceCard = ({ item }: { item: ServiceResult }) => (
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() =>
        router.push({
          pathname: '/booking',
          params: {
            business_id: item.business_id,
            business_name: item.business?.business_name || 'İşletme',
            service_name: item.name,
            price: item.price || 'Fiyat sorunuz',
          },
        })
      }>
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceMeta}>
          {item.duration ? `${item.duration} dk` : 'Süre belirtilmedi'} • {item.price || 'Fiyat sorunuz'}
        </Text>
        <Text style={styles.serviceBusiness}>{item.business?.business_name}</Text>
      </View>
      <Ionicons name="time-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  const hasSearchResults = businessResults.length > 0 || serviceResults.length > 0;

  const placeholderState = useMemo(() => {
    if (searchQuery.trim().length >= 2 && !searching && !hasSearchResults) {
      return 'Aramanıza uygun sonuç bulunamadı.';
    }
    return null;
  }, [searchQuery, searching, hasSearchResults]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            placeholder="Hizmet veya işletme ara..."
            placeholderTextColor="#666"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/search-map')}>
          <Ionicons name="map-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          {businessCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {searching && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Aranıyor...</Text>
        </View>
      )}

      {hasSearchResults ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          {businessResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>İşletmeler</Text>
              {businessResults.map((business) => (
                <View key={business.id}>{renderBusinessCard({ item: business })}</View>
              ))}
            </View>
          )}

          {serviceResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hizmetler</Text>
              {serviceResults.map((service) => (
                <View key={service.id}>{renderServiceCard({ item: service })}</View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          {placeholderState && <Text style={styles.emptyText}>{placeholderState}</Text>}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trend Paylaşımlar</Text>
            {loadingExplore ? <ActivityIndicator color="#fff" /> : null}
          </View>
          <FlatList
            data={exploreItems}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 10 },
  searchContainer: { 
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
    gap: 10,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    gap: 10,
  },
  mapButton: {
    backgroundColor: '#0095F6',
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: { marginRight: 0 },
  searchInput: { color: '#fff', flex: 1, fontSize: 16, height: 24 },
  categoriesContainer: { marginBottom: 10 },
  categoriesList: { paddingHorizontal: 15 },
  categoryChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  categoryText: { color: '#fff', fontWeight: '600' },
  categoryTextActive: { color: '#000' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  loadingText: { color: '#fff' },
  section: { paddingHorizontal: 15, marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  businessAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  businessName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  businessType: { color: '#aaa', fontSize: 12 },
  businessCity: { color: '#666', fontSize: 12 },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    gap: 14,
  },
  serviceName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  serviceMeta: { color: '#ccc', fontSize: 12, marginTop: 4 },
  serviceBusiness: { color: '#888', fontSize: 12, marginTop: 2 },
  gridContainer: { paddingHorizontal: 2, paddingBottom: 80 },
  gridItem: { flex: 1 / 3, aspectRatio: 1, margin: 1, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  playIconOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gridBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  sectionHeader: {
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: { color: '#666', textAlign: 'center', marginBottom: 15 },
});
