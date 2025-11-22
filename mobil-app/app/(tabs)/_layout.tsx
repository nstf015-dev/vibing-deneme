import { Ionicons } from '@expo/vector-icons'; // İkon kütüphanesi
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Üstteki varsayılan başlığı gizle
        tabBarStyle: {
          backgroundColor: '#000', // Alt menü siyah olsun
          borderTopColor: '#333',
          height: 60, // Biraz yüksek olsun, modern dursun
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#fff', // Seçili ikon beyaz
        tabBarInactiveTintColor: '#666', // Seçili olmayan gri
      }}>
      
      {/* 1. ANASAYFA (AKIŞ) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Akış',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 2. KEŞFET (ARAMA) */}
      <Tabs.Screen
        name="search"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 3. PAYLAŞIM (ORTA BUTON) */}
      <Tabs.Screen
        name="post"
        options={{
          title: '', // Yazısı olmasın
          tabBarIcon: ({ focused }) => (
            <View style={{
              top: -15, // Yukarı taşır
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#fff', // Öne çıkan beyaz buton
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: "#fff",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 5,
            }}>
              <Ionicons name="add" size={32} color="#000" />
            </View>
          ),
        }}
      />

      {/* 4. RANDEVULAR */}
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Randevular',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 5. PROFİL */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}