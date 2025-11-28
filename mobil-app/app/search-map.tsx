import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// Web'de react-native-maps çalışmaz, conditional import
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps yüklenemedi:', e);
  }
}

type BusinessMarker = {
  id: string;
  business_name: string | null;
  latitude: number;
  longitude: number;
  avatar_url: string | null;
  business_type: string | null;
};

export default function SearchMapScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [businesses, setBusinesses] = useState<BusinessMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessMarker | null>(null);

  const fetchBusinesses = useCallback(async (lat: number, lng: number) => {
    try {
      // Tüm işletmeleri çek (konum bilgisi olanlar)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, business_name, latitude, longitude, avatar_url, business_type')
        .eq('role', 'business')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(50);

      if (error) throw error;

      const markers: BusinessMarker[] = (data || [])
        .filter((b: any) => b.latitude && b.longitude)
        .map((b: any) => {
          const lat = parseFloat(String(b.latitude || '0'));
          const lng = parseFloat(String(b.longitude || '0'));
          if (isNaN(lat) || isNaN(lng)) return null;
          return {
            id: b.id,
            business_name: b.business_name,
            latitude: lat,
            longitude: lng,
            avatar_url: b.avatar_url,
            business_type: b.business_type,
          };
        })
        .filter((b): b is BusinessMarker => b !== null);

      // Mesafeye göre sırala (basit hesaplama)
      const sorted = markers.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.latitude - lat, 2) + Math.pow(a.longitude - lng, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.latitude - lat, 2) + Math.pow(b.longitude - lng, 2)
        );
        return distA - distB;
      });

      setBusinesses(sorted.slice(0, 20));
    } catch (error) {
      console.error('İşletme yükleme hatası:', error);
    }
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum bazlı arama için izin gereklidir.');
        setLocation({ latitude: 41.0082, longitude: 28.9784 }); // İstanbul default
        fetchBusinesses(41.0082, 28.9784);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      fetchBusinesses(coords.latitude, coords.longitude);
    } catch (error) {
      console.error('Konum hatası:', error);
      setLocation({ latitude: 41.0082, longitude: 28.9784 });
      fetchBusinesses(41.0082, 28.9784);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requestLocationPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Konum alınıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Web için liste görünümü
  if (Platform.OS === 'web' || !MapView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yakınımdaki İşletmeler</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {businesses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>Yakınınızda işletme bulunamadı</Text>
            </View>
          ) : (
            businesses.map((business) => (
              <TouchableOpacity
                key={business.id}
                style={styles.businessListItem}
                onPress={() => setSelectedBusiness(business)}>
                <View style={styles.listItemContent}>
                  <View style={styles.markerPinSmall} />
                  <View style={styles.listItemText}>
                    <Text style={styles.listItemName}>{business.business_name}</Text>
                    {business.business_type && (
                      <Text style={styles.listItemType}>{business.business_type}</Text>
                    )}
                    <Text style={styles.listItemCoords}>
                      📍 {business.latitude.toFixed(4)}, {business.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {selectedBusiness && (
          <View style={styles.businessCard}>
            <View style={styles.businessCardHeader}>
              <Text style={styles.businessName}>{selectedBusiness.business_name}</Text>
              <TouchableOpacity onPress={() => setSelectedBusiness(null)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedBusiness.business_type && (
              <Text style={styles.businessType}>{selectedBusiness.business_type}</Text>
            )}
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => {
                router.push(`/business/${selectedBusiness.id}`);
                setSelectedBusiness(null);
              }}>
              <Text style={styles.viewButtonText}>İşletmeyi Görüntüle</Text>
              <Ionicons name="arrow-forward" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{businesses.length} işletme bulundu</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Native için harita görünümü
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yakınımdaki İşletmeler</Text>
        <View style={{ width: 40 }} />
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton>
        {businesses.map((business) => (
          <Marker
            key={business.id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            onPress={() => setSelectedBusiness(business)}>
            <View style={styles.markerContainer}>
              <View style={styles.markerPin} />
            </View>
          </Marker>
        ))}
      </MapView>

      {selectedBusiness && (
        <View style={styles.businessCard}>
          <View style={styles.businessCardHeader}>
            <Text style={styles.businessName}>{selectedBusiness.business_name}</Text>
            <TouchableOpacity onPress={() => setSelectedBusiness(null)}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {selectedBusiness.business_type && (
            <Text style={styles.businessType}>{selectedBusiness.business_type}</Text>
          )}
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => {
              router.push(`/business/${selectedBusiness.id}`);
              setSelectedBusiness(null);
            }}>
            <Text style={styles.viewButtonText}>İşletmeyi Görüntüle</Text>
            <Ionicons name="arrow-forward" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{businesses.length} işletme bulundu</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0095F6',
    borderWidth: 3,
    borderColor: '#fff',
  },
  businessCard: {
    position: 'absolute',
    bottom: 80,
    left: 15,
    right: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  businessCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  businessName: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  businessType: { color: '#888', fontSize: 14, marginBottom: 12 },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0095F6',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  viewButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  footerText: { color: '#888', fontSize: 12, textAlign: 'center' },
  listContainer: { flex: 1 },
  listContent: { padding: 15, paddingBottom: 100 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 16 },
  businessListItem: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  markerPinSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0095F6',
  },
  listItemText: { flex: 1 },
  listItemName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  listItemType: { color: '#888', fontSize: 12, marginBottom: 4 },
  listItemCoords: { color: '#666', fontSize: 11 },
});

