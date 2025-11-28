import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookingProvider } from '../store/contexts/BookingContext';
import { SocialProvider } from '../store/contexts/SocialContext';

export default function RootLayout() {
  return (
    <BookingProvider>
      <SocialProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
        {/* Başlangıç Ekranı: Welcome */}
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        
        {/* Giriş ve Kayıt */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />

        {/* İşletme Yönetim Ekranları */}
        <Stack.Screen name="service-management" options={{ headerShown: false }} />
        <Stack.Screen name="staff-service-assignment" options={{ headerShown: false }} />
        <Stack.Screen name="staff-shift-management" options={{ headerShown: false }} />
        <Stack.Screen name="business-crm" options={{ headerShown: false }} />
        <Stack.Screen name="business-calendar" options={{ headerShown: false }} />
        <Stack.Screen name="staff-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="multi-service-booking" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="pos-checkout" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="campaign-builder" options={{ headerShown: false }} />

        {/* Ana Uygulama (Girişten sonra buraya gidilecek) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      </SocialProvider>
    </BookingProvider>
  );
}